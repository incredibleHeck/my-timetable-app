import { AppData, TimeSlot } from "../../../types";
import { SchedulerState } from "./types";
import { calculateClassSchedule } from "../../../utils/timeUtils";

export const initializeState = (data: AppData): SchedulerState => {
  const days = (data.settings as any).daysPerWeek || 5;

  // FIX 1: Find the maximum periods required by ANY class
  const globalPeriods = data.settings.periodsPerDay;
  const maxClassPeriods = Math.max(
    ...data.classes.map((c) => c.periodCount || 0)
  );
  const maxPeriods = Math.max(globalPeriods, maxClassPeriods); // Use the larger of the two

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

  // 1. Pre-calculate Time Ranges
  data.classes.forEach((c) => {
    const structure = c.structure || data.settings.dayStructure;
    const ranges: TimeSlot[] = calculateClassSchedule(
      c,
      data.settings,
      structure
    );
    state.classTimeRanges.set(c.id, ranges);
  });

  // 2. Initialize Grids with MAX PERIODS
  data.classes.forEach((c) => {
    state.schedule[c.id] = {};
    state.classOccupancy[c.id] = Array(days)
      .fill(null)
      .map(() => Array(maxPeriods).fill(false));
    state.classDailySubjects[c.id] = {};
    for (let d = 0; d < days; d++)
      state.classDailySubjects[c.id][d] = new Set();
  });

  data.teachers.forEach((t) => {
    // FIX: Initialize with maxPeriods so we don't crash on period 9 or 10
    state.teacherOccupancy[t.id] = Array(days)
      .fill(null)
      .map(() => Array(maxPeriods).fill(false));
    state.teacherDailyLoad[t.id] = {};
    for (let d = 0; d < days; d++) state.teacherDailyLoad[t.id][d] = 0;

    // Apply Constraints
    if (t.constraints) {
      t.constraints.forEach((row, d) => {
        row.forEach((isBlocked, p) => {
          if (isBlocked && d < days && p < maxPeriods) {
            state.teacherOccupancy[t.id][d][p] = true;
          }
        });
      });
    }
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
