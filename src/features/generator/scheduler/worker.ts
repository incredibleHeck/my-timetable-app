/* eslint-disable no-restricted-globals */
import { AppData } from "../../../types";
import { ScheduleResult, Conflict } from "../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";
import { validateFullSchedule } from "./validation";

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;

  // 1. Prepare Units
  const units = prepareAllocationUnits(data);

  // CONFIGURATION
  // A standard run might try 200-400 iterations within 20 seconds
  const MAX_ITERATIONS = 500;
  const TIME_LIMIT = 20000; // 20 seconds

  let bestSchedule: ScheduleResult = {};
  let minConflictCount = Infinity;
  let bestConflicts: Conflict[] = [];

  const startTime = Date.now();
  let actualIterations = 0;

  try {
    // 2. Iteration Loop
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      actualIterations = i + 1;
      // Check Timer
      if (Date.now() - startTime > TIME_LIMIT && i > 0) break;

      // Run Solver
      const { schedule, conflicts: solverConflicts } = solveSmart(units, data);

      // Validate (Solver returns placement failures, Validator finds subtle logic errors)
      // Merge both for a true error count
      const dataWithSchedule = { ...data, schedule };
      const validationConflicts = validateFullSchedule(dataWithSchedule);
      const totalConflicts = [...solverConflicts, ...validationConflicts];

      const count = totalConflicts.length;

      // Keep the BEST result, not the latest
      if (count < minConflictCount) {
        minConflictCount = count;
        bestSchedule = schedule;
        bestConflicts = totalConflicts;

        // If perfect, stop early
        if (count === 0) break;
      }

      // Optional: Report progress back to UI every 5 iterations
      if (i % 5 === 0) {
        ctx.postMessage({
          type: "progress",
          payload: { iteration: i, conflicts: minConflictCount },
        });
      }
    }

    // 3. Return BEST Result
    ctx.postMessage({
      type: "success",
      payload: {
        schedule: bestSchedule,
        conflicts: bestConflicts,
        iterations: actualIterations,
        duration: Date.now() - startTime,
      },
    });
  } catch (error) {
    ctx.postMessage({
      type: "error",
      payload: error,
    });
  }
};
