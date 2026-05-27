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
import {
  PRIORITY_CRITICAL,
  MAX_REPAIR_STEPS,
  TABU_TENURE_DEFAULT,
  TABU_CLEANUP_FREQUENCY,
  MRV_CRITICAL_FIRST,
  SOLVER_RUN_COUNT,
} from "../constants";
import { createSeededRng, shuffleInPlace } from "../utils/rng";

export type SolverProgressCallback = (
  phase: string,
  progress: number,
  total: number,
  conflicts: number,
) => boolean;

export type SolverOptions = {
  /** Base seed for shuffled construction order (run N uses seed + N). */
  seed?: number;
  /** Independent solve attempts; best result is returned. */
  runs?: number;
  /** Shuffle construction queues between runs. */
  shuffleConstruction?: boolean;
};

export type SolverResult = {
  schedule: SchedulerState["schedule"];
  conflicts: Conflict[];
  state: SchedulerState;
  iterations: number;
  runIndex: number;
};

function compareSolverResults(a: SolverResult, b: SolverResult): number {
  if (a.conflicts.length !== b.conflicts.length) {
    return a.conflicts.length - b.conflicts.length;
  }
  return b.state.unitPlacements.size - a.state.unitPlacements.size;
}

function runSingleSolve(
  units: AllocationUnit[],
  data: AppData,
  onProgress: SolverProgressCallback | undefined,
  options: SolverOptions,
  runIndex: number,
): SolverResult {
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

  let unplacedGangLeaders = units.filter((u) => {
    const gangId = getGangId(u);
    return gangMap.get(gangId)![0].id === u.id;
  });

  if (options.shuffleConstruction === true || runIndex > 0) {
    const seed = (options.seed ?? Date.now()) + runIndex * 9973;
    shuffleInPlace(unplacedGangLeaders, createSeededRng(seed));
  }

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
  ) => onProgress?.("CONSTRUCTION", placed, total, unplacedCount) ?? true;

  let rank1Queue = unplacedGangLeaders.filter(
    (u) => u.priority >= PRIORITY_CRITICAL,
  );
  let remainingAfterRank1 = unplacedGangLeaders.filter(
    (u) => u.priority < PRIORITY_CRITICAL,
  );

  if (!MRV_CRITICAL_FIRST) {
    rank1Queue = [...unplacedGangLeaders];
    remainingAfterRank1 = [];
  }

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

  let repairSteps = 0;
  const tabu = new TabuManager({ tenure: TABU_TENURE_DEFAULT });

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
      ) {
        break;
      }
    }

    if (repairSteps % TABU_CLEANUP_FREQUENCY === 0) {
      tabu.cleanup(repairSteps);
    }

    const leader = repairQueue.shift()!;
    const gangId = getGangId(leader);
    repairSet.delete(gangId);

    if (repairController.shouldSkipGang(gangId)) {
      repairController.recordProgress(
        countUnplacedGangs(repairQueue, repairController),
      );
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
      tabu.recordSuccess();
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

    repairController.recordProgress(
      countUnplacedGangs(repairQueue, repairController),
    );

    if (repairController.shouldDiversify()) {
      tabu.recordStagnation();
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
        repairController.recordProgress(
          countUnplacedGangs(repairQueue, repairController),
        );
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
    runIndex,
  };
}

/**
 * CSP SOLVER: Construction + repair with optional multi-run restarts.
 */
export const solveSmart = (
  units: AllocationUnit[],
  data: AppData,
  onProgress?: SolverProgressCallback,
  options: SolverOptions = {},
): SolverResult => {
  const runCount = Math.max(1, options.runs ?? 1);

  if (runCount === 1) {
    return runSingleSolve(units, data, onProgress, options, 0);
  }

  let bestResult: SolverResult | null = null;

  for (let run = 0; run < runCount; run++) {
    const result = runSingleSolve(units, data, onProgress, options, run);
    if (!bestResult || compareSolverResults(result, bestResult) < 0) {
      bestResult = result;
    }

    if (bestResult.conflicts.length === 0) break;
  }

  return bestResult!;
};

/** Worker entry: run multiple seeded attempts within the time budget. */
export const solveSmartWithRestarts = (
  units: AllocationUnit[],
  data: AppData,
  onProgress?: SolverProgressCallback,
  options: SolverOptions = {},
): SolverResult => {
  return solveSmart(units, data, onProgress, {
    runs: options.runs ?? SOLVER_RUN_COUNT,
    shuffleConstruction: options.shuffleConstruction ?? true,
    seed: options.seed,
  });
};
