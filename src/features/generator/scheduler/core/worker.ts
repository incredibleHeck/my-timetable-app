/* eslint-disable no-restricted-globals */
import { AppData } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { solveSmartWithRestarts } from "../solver/solver";
import { runConflictAudit } from "../validation/audit";
import { auditFinalSchedule, dedupeConflicts } from "../validation";
import { SOLVER_TIME_LIMIT_MS } from "../constants";

const ctx: Worker = self as any;

/**
 * HELPER: Fast Core Subject Check
 * Identifies core subjects for pedagogical scoring (Math, Science, etc.)
 */
const CORE_KEYWORDS = [
  "math",
  "english",
  "science",
  "physics",
  "chem",
  "bio",
  "history",
  "geography",
];
const isCoreSubject = (name: string) => {
  const n = name.toLowerCase();
  return CORE_KEYWORDS.some((k) => n.includes(k));
};

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const startTime = Date.now();

  try {
    // 1. PREPARATION
    const units = prepareAllocationUnits(data);

    units.forEach((u) => {
      if (u.isCore === undefined) {
        u.isCore = isCoreSubject(u.subjectName || "");
      }
    });

    // 2. HYBRID SOLVER
    const { schedule, state, iterations, conflicts: unplacedConflicts } =
      solveSmartWithRestarts(
      units,
      data,
      (phase, progress, total, currentConflictCount) => {
        if (Date.now() - startTime > SOLVER_TIME_LIMIT_MS) {
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
    );

    // 3. Statistics + conflicts (main thread audit on final grid)
    const audit = runConflictAudit(data, state);
    const scheduleData = { ...data, schedule };
    const auditConflicts = auditFinalSchedule(scheduleData, { mode: "generated" });
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
