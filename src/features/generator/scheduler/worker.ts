/* eslint-disable no-restricted-globals */
import { AppData } from "../../../types";
import { ScheduleResult, Conflict } from "../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";
import { validateFullSchedule } from "./validation";

const ctx: Worker = self as any;

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;

  // 1. Prepare Units ONCE (flatten curriculum)
  const baseUnits = prepareAllocationUnits(data);

  const MAX_ITERATIONS = 500;
  const TIME_LIMIT = 20000;

  let bestSchedule: ScheduleResult = {};
  let minConflictCount = Infinity;
  let bestConflicts: Conflict[] = [];

  const startTime = Date.now();
  let actualIterations = 0;

  try {
    for (let i = 0; i < MAX_ITERATIONS; i++) {
      actualIterations = i + 1;
      if (Date.now() - startTime > TIME_LIMIT && i > 0) break;

      // 2. STOCHASTIC PERTURBATION
      // Shuffle the units slightly differently each time to explore new paths.
      // We keep the priority sort but shuffle items with EQUAL priority.
      const iterationUnits = [...baseUnits]; // Clone

      // "Soft Shuffle": Randomize order but respect High Priority groups
      // (Simple approach: full shuffle then re-sort by priority)
      for (let j = iterationUnits.length - 1; j > 0; j--) {
        const r = Math.floor(Math.random() * (j + 1));
        [iterationUnits[j], iterationUnits[r]] = [
          iterationUnits[r],
          iterationUnits[j],
        ];
      }
      // Re-apply the heuristic sort so hard stuff is still first,
      // but "Math 2A" vs "English 2A" order might flip.
      iterationUnits.sort((a, b) => b.priority - a.priority);

      // 3. Run Solver
      const { schedule, conflicts: solverConflicts } = solveSmart(
        iterationUnits,
        data
      );

      // 4. Validate
      const dataWithSchedule = { ...data, schedule };
      const validationConflicts = validateFullSchedule(dataWithSchedule);

      // Filter out duplicate conflicts if any
      const totalConflicts = [...solverConflicts, ...validationConflicts];
      const count = totalConflicts.length;

      // 5. Keep Best
      if (count < minConflictCount) {
        minConflictCount = count;
        bestSchedule = schedule;
        bestConflicts = totalConflicts;

        // Progress update on improvement
        ctx.postMessage({
          type: "progress",
          payload: { iteration: i, conflicts: minConflictCount },
        });

        if (count === 0) break;
      }

      // Periodic update
      if (i % 50 === 0) {
        ctx.postMessage({
          type: "progress",
          payload: { iteration: i, conflicts: minConflictCount },
        });
      }
    }

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
