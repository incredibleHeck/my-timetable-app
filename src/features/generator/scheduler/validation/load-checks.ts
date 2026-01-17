import { ValidationContext, ValidationResult } from "./types";

export const checkTeacherLoad = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>
): ValidationResult | null => {
  const { data, teacherId, targetDay, maxPeriods } = ctx;

  const teacher = data.teachers.find((t) => t.id === teacherId);
  const maxDailyLoad =
    teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;

  let currentDailyLoad = 0;
  let consecutiveCount = 0;

  for (let p = 0; p < maxPeriods; p++) {
    let isLesson = false;

    // Check if we are placing a lesson here
    if (proposedSlots.has(p)) {
      isLesson = true;
    }
    // Check if there is already a lesson here (that we aren't moving)
    else {
      for (const cId of Object.keys(data.schedule)) {
        const s = data.schedule[cId]?.[targetDay]?.[p];
        if (s && s.teacherId === teacherId) {
          if (cId === ctx.classId && ignoredSlots.has(p)) continue;
          isLesson = true;
          break;
        }
      }
    }

    if (isLesson) {
      currentDailyLoad++;
      consecutiveCount++;
      if (consecutiveCount > maxConsecutive) {
        return {
          valid: false,
          message: `Exceeds consecutive limit (${maxConsecutive})`,
          severity: "MEDIUM",
        };
      }
    } else {
      consecutiveCount = 0;
    }
  }

  if (currentDailyLoad > maxDailyLoad) {
    return {
      valid: false,
      message: `Exceeds daily limit (${maxDailyLoad})`,
      severity: "MEDIUM",
    };
  }

  return null;
};
