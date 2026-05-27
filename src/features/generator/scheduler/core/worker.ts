/* eslint-disable no-restricted-globals */
import { AppData } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { resolveSubjectIsCore } from "../logic/subject-core";
import { solveSmartWithRestarts } from "../solver/solver";
import { runConflictAudit } from "../validation/audit";
import { auditFinalSchedule, dedupeConflicts } from "../validation";
import { SOLVER_TIME_LIMIT_MS, SOLVER_TARGET_MS } from "../constants";

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const startTime = Date.now();

  try {
    // 1. PREPARATION
    const units = prepareAllocationUnits(data);

    const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));

    units.forEach((u) => {
      if (u.isCore === undefined) {
        u.isCore = resolveSubjectIsCore(
          subjectMap.get(u.subjectId),
          u.subjectName,
        );
      }
    });

    // 2. HYBRID SOLVER
    const { schedule, state, iterations, conflicts: unplacedConflicts } =
      solveSmartWithRestarts(
        units,
        data,
        (phase, progress, total, currentConflictCount) => {
          if (Date.now() - startTime >= SOLVER_TARGET_MS) {
            return false;
          }

          ctx.postMessage({
            type: "progress",
            payload: {
              phase,
              iteration: progress,
              total,
              conflicts: currentConflictCount,
            },
          });
          return true;
        },
        { clockStartMs: startTime },
      );

    if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) {
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
      },
    });
  } catch (error) {
    console.error("Critical Worker Failure:", error);
    ctx.postMessage({
      type: "error",
      payload:
        error instanceof Error ? error.message : "Internal Scheduler Error",
    });
  }
};
