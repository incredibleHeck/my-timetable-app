import { AllocationUnit, SchedulerState } from "./types";
import { AppData } from "../../../types";

export const calculateScore = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  unit: AllocationUnit
): number => {
  let score = 0;
  const maxPeriods = data.settings.periodsPerDay;

  // 1. Morning Bias (Pack mornings first)
  // Higher periods (lower index) get higher score
  score += (maxPeriods - p) * 2;

  // 2. Subject Distribution (Spread across week)
  // Penalize if class already has this subject on adjacent days?
  // (Simplified: just prefer days where they don't have it yet, though Hard Constraint handles limits)

  // 3. Teacher Continuity
  // Bonus if teacher is already teaching immediately before/after
  unit.teacherIds.forEach((tid) => {
    const prev = state.teacherOccupancy[tid][d][p - 1];
    if (prev) score += 5; // Grouping bonus
  });

  // 4. Randomness (Break ties)
  score += Math.random();

  return score;
};
