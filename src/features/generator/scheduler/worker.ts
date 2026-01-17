/* eslint-disable no-restricted-globals */
import { AppData } from "../../../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";
import { runConflictAudit } from "./audit";

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const startTime = Date.now();
  const TIME_LIMIT = 28000; // 28 seconds (browser safety margin)

  try {
    // 1. PREPARATION
    // Units are strictly curriculum-compliant and prioritized (MRV Initial State)
    const units = prepareAllocationUnits(data);

    // 2. HYBRID SOLVER (Construction + Repair)
    // We pass a progress callback to keep the UI responsive and informative
    const { schedule, state, iterations } = solveSmart(
      units, 
      data, 
      (phase, progress, total, currentConflictCount) => {
        // Safety check to prevent worker hanging
        if (Date.now() - startTime > TIME_LIMIT) {
           return false; // Tells the solver to stop and return the current best state
        }

        ctx.postMessage({
          type: "progress",
          payload: { 
            phase, 
            iteration: progress, 
            total,
            conflicts: currentConflictCount 
          }
        });
        return true;
      }
    );

    // 3. AUDIT & REPORT
    const audit = runConflictAudit(data, state);

    // 4. FINAL SUCCESS RESPONSE
    // Even if there are lingering conflicts, we return the schedule
    // so the user can see *where* the bottlenecks are.
    ctx.postMessage({
      type: "success",
      payload: {
        schedule,
        conflicts: audit.conflicts,
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
      payload: error instanceof Error ? error.message : "Internal Scheduler Error",
    });
  }
};