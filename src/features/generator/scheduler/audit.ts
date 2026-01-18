import { AppData, Conflict, Teacher, Subject, ClassGroup, Room } from "../../../types";
import { SchedulerState } from "./types";
import { validateFullSchedule } from "./validation/index";

/**
 * ARCHITECT NOTES:
 * 1. Performance: Uses trackers for instant curriculum audits.
 * 2. Accuracy: Uses O(1) Validator to provide a Live conflict report.
 */

export const runConflictAudit = (
  data: AppData, 
  state: SchedulerState
): {
  conflicts: Conflict[];
  curriculumGaps: any[];
  statistics: any;
} => {
  const curriculumGaps: any[] = [];

  // 1. LIVE RULE VALIDATION (O(1))
  // We perform a final scan using the optimized validator to catch any
  // logical issues (Continuity, Gaps, Overlaps) in the final state.
  const conflicts = validateFullSchedule(data, state);

  // 2. CURRICULUM INTEGRITY SCAN (O(1) Instant Check)
  data.classes.forEach((cls) => {
    const durationMap = state.classSubjectDuration[cls.id] || {};

    cls.curriculum.forEach((item) => {
      const required = (item.singles || 0) + (item.doubles || 0) * 2;
      const actual = durationMap[item.subjectId] || 0;

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
    totalLessonsPlaced: state.unitPlacements.size,
    teacherUtilization: calculateTeacherUtilization(state, data),
    roomUtilization: calculateRoomUtilization(state, data)
  };

  return { conflicts, curriculumGaps, statistics };
};

function calculateTeacherUtilization(state: SchedulerState, data: AppData) {
  const stats: Record<string, number> = {};
  data.teachers.forEach(t => {
    let total = 0;
    const dailyLoads = state.teacherDailyLoad[t.id];
    if (dailyLoads) {
      Object.values(dailyLoads).forEach(load => {
        total += (load as number);
      });
    }
    stats[t.id] = total;
  });
  return stats;
}

function calculateRoomUtilization(state: SchedulerState, data: AppData) {
  const stats: Record<string, number> = {};
  const days = (data.settings as any).daysPerWeek || 5;

  data.rooms.forEach(r => {
    let occupiedCount = 0;
    const grid = state.roomOccupancy[r.id];
    if (grid) {
        for (let d = 0; d < days; d++) {
            if (grid[d]) {
                 for(let p=0; p<grid[d].length; p++) {
                     if (grid[d][p]) occupiedCount++;
                 }
            }
        }
    }
    stats[r.id] = occupiedCount;
  });
  return stats;
}
