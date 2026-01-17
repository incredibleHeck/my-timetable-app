/* eslint-disable no-restricted-globals */
import { AppData } from "../../../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const startTime = Date.now();

  try {
    // 1. Prepare Units
    const units = prepareAllocationUnits(data);

    // 2. Run Smart Solver (Construction + Repair)
    // The solver handles construction (MRV) and repair (Min-Conflicts) internally.
    const { schedule, conflicts } = solveSmart(units, data, (phase, progress, total) => {
        ctx.postMessage({
            type: "progress",
            payload: { 
                phase, 
                iteration: progress, // Current step or count
                total,               // Max steps or total units
                // Heuristic: During construction, unplaced count is roughly conflict count
                conflicts: phase === "CONSTRUCTION" ? total - progress : 0 
            }
        });
    });

    // 3. Success
    ctx.postMessage({
      type: "success",
      payload: {
        schedule,
        conflicts,
        iterations: 1, // Single optimized run
        duration: Date.now() - startTime,
      },
    });

  } catch (error) {
    console.error("Worker Error:", error);
    ctx.postMessage({
      type: "error",
      payload: error,
    });
  }
};