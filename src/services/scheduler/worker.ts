import { generateSchedule } from "./index";
import { AppData } from "../../types";

// Listen for messages from the Main Thread
self.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const MAX_TIME_MS = 3000; // Increased to 3s since UI won't freeze now
  const startTime = performance.now();

  let bestSchedule = data.schedule;
  let bestConflicts = data.conflicts;
  // Initialize with current conflict count (or infinity if starting fresh)
  let minConflictCount = data.conflicts.length || Infinity;
  let iterations = 0;

  try {
    // The "Optimization Loop"
    // We run this as fast as possible inside the worker
    while (performance.now() - startTime < MAX_TIME_MS) {
      // 1. Generate a candidate
      const result = generateSchedule(data);
      const count = result.conflicts.length;

      // 2. Is it better?
      if (count < minConflictCount) {
        minConflictCount = count;
        bestSchedule = result.schedule;
        bestConflicts = result.conflicts;

        // Optional: Post progress back to UI immediately if we find a big improvement
        // self.postMessage({ type: 'progress', conflicts: minConflictCount });
      }

      // 3. Perfect score? Stop early.
      if (count === 0) {
        break;
      }

      iterations++;
    }

    // Send the best result back to the Main Thread
    self.postMessage({
      type: "success",
      payload: {
        schedule: bestSchedule,
        conflicts: bestConflicts,
        iterations,
        duration: performance.now() - startTime,
      },
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      payload: error,
    });
  }
};
