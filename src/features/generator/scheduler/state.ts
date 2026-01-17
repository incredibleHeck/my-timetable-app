import { AppData } from "../../../types";
import { SchedulerState } from "./types";
import { calculateClassSchedule } from "../../../utils/timeUtils";

export const initializeState = (data: AppData): SchedulerState => {
  const days = (data.settings as any).daysPerWeek || 5;
  const maxPeriods = data.settings.periodsPerDay;

  const state: SchedulerState = {
    schedule: {},
    teacherOccupancy: {},
    classOccupancy: {},
    roomOccupancy: {},
    classDailySubjects: {},
    teacherDailyLoad: {},
    singleResourceUsage: {},
    classTimeRanges: new Map(),
  };

  // 1. Pre-calculate Time Ranges (The Optimization)
  data.classes.forEach((c) => {
    const structure = c.structure || data.settings.dayStructure;
    const ranges = calculateClassSchedule(c, data.settings, structure);
    state.classTimeRanges.set(c.id, ranges);
  });

  // 2. Initialize Grids
  data.classes.forEach((c) => {
    const pCount = Math.max(maxPeriods, c.periodCount || 0);
    state.schedule[c.id] = {};
    state.classOccupancy[c.id] = Array(days)
      .fill(null)
      .map(() => Array(pCount).fill(false));
    state.classDailySubjects[c.id] = {};
    for (let d = 0; d < days; d++)
      state.classDailySubjects[c.id][d] = new Set();
  });

  data.teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = Array(days)
      .fill(null)
      .map(() => Array(maxPeriods).fill(false));
    state.teacherDailyLoad[t.id] = {};
    for (let d = 0; d < days; d++) state.teacherDailyLoad[t.id][d] = 0;

    // Fixed Constraints
    t.constraints.forEach((row, d) => {
      row.forEach((isBlocked, p) => {
        if (isBlocked && d < days && p < maxPeriods) {
          state.teacherOccupancy[t.id][d][p] = true;
          state.teacherDailyLoad[t.id][d]++; // Blocked slots count as load
        }
      });
    });
  });

  (data.rooms || []).forEach((r) => {
    state.roomOccupancy[r.id] = Array(days)
      .fill(null)
      .map(() => Array(maxPeriods).fill(false));
  });

  data.subjects
    .filter((s) => s.isSingleResource)
    .forEach((s) => {
      state.singleResourceUsage[s.id] = Array(days)
        .fill(null)
        .map(() => Array(maxPeriods).fill(false));
    });

  return state;
};
