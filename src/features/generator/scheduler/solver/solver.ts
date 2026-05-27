import {
  AppData,
  Conflict,
  Teacher,
  Subject,
  ClassGroup,
  Room,
} from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { initializeState } from "../core/state";
import { calculatePriority } from "./heuristics";
import { TabuManager } from "./tabu";
import {
  RepairController,
  countUnplacedGangs,
  diversifyRepairState,
  getGangId,
  isRepairActionFailed,
} from "./repair-controller";
import { executeRepairAction } from "./repair-executor";
import { findBestRepairMove } from "./search";
import {
  runConstructionQueue,
  PlacementRecord,
  ConstructionMaps,
} from "./construction";
import { PRIORITY_CRITICAL, MAX_REPAIR_STEPS } from "../constants";

/**
 * CSP SOLVER: Final Integrated Version
 * Orchestrates Phase 1 (Construction) and Phase 2 (Repair) with O(1) performance.
 */
export const solveSmart = (
  units: AllocationUnit[],
  data: AppData,
  onProgress?: (
    phase: string,
    progress: number,
    total: number,
    conflicts: number,
  ) => boolean,
) => {
  const teacherMap = new Map<string, Teacher>(
    data.teachers.map((t) => [t.id, t]),
  );
  const subjectMap = new Map<string, Subject>(
    data.subjects.map((s) => [s.id, s]),
  );
  const classMap = new Map<string, ClassGroup>(
    data.classes.map((c) => [c.id, c]),
  );
  const roomMap = new Map<string, Room>(data.rooms.map((r) => [r.id, r]));
  const unitMap = new Map<string, AllocationUnit>();

  const state = initializeState(data);

  const gangMap = new Map<string, AllocationUnit[]>();
  for (const u of units) {
    unitMap.set(u.id, u);
    u.priority = calculatePriority(u, data, teacherMap, subjectMap);

    const gangId = getGangId(u);
    if (!gangMap.has(gangId)) gangMap.set(gangId, []);
    gangMap.get(gangId)!.push(u);
  }

  const unplacedGangLeaders = units.filter((u) => {
    const gangId = getGangId(u);
    return gangMap.get(gangId)![0].id === u.id;
  });

  const totalGangs = unplacedGangLeaders.length;
  const constructionMaps: ConstructionMaps = {
    data,
    gangMap,
    teacherMap,
    subjectMap,
    classMap,
    roomMap,
  };

  const placementStack: PlacementRecord[] = [];
  let backtrackAttempts = 0;
  let steps = 0;
  let gangsPlaced = 0;
  const unplacedDuringConstruction: AllocationUnit[] = [];

  const reportConstructionProgress = (
    placed: number,
    total: number,
    unplacedCount: number,
  ) => {
    if (!onProgress) return true;
    return onProgress("CONSTRUCTION", placed, total, unplacedCount);
  };

  // --- PHASE 1: CONSTRUCTION ---

  const rank1Queue = unplacedGangLeaders.filter(
    (u) => u.priority >= PRIORITY_CRITICAL,
  );
  const remainingAfterRank1 = unplacedGangLeaders.filter(
    (u) => u.priority < PRIORITY_CRITICAL,
  );

  let rank1Result = runConstructionQueue(
    rank1Queue,
    state,
    constructionMaps,
    placementStack,
    backtrackAttempts,
    steps,
    gangsPlaced,
    unplacedDuringConstruction,
    reportConstructionProgress,
    totalGangs,
  );
  steps = rank1Result.steps;
  gangsPlaced = rank1Result.gangsPlaced;
  backtrackAttempts = rank1Result.backtrackAttempts;

  const levels = Array.from(
    new Set(remainingAfterRank1.map((u) => u.rankLevel)),
  ).sort((a, b) => b - a);

  for (const level of levels) {
    const levelQueue = remainingAfterRank1.filter((u) => u.rankLevel === level);
    const levelResult = runConstructionQueue(
      levelQueue,
      state,
      constructionMaps,
      placementStack,
      backtrackAttempts,
      steps,
      gangsPlaced,
      unplacedDuringConstruction,
      reportConstructionProgress,
      totalGangs,
    );
    steps = levelResult.steps;
    gangsPlaced = levelResult.gangsPlaced;
    backtrackAttempts = levelResult.backtrackAttempts;
  }

  // --- PHASE 2: REPAIR (Min-Conflicts + Tabu Search) ---
  let repairSteps = 0;
  const tabu = new TabuManager(25);

  const repairQueue = [...unplacedDuringConstruction].sort(
    (a, b) => b.rankLevel - a.rankLevel,
  );
  const repairSet = new Set(repairQueue.map((u) => getGangId(u)));
  const repairController = new RepairController(repairQueue.length);

  while (repairQueue.length > 0 && repairSteps < MAX_REPAIR_STEPS) {
    repairSteps++;

    if (onProgress && repairSteps % 10 === 0) {
      if (
        !onProgress("REPAIR", repairSteps, MAX_REPAIR_STEPS, repairQueue.length)
      )
        break;
    }

    const leader = repairQueue.shift()!;
    const gangId = getGangId(leader);
    repairSet.delete(gangId);

    if (repairController.shouldSkipGang(gangId)) {
      repairController.recordProgress(countUnplacedGangs(repairQueue, repairController));
      continue;
    }

    const gangUnits = gangMap.get(gangId)!;

    const repairAction = findBestRepairMove(
      state,
      data,
      gangUnits,
      gangMap,
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      tabu,
      repairSteps,
    );

    if (!isRepairActionFailed(repairAction)) {
      repairController.recordSuccess(gangId);
      executeRepairAction(
        state,
        gangUnits,
        repairAction,
        repairQueue,
        repairSet,
        gangMap,
        unitMap,
        data,
        tabu,
        repairSteps,
      );
    } else {
      repairController.recordFailedAttempt(gangId, leader);
      if (!repairController.shouldSkipGang(gangId)) {
        repairQueue.push(leader);
        repairSet.add(gangId);
      }
    }

    repairController.recordProgress(countUnplacedGangs(repairQueue, repairController));

    if (repairController.shouldDiversify()) {
      const shaken = diversifyRepairState(
        state,
        data,
        gangMap,
        unitMap,
        repairQueue,
        repairSet,
      );
      if (shaken > 0) {
        repairController.resetStagnation();
        repairController.recordProgress(countUnplacedGangs(repairQueue, repairController));
      }
    }
  }

  tabu.cleanup(repairSteps);

  const finalConflicts: Conflict[] = [];
  const reportedUnits = new Set<string>();

  repairQueue.forEach((leader) => {
    reportUnplacedLeader(leader);
  });
  repairController.abandonedLeadersList.forEach((leader) => {
    reportUnplacedLeader(leader);
  });

  function reportUnplacedLeader(leader: AllocationUnit) {
    const gangId = getGangId(leader);
    if (reportedUnits.has(gangId)) return;
    reportedUnits.add(gangId);

    leader.classIds.forEach((cid, idx) => {
      const cls = classMap.get(cid);
      finalConflicts.push({
        classId: cid,
        className: cls?.name || leader.classNames[idx],
        subjectId: leader.subjectId,
        subjectName: leader.subjectName,
        teacherName: leader.teacherNames.join(", "),
        reason: `Unplaced: System could not find a valid slot for ${leader.duration === 2 ? "Double" : "Single"} Period. Try adjusting constraints or availability.`,
        severity: "HIGH",
        kind: "blocking",
        day: 0,
        period: 0,
      });
    });
  }

  return {
    schedule: state.schedule,
    conflicts: finalConflicts,
    state,
    iterations: steps + repairSteps,
  };
};
