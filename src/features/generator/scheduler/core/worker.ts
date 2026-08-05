import { AppData } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { resolveSubjectIsCore } from "../logic/subject-core";
import { solveSmartWithRestarts } from "../solver/solver";
import { runConflictAudit } from "../validation/audit";
import { auditFinalSchedule, dedupeConflicts } from "../validation";
import { resolveSolverBudgetMs, resolveSolverHardLimitMs } from "../constants";

const ctx: Worker = self as unknown as Worker;

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const startTime = Date.now();
  // Both deadlines below come from the school's configured limit. They were
  // flat constants, so the worker cut every run off at 60s however many
  // minutes had been asked for.
  const budgetMs = resolveSolverBudgetMs(data.settings);
  const hardLimitMs = resolveSolverHardLimitMs(data.settings);

  try {
    // 1. PREPARATION
    const units = prepareAllocationUnits(data);

    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));

    units.forEach((u) => {
      if (u.isCore === undefined) {
        u.isCore = resolveSubjectIsCore(subjectMap.get(u.subjectId));
      }
    });

    // 2. HYBRID SOLVER
    const {
      schedule,
      state,
      iterations,
      conflicts: unplacedConflicts,
      runIndex,
      totalRuns,
      unplacedGangs,
      perfectRuns,
      reassignedTeachers,
    } = solveSmartWithRestarts(
      units,
      data,
      (phase, progress, total, currentConflictCount, meta) => {
        if (Date.now() - startTime >= budgetMs) {
          return false;
        }

        ctx.postMessage({
          type: "progress",
          payload: {
            phase,
            iteration: progress,
            total,
            conflicts: currentConflictCount,
            runIndex: meta?.runIndex ?? 1,
            bestUnplaced: meta?.bestUnplaced ?? currentConflictCount,
            perfectRuns: meta?.perfectRuns ?? 0,
            elapsedMs: meta?.elapsedMs ?? Date.now() - startTime,
            timeBudgetMs: meta?.timeBudgetMs ?? budgetMs,
            schedule: meta?.scheduleSnapshot,
          },
        });
        return true;
      },
      { clockStartMs: startTime },
    );

    if (Date.now() - startTime > hardLimitMs) {
      throw new Error("Solver exceeded hard time limit");
    }

    // 3. Statistics + conflicts (main thread audit on final grid)
    const audit = runConflictAudit(data, state);
    const scheduleData = { ...data, schedule };
    const auditConflicts = auditFinalSchedule(scheduleData, {
      mode: "generated",
    });
    const conflicts = dedupeConflicts([...auditConflicts, ...unplacedConflicts]);

    ctx.postMessage({
      type: "success",
      payload: {
        schedule,
        conflicts,
        curriculumGaps: audit.curriculumGaps,
        statistics: audit.statistics,
        iterations,
        duration: Date.now() - startTime,
        runIndex,
        totalRuns,
        unplaced: unplacedGangs,
        perfectRuns,
        // Only non-empty when the school enabled teacher reassignment. The main
        // thread has to write these into the curriculum, or the Workload screen
        // will keep naming the teacher who no longer takes the lesson.
        reassignedTeachers: reassignedTeachers ?? [],
      },
    });
  } catch (error) {
    console.error("Critical Worker Failure:", error);
    ctx.postMessage({
      type: "error",
      payload:
        error instanceof Error
          ? { message: error.message, stack: error.stack }
          : { message: "Internal Scheduler Error", stack: undefined },
    });
  }
};
