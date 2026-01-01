import { Teacher } from "../../types";
import { AllocationUnit } from "./types";

/**
 * Helper: efficient constraint counting.
 */
const countBlockedSlots = (t: Teacher): number => {
  let count = 0;
  for (let d = 0; d < t.constraints.length; d++) {
    const row = t.constraints[d];
    for (let p = 0; p < row.length; p++) {
      if (row[p]) count++;
    }
  }
  return count;
};

export const calculatePriority = (
  unit: AllocationUnit,
  teachers: Teacher[]
): number => {
  let score = 0;

  // 1. COMPLEXITY: Joint Classes (Highest Priority)
  // These are the "Big Rocks" that must go in the jar first.
  if (unit.classIds.length > 1) score += 10000;

  // 2. TEACHER AVAILABILITY (The True Bottleneck)
  // If a teacher is blocked 50% of the time, they MUST go first,
  // regardless of whether they teach Math or PE.
  for (const tid of unit.teacherIds) {
    const teacher = teachers.find((t) => t.id === tid);
    if (teacher) {
      // DRASTICALLY Increased weight: 50 points per blocked period.
      // A teacher with 10 blocked slots gets +500 priority.
      score += countBlockedSlots(teacher) * 50;
    }
  }

  // 3. DURATION: Double Periods
  // Harder to fit than singles.
  if (unit.duration === 2) score += 100;

  // 4. REMOVED: Core Subject Bias
  // We do NOT boost Math/English here.
  // Doing so pushes flexible Math teachers ahead of restricted Art teachers, causing failures.
  // The "Morning Preference" will be handled in the Solver's scoring logic instead.

  return score;
};
