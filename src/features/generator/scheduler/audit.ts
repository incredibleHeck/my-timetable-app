import { AppData, Conflict } from "../../../types";
import { SchedulerState } from "./types";
import { validateFullSchedule } from "./validation/index";

/**
 * CONFLICT AUDIT: The Final Diagnostic
 * Generates a detailed report of all rule violations and curriculum gaps.
 */
export const runConflictAudit = (data: AppData, state: SchedulerState): {
  conflicts: Conflict[];
  curriculumGaps: any[];
  statistics: any;
} => {
  const conflicts: Conflict[] = [];
  const curriculumGaps: any[] = [];

  // 1. RULE VALIDATION SCAN
  // We use the full validator to find any hard or soft violations
  const ruleConflicts = validateFullSchedule(data, state);
  conflicts.push(...ruleConflicts);

  // 2. CURRICULUM INTEGRITY SCAN
  // Checks if any subject received fewer periods than defined in the curriculum
  data.classes.forEach((cls) => {
    cls.curriculum.forEach((item) => {
      const required = (item.singles || 0) + (item.doubles || 0) * 2;
      let actual = 0;

      // Scan the class's schedule in the state
      // Use configured days or default to 5
      const days = (data.settings as any).daysPerWeek || 5;
      
      for (let d = 0; d < days; d++) {
        const daySched = state.schedule[cls.id]?.[d];
        if (!daySched) continue;

        Object.values(daySched).forEach((slot: any) => {
          // We only count 'heads' of lessons (isFixed = false) to avoid double counting
          if (slot.subjectId === item.subjectId && !slot.isFixed) {
            actual += (slot.duration || 1);
          }
        });
      }

      if (actual < required) {
        curriculumGaps.push({
          classId: cls.id,
          className: cls.name,
          subjectId: item.subjectId,
          missing: required - actual,
          message: `${cls.name} is missing ${required - actual} periods of ${item.subjectId}`
        });
      }
    });
  });

  // 3. STATISTICAL SUMMARY
  const statistics = {
    totalLessonsPlaced: Array.from(state.unitPlacements.keys()).length,
    teacherUtilization: calculateTeacherUtilization(state, data),
    roomUtilization: calculateRoomUtilization(state, data)
  };

  return { conflicts, curriculumGaps, statistics };
};

/**
 * Helper to calculate how 'busy' teachers are (useful for balancing)
 */
function calculateTeacherUtilization(state: SchedulerState, data: AppData) {
  const stats: Record<string, number> = {};
  data.teachers.forEach(t => {
    let totalPeriods = 0;
    const days = (data.settings as any).daysPerWeek || 5;
    if (state.teacherDailyLoad[t.id]) {
      for (let d = 0; d < days; d++) {
        totalPeriods += state.teacherDailyLoad[t.id][d] || 0;
      }
    }
    stats[t.id] = totalPeriods;
  });
  return stats;
}

/**
 * Helper to calculate how 'busy' rooms are
 */
function calculateRoomUtilization(state: SchedulerState, data: AppData) {
  const stats: Record<string, number> = {};
  const days = (data.settings as any).daysPerWeek || 5;
  const periods = data.settings.periodsPerDay; // Max periods approximation

  data.rooms.forEach(r => {
    let occupiedCount = 0;
    if (state.roomOccupancy[r.id]) {
        for (let d = 0; d < days; d++) {
            if (state.roomOccupancy[r.id][d]) {
                occupiedCount += state.roomOccupancy[r.id][d].filter(u => u !== null).length;
            }
        }
    }
    stats[r.id] = occupiedCount;
  });
  return stats;
}
