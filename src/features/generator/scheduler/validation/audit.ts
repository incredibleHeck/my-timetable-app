import { AppData, Conflict } from "../../../../types";
import { SchedulerState } from "../core/types";
import { getDaysPerWeek } from "../utils/utils";
import { auditFinalSchedule } from "./index";
import { detectCurriculumGaps } from "./final-conflicts";

/**
 * ARCHITECT NOTES:
 * 1. Performance: Uses trackers for instant curriculum audits.
 * 2. Accuracy: Conflicts for reporting come from auditFinalSchedule on the committed grid.
 */

export const runConflictAudit = (
  data: AppData,
  state: SchedulerState
): {
  conflicts: Conflict[];
  curriculumGaps: ReturnType<typeof detectCurriculumGaps>;
  statistics: {
    totalLessonsPlaced: number;
    teacherUtilization: Record<string, number>;
    roomUtilization: Record<string, number>;
  };
} => {
  const scheduleData = { ...data, schedule: state.schedule };
  const conflicts = auditFinalSchedule(scheduleData);
  const curriculumGaps = detectCurriculumGaps(scheduleData, state);

  const statistics = {
    totalLessonsPlaced: state.unitPlacements.size,
    teacherUtilization: calculateTeacherUtilization(state, data),
    roomUtilization: calculateRoomUtilization(state, data),
  };

  return { conflicts, curriculumGaps, statistics };
};

function calculateTeacherUtilization(state: SchedulerState, data: AppData) {
  const stats: Record<string, number> = {};
  data.teachers.forEach((t) => {
    let total = 0;
    const dailyLoads = state.teacherDailyLoad[t.id];
    if (dailyLoads) {
      Object.values(dailyLoads).forEach((load) => {
        total += load as number;
      });
    }
    stats[t.id] = total;
  });
  return stats;
}

function calculateRoomUtilization(state: SchedulerState, data: AppData) {
  const stats: Record<string, number> = {};
  const days = getDaysPerWeek(data.settings);

  data.rooms.forEach((r) => {
    let occupiedCount = 0;
    const grid = state.roomOccupancy[r.id];
    if (grid) {
      for (let d = 0; d < days; d++) {
        if (grid[d]) {
          for (let p = 0; p < grid[d].length; p++) {
            if (grid[d][p]) occupiedCount++;
          }
        }
      }
    }
    stats[r.id] = occupiedCount;
  });
  return stats;
}
