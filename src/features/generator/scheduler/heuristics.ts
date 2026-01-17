import { Teacher, AppData } from "../../../types";
import { AllocationUnit } from "./types";

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
  teachers: Teacher[],
  data: AppData // NEW: Add data here
): number => {
  let score = 0;

  // 1. Joint Classes (Highest Priority)
  if (unit.classIds.length > 1) score += 10000;

  // 2. Single Resource Subjects (High Priority)
  // These subjects (like P.E. or Computing) are bottlenecks
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  if (subject?.isSingleResource) {
    score += 5000;
  }

  // 3. Teacher Availability
  for (const tid of unit.teacherIds) {
    const teacher = teachers.find((t) => t.id === tid);
    if (teacher) {
      score += countBlockedSlots(teacher) * 50;
    }
  }

  // 4. Duration (Double periods)
  if (unit.duration === 2) score += 100;

  return score;
};
