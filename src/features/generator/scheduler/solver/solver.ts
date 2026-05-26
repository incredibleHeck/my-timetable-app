import {
  AppData,
  Conflict,
  Teacher,
  Subject,
  ClassGroup,
  Room,
} from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import {
  initializeState,
  applyGangToState,
  removeGangFromState,
} from "../core/state";
import { findMostConstrainedGangIdx, calculatePriority } from "./heuristics";
import { findValidMoves, findMinConflictMove } from "./search";
import { TabuManager } from "./tabu";
import { PRIORITY_CRITICAL } from "../constants";

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
  // 1. ARCHITECT: Initialize O(1) Lookups ONCE
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

  // 2. Initialize State
  const state = initializeState(data);

  // 3. Pre-Process Gangs & Static Priority
  const gangMap = new Map<string, AllocationUnit[]>();
  for (const u of units) {
    unitMap.set(u.id, u);
    u.priority = calculatePriority(u, data, teacherMap, subjectMap);

    const gangId = u.jointClassId || u.electiveBlockId || u.id;
    if (!gangMap.has(gangId)) gangMap.set(gangId, []);
    gangMap.get(gangId)!.push(u);
  }

  // Identify Gang Leaders for the Queue
  const unplacedGangLeaders = units.filter((u) => {
    const gangId = u.jointClassId || u.electiveBlockId || u.id;
    return gangMap.get(gangId)![0].id === u.id;
  });

  const totalGangs = unplacedGangLeaders.length;
  const unplacedDuringConstruction: AllocationUnit[] = [];

  // --- PHASE 1: CONSTRUCTION ---

  // RANK 1: GLOBAL BOTTLENECKS (Restricted / Part-Time Teachers)
  // These must be handled first across all grades because their availability is the tightest.
  const rank1Queue = unplacedGangLeaders.filter(
    (u) => u.priority >= PRIORITY_CRITICAL,
  );
  const remainingAfterRank1 = unplacedGangLeaders.filter(
    (u) => u.priority < PRIORITY_CRITICAL,
  );

  let steps = 0;
  let gangsPlaced = 0;

  // Process Rank 1
  while (rank1Queue.length > 0) {
    steps++;
    const leaderIdx = findMostConstrainedGangIdx(
      rank1Queue,
      state,
      data,
      gangMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );
    const leader = rank1Queue.splice(leaderIdx, 1)[0];
    const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
    const gangUnits = gangMap.get(gangId)!;

    const moves = findValidMoves(
      state,
      data,
      gangUnits,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    );
    if (moves.length > 0) {
      moves.sort((a, b) => b.score - a.score);
      applyGangToState(state, gangUnits, moves[0]);
      gangsPlaced++;
    } else {
      unplacedDuringConstruction.push(leader);
    }
  }

  // RANK 2+: Group by grade level and process higher grades first.
  const levels = Array.from(
    new Set(remainingAfterRank1.map((u) => u.rankLevel)),
  ).sort((a, b) => b - a);

  for (const level of levels) {
    const levelQueue = remainingAfterRank1.filter((u) => u.rankLevel === level);

    while (levelQueue.length > 0) {
      steps++;
      if (onProgress && steps % 10 === 0) {
        if (
          !onProgress(
            "CONSTRUCTION",
            gangsPlaced,
            totalGangs,
            unplacedDuringConstruction.length,
          )
        ) {
          return {
            schedule: state.schedule,
            conflicts: [],
            state,
            iterations: steps,
          };
        }
      }

      const leaderIdx = findMostConstrainedGangIdx(
        levelQueue,
        state,
        data,
        gangMap,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
      );
      const leader = levelQueue.splice(leaderIdx, 1)[0];
      const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
      const gangUnits = gangMap.get(gangId)!;

      const moves = findValidMoves(
        state,
        data,
        gangUnits,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
      );

      if (moves.length > 0) {
        moves.sort((a, b) => b.score - a.score);
        applyGangToState(state, gangUnits, moves[0]);
        gangsPlaced++;
      } else {
        unplacedDuringConstruction.push(leader);
      }
    }
  }

  // --- PHASE 2: REPAIR (Min-Conflicts + Tabu Search) ---
  let repairSteps = 0;
  const MAX_REPAIR_STEPS = 5000;
  const tabu = new TabuManager(25);

  const repairQueue = [...unplacedDuringConstruction].sort(
    (a, b) => b.rankLevel - a.rankLevel,
  );
  const repairSet = new Set(
    repairQueue.map((u) => u.jointClassId || u.electiveBlockId || u.id),
  );

  while (repairQueue.length > 0 && repairSteps < MAX_REPAIR_STEPS) {
    repairSteps++;

    if (onProgress && repairSteps % 10 === 0) {
      if (
        !onProgress("REPAIR", repairSteps, MAX_REPAIR_STEPS, repairQueue.length)
      )
        break;
    }

    const leader = repairQueue.shift()!;
    const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
    repairSet.delete(gangId);
    const gangUnits = gangMap.get(gangId)!;

    const bestMove = findMinConflictMove(
      state,
      data,
      gangUnits,
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      tabu,
      repairSteps,
    );

    if (bestMove.cost < Infinity) {
      if (bestMove.evictions.size > 0) {
        bestMove.evictions.forEach((victimId) => {
          const victimUnit = unitMap.get(victimId);
          if (victimUnit) {
            const vGangId =
              victimUnit.jointClassId ||
              victimUnit.electiveBlockId ||
              victimUnit.id;

            const currentPlace = state.unitPlacements.get(victimId);
            if (currentPlace)
              tabu.markTabu(
                victimId,
                currentPlace.d,
                currentPlace.p,
                repairSteps,
              );

            const vGang = gangMap.get(vGangId)!;
            removeGangFromState(state, vGang, data);

            if (!repairSet.has(vGangId)) {
              repairQueue.push(vGang[0]);
              repairQueue.sort((a, b) => b.rankLevel - a.rankLevel);
              repairSet.add(vGangId);
            }
          }
        });
      }
      applyGangToState(state, gangUnits, bestMove);
    } else {
      repairQueue.push(leader);
      repairSet.add(gangId);
    }
  }

  tabu.cleanup(repairSteps);

  const finalConflicts: Conflict[] = [];
  const reportedUnits = new Set<string>();

  repairQueue.forEach((leader) => {
    const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
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
  });

  return {
    schedule: state.schedule,
    conflicts: finalConflicts,
    state,
    iterations: steps + repairSteps,
  };
};
