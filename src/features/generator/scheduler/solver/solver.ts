import { AppData, Conflict, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { initializeState } from "../core/state";
import { calculatePriority, MrvCache } from "./heuristics";
import { TabuManager } from "./tabu";
import {
  RepairController,
  countUnplacedGangs,
  countUnplacedGangLeaders,
  diversifyRepairState,
  getGangId,
  isRepairActionFailed,
} from "./repair-controller";
import { executeRepairAction } from "./repair-executor";
import { findBestRepairMove } from "./search";
import { scoreSchedule } from "../logic/objective";
import { diagnoseUnplacedGang } from "../logic/diagnose-unplaced";
import { optimiseSchedule } from "../logic/optimise";
import { runConstructionQueue, PlacementRecord, ConstructionMaps } from "./construction";
import {
  PRIORITY_CRITICAL,
  MAX_REPAIR_STEPS,
  TABU_TENURE_DEFAULT,
  TABU_CLEANUP_FREQUENCY,
  MRV_CRITICAL_FIRST,
  SOLVER_RUN_COUNT,
  SOLVER_TARGET_MS,
  SCORING_WEIGHTS,
  ScoringWeightKey,
  ScoringWeightOverrides,
  OPTIMISE_BUDGET_SHARE,
} from "../constants";
import { createSeededRng, shuffleInPlace } from "../utils/rng";
import { isPerfectGeneratedSchedule } from "../validation";

export type SolverProgressMeta = {
  runIndex: number;
  bestUnplaced: number;
  perfectRuns: number;
  elapsedMs: number;
  timeBudgetMs?: number;
  /** Snapshot of a zero-conflict timetable (sent when a run passes audit). */
  scheduleSnapshot?: SchedulerState["schedule"];
};

export type SolverProgressCallback = (
  phase: string,
  progress: number,
  total: number,
  conflicts: number,
  meta?: SolverProgressMeta,
) => boolean;

export type SolverOptions = {
  /** Base seed for shuffled construction order (run N uses seed + N). */
  seed?: number;
  /** Independent solve attempts; best result is returned. */
  runs?: number;
  /** Shuffle construction queues between runs. */
  shuffleConstruction?: boolean;
  /** Enable self-tuning calibration: perturb scoring weights across runs. */
  calibrate?: boolean;
  /** Time budget (ms). When set, solver keeps spawning runs until elapsed. */
  timeBudgetMs?: number;
  /** Shared wall-clock start (ms) for time-budget mode; usually worker start time. */
  clockStartMs?: number;
};

export type SolverResult = {
  schedule: SchedulerState["schedule"];
  conflicts: Conflict[];
  state: SchedulerState;
  iterations: number;
  runIndex: number;
  totalRuns: number;
  /** Unplaced lesson gangs (not per-class conflict rows). */
  unplacedGangs: number;
  /** Completed runs that placed every lesson gang. */
  perfectRuns: number;
  /** Weighted soft quality cost of this run's schedule; lower is better. */
  softCost?: number;
  /** Gang leaders and their units, so a later phase can move placed lessons. */
  gangLeaders: AllocationUnit[];
  gangMap: Map<string, AllocationUnit[]>;
};

/** Soft cost of a run, computed at most once and cached on the result. */
function softCostOf(result: SolverResult, data: AppData): number {
  result.softCost ??= scoreSchedule(data, result.schedule).softCost;
  return result.softCost;
}

/**
 * Rank two completed runs. Lower is better.
 *
 * Feasibility dominates: a schedule that teaches more of the curriculum beats a
 * prettier one that teaches less.
 *
 * `unitPlacements.size` used to be the only tiebreak, but it is an exact
 * restatement of `unplacedGangs` — measured across 15 restarts on a 361-unit
 * school, the two always summed to the unit total — so it could never separate
 * anything the first test had not already decided. `softCost` replaces it with a
 * question about quality (see `logic/objective.ts`).
 *
 * Measured honestly, this changes nothing on a hard instance: holding restart
 * count fixed at 6 runs × 3 seeds on a 361-unit school, output was identical
 * with and without the quality term, because the best run's unplaced count is
 * unique and the comparison never reaches here. It is kept because it is free
 * (scoring is lazy, so no tie costs nothing) and because it is live exactly
 * where the dead placement test never was: on schools the solver can satisfy,
 * where many restarts reach zero unplaced and tie, and the winner would
 * otherwise be whichever finished first.
 */
function compareSolverResults(a: SolverResult, b: SolverResult, data: AppData): number {
  if (a.unplacedGangs !== b.unplacedGangs) {
    return a.unplacedGangs - b.unplacedGangs;
  }
  return softCostOf(a, data) - softCostOf(b, data);
}

/**
 * Generate perturbed scoring weights for a calibration run.
 * Each weight is scaled by a random factor in [1-amplitude, 1+amplitude].
 * Run 0 always uses the original (unperturbed) weights as a baseline.
 */
function perturbWeights(
  baseOverrides: ScoringWeightOverrides | undefined,
  runIndex: number,
  seed: number,
): ScoringWeightOverrides | undefined {
  if (runIndex === 0) return baseOverrides;

  const rng = createSeededRng(seed + runIndex * 7919);
  const amplitude = 0.3;
  const base = { ...SCORING_WEIGHTS, ...baseOverrides };
  const perturbed: ScoringWeightOverrides = {};

  for (const key of Object.keys(SCORING_WEIGHTS) as ScoringWeightKey[]) {
    const original = base[key];
    const factor = 1 + (rng() * 2 - 1) * amplitude;
    perturbed[key] = Math.round(original * factor);
  }

  return perturbed;
}

function withPerturbedWeights(
  data: AppData,
  overrides: ScoringWeightOverrides | undefined,
): AppData {
  if (!overrides) return data;
  return {
    ...data,
    settings: { ...data.settings, scoringWeightOverrides: overrides },
  };
}

function runSingleSolve(
  units: AllocationUnit[],
  data: AppData,
  onProgress: SolverProgressCallback | undefined,
  options: SolverOptions,
  runIndex: number,
  shouldAbort?: () => boolean,
): SolverResult {
  const teacherMap = new Map<string, Teacher>(data.teachers.map((t) => [t.id, t]));
  const subjectMap = new Map<string, Subject>(data.subjects.map((s) => [s.id, s]));
  const classMap = new Map<string, ClassGroup>(data.classes.map((c) => [c.id, c]));
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

  const mrvCache = new MrvCache(data, gangMap, teacherMap, subjectMap, classMap, roomMap);

  const reportConstructionProgress = (placed: number, total: number, unplacedCount: number) => {
    if (shouldAbort?.()) return false;
    return onProgress?.("CONSTRUCTION", placed, total, unplacedCount) ?? true;
  };

  let rank1Queue = unplacedGangLeaders.filter((u) => u.priority >= PRIORITY_CRITICAL);
  let remainingAfterRank1 = unplacedGangLeaders.filter((u) => u.priority < PRIORITY_CRITICAL);

  if (!MRV_CRITICAL_FIRST) {
    rank1Queue = [...unplacedGangLeaders];
    remainingAfterRank1 = [];
  }

  const rank1Result = runConstructionQueue(
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
    mrvCache,
    shouldAbort,
  );
  steps = rank1Result.steps;
  gangsPlaced = rank1Result.gangsPlaced;
  backtrackAttempts = rank1Result.backtrackAttempts;

  const levels = Array.from(new Set(remainingAfterRank1.map((u) => u.rankLevel))).sort(
    (a, b) => b - a,
  );

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
      mrvCache,
      shouldAbort,
    );
    steps = levelResult.steps;
    gangsPlaced = levelResult.gangsPlaced;
    backtrackAttempts = levelResult.backtrackAttempts;
  }

  let repairSteps = 0;
  const tabu = new TabuManager({ tenure: TABU_TENURE_DEFAULT });

  const repairQueue = [...unplacedDuringConstruction].sort((a, b) => b.rankLevel - a.rankLevel);
  const repairSet = new Set(repairQueue.map((u) => getGangId(u)));
  const repairController = new RepairController(repairQueue.length);

  tabu.adaptToSize(repairQueue.length);

  while (repairQueue.length > 0 && repairSteps < MAX_REPAIR_STEPS) {
    repairSteps++;

    if (shouldAbort?.()) {
      break;
    }

    if (onProgress && repairSteps % 10 === 0) {
      const unplacedNow = countUnplacedGangs(repairQueue, repairController);
      if (!onProgress("REPAIR", repairSteps, MAX_REPAIR_STEPS, unplacedNow)) {
        break;
      }
    }

    if (repairSteps % TABU_CLEANUP_FREQUENCY === 0) {
      tabu.cleanup(repairSteps);
    }

    const leader = repairQueue.shift()!;
    const gangId = getGangId(leader);
    repairSet.delete(gangId);
    tabu.recordGangAttempt(gangId);

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

    repairController.recordProgress(countUnplacedGangs(repairQueue, repairController));

    if (repairController.shouldDiversify()) {
      tabu.recordStagnation();
      const shaken = diversifyRepairState(state, data, gangMap, unitMap, repairQueue, repairSet);
      if (shaken > 0) {
        repairController.resetStagnation();
        repairController.recordProgress(countUnplacedGangs(repairQueue, repairController));
      }
    }
  }

  tabu.cleanup(repairSteps);

  const finalConflicts: Conflict[] = [];
  const reportedUnits = new Set<string>();

  // Report from the final grid, not from whichever queues happen to be
  // non-empty. `unplacedGangs` was already derived from `state.unitPlacements`
  // while the conflict rows came from `repairQueue` + abandoned leaders, and the
  // two disagreed: on the reference school the solver reported 5 unplaced gangs
  // and zero conflict rows explaining them, because a gang evicted during repair
  // and never re-placed belongs to neither queue. Sharing one source of truth
  // makes that divergence unrepresentable.
  unplacedGangLeaders.forEach((leader) => {
    const gangUnits = gangMap.get(getGangId(leader));
    if (!gangUnits) return;
    if (gangUnits.every((u) => state.unitPlacements.has(u.id))) return;
    reportUnplacedLeader(leader);
  });

  function reportUnplacedLeader(leader: AllocationUnit) {
    const gangId = getGangId(leader);
    if (reportedUnits.has(gangId)) return;
    reportedUnits.add(gangId);

    // Name the binding constraint instead of shrugging. Runs once per unplaced
    // lesson, after the search, so it costs nothing during the solve itself.
    const diagnosis = diagnoseUnplacedGang(state, data, gangMap.get(gangId) ?? [leader], {
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
    });
    const kind = leader.duration === 2 ? "Double" : "Single";

    leader.classIds.forEach((cid, idx) => {
      const cls = classMap.get(cid);
      finalConflicts.push({
        classId: cid,
        className: cls?.name || leader.classNames[idx],
        subjectId: leader.subjectId,
        subjectName: leader.subjectName,
        teacherName: leader.teacherNames.join(", "),
        reason: `Unplaced ${kind} Period. ${diagnosis.summary}`,
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
    totalRuns: 1,
    unplacedGangs: countUnplacedGangLeaders(unplacedGangLeaders, gangMap, state),
    perfectRuns: 0,
    gangLeaders: unplacedGangLeaders,
    gangMap,
  };
}

/**
 * CSP SOLVER: Construction + repair with optional multi-run restarts.
 *
 * Two modes:
 * - **Count-driven** (`runs` set, no `timeBudgetMs`): runs exactly N attempts.
 * - **Time-driven** (`timeBudgetMs` set): keeps spawning runs until the budget
 *   elapses, guaranteeing at least `runs` attempts (default 3) and continuing
 *   with more if time permits. This fills the entire solve window with work.
 *
 * When `calibrate` is true, each run uses perturbed scoring weights.
 */
export const solveSmart = (
  units: AllocationUnit[],
  data: AppData,
  onProgress?: SolverProgressCallback,
  options: SolverOptions = {},
): SolverResult => {
  const minRuns = Math.max(1, options.runs ?? 1);
  const calibrate = options.calibrate === true && minRuns > 1;
  const calibrationSeed = options.seed ?? Date.now();
  const timeBudget = options.timeBudgetMs;
  const clockStartMs = options.clockStartMs ?? (timeBudget !== undefined ? Date.now() : 0);

  let bestResult: SolverResult | null = null;
  let bestUnplacedGangsSeen = Number.POSITIVE_INFINITY;
  let perfectRunsFound = 0;
  let run = 0;

  // Tail of the budget reserved for post-feasibility optimisation. It is only
  // claimed once a feasible schedule exists: while lessons are still unplaced,
  // searching for one matters more than polishing, so the solve phase keeps the
  // whole window and the optimiser simply never runs.
  const optimiseReserveMs =
    timeBudget !== undefined ? Math.floor(timeBudget * OPTIMISE_BUDGET_SHARE) : 0;

  const isSolvePhaseOver = (): boolean => {
    if (timeBudget === undefined) return false;
    const elapsed = Date.now() - clockStartMs;
    const feasibleAlready = bestResult !== null && bestResult.unplacedGangs === 0;
    const limit = feasibleAlready ? timeBudget - optimiseReserveMs : timeBudget;
    return elapsed >= limit;
  };

  const shouldAbort = (): boolean => isSolvePhaseOver();

  if (minRuns === 1 && !timeBudget) {
    return runSingleSolve(units, data, onProgress, options, 0);
  }

  const shouldContinueRuns = (): boolean => {
    // The same boundary the runs themselves abort on. Using the full budget here
    // would keep spawning attempts into the reserved window that abort on their
    // first check — 96 empty restarts in one measured 60s solve.
    if (isSolvePhaseOver()) return false;
    // Count-only mode: stop early once every unit is placed.
    if (timeBudget === undefined && bestResult && bestResult.unplacedGangs === 0) {
      return false;
    }
    if (run < minRuns) return true;
    return timeBudget !== undefined;
  };

  while (shouldContinueRuns()) {
    const runData =
      calibrate && run > 0
        ? withPerturbedWeights(
            data,
            perturbWeights(data.settings.scoringWeightOverrides, run, calibrationSeed),
          )
        : data;

    const currentRun = run;
    let runCancelled = false;
    const wrappedProgress: SolverProgressCallback = (phase, progress, total, conflicts) => {
      bestUnplacedGangsSeen = Math.min(bestUnplacedGangsSeen, conflicts);
      const elapsedMs = clockStartMs ? Date.now() - clockStartMs : 0;
      const bestUnplaced =
        bestUnplacedGangsSeen === Number.POSITIVE_INFINITY ? conflicts : bestUnplacedGangsSeen;
      const continueSolving =
        onProgress?.(phase, progress, total, conflicts, {
          runIndex: currentRun + 1,
          bestUnplaced,
          perfectRuns: perfectRunsFound,
          elapsedMs,
          timeBudgetMs: timeBudget,
        }) ?? true;
      if (!continueSolving) {
        runCancelled = true;
      }
      return continueSolving;
    };

    const result = runSingleSolve(units, runData, wrappedProgress, options, run, shouldAbort);
    bestUnplacedGangsSeen = Math.min(bestUnplacedGangsSeen, result.unplacedGangs);
    if (isPerfectGeneratedSchedule(data, result.schedule)) {
      perfectRunsFound++;
    }
    // Scored against the school's real settings, never the perturbed `runData`:
    // calibration may distort what construction chases, but not what "good" means.
    if (!bestResult || compareSolverResults(result, bestResult, data) < 0) {
      bestResult = result;
    }

    if (onProgress) {
      const elapsedMs = clockStartMs ? Date.now() - clockStartMs : 0;
      const bestUnplaced =
        bestUnplacedGangsSeen === Number.POSITIVE_INFINITY
          ? result.unplacedGangs
          : bestUnplacedGangsSeen;
      const isPerfect = isPerfectGeneratedSchedule(data, result.schedule);
      onProgress("RUN_COMPLETE", currentRun + 1, run, result.unplacedGangs, {
        runIndex: currentRun + 1,
        bestUnplaced,
        perfectRuns: perfectRunsFound,
        elapsedMs,
        timeBudgetMs: timeBudget,
        scheduleSnapshot: isPerfect ? result.schedule : undefined,
      });
    }

    run++;

    if (runCancelled || isSolvePhaseOver()) {
      break;
    }
  }

  // --- POST-FEASIBILITY OPTIMISATION ---
  // Everything above answers "can every lesson be placed?" and stops the moment
  // it can. Whatever feasible arrangement the search happened to land on is what
  // the school receives. Spend the reserved tail asking whether a better one
  // exists, measured by the same objective used to rank runs.
  const best = bestResult!;
  if (timeBudget !== undefined && best.unplacedGangs === 0) {
    const deadlineMs = clockStartMs + timeBudget;
    if (Date.now() < deadlineMs) {
      const report = optimiseSchedule(
        best.state,
        data,
        best.gangLeaders,
        best.gangMap,
        {
          teacherMap: new Map(data.teachers.map((t) => [t.id, t])),
          subjectMap: new Map(data.subjects.map((s) => [s.id, s])),
          classMap: new Map(data.classes.map((c) => [c.id, c])),
          roomMap: new Map(data.rooms.map((r) => [r.id, r])),
        },
        { deadlineMs, rng: createSeededRng(calibrationSeed + 104729) },
      );
      best.schedule = best.state.schedule;
      best.softCost = report.after.softCost;
      onProgress?.("OPTIMISE", report.accepted, report.probes, 0, {
        runIndex: run,
        bestUnplaced: 0,
        perfectRuns: perfectRunsFound,
        elapsedMs: Date.now() - clockStartMs,
        timeBudgetMs: timeBudget,
      });
    }
  }

  return { ...best, totalRuns: run, perfectRuns: perfectRunsFound };
};

/**
 * Worker entry: time-driven solver that fills the full time budget.
 * Keeps spawning seeded, shuffled, calibrated runs until 60 seconds elapse,
 * returning the best result found across all attempts.
 */
export const solveSmartWithRestarts = (
  units: AllocationUnit[],
  data: AppData,
  onProgress?: SolverProgressCallback,
  options: SolverOptions = {},
): SolverResult => {
  const dynamicBudgetMs = data.settings.solverTimeoutMinutes
    ? data.settings.solverTimeoutMinutes * 60000
    : SOLVER_TARGET_MS;

  return solveSmart(units, data, onProgress, {
    runs: options.runs ?? SOLVER_RUN_COUNT,
    timeBudgetMs: options.timeBudgetMs ?? dynamicBudgetMs,
    clockStartMs: options.clockStartMs,
    calibrate: options.calibrate ?? true,
    shuffleConstruction: options.shuffleConstruction ?? true,
    seed: options.seed,
  });
};
