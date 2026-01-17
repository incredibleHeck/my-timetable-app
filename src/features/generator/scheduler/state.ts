import { AppData, TimeSlot } from "../../../types";
import { SchedulerState } from "./types";
import { calculateClassSchedule } from "../../../utils/timeUtils";

/**
 * Helper to create a 2D boolean grid (Days x Periods)
 */
const createOccupancyGrid = (days: number, periods: number): boolean[][] => {
  return Array(days)
    .fill(null)
    .map(() => Array(periods).fill(false));
};

export const initializeState = (data: AppData): SchedulerState => {
  const days = (data.settings as any).daysPerWeek || 5;

  // 1. CALCULATE DIMENSIONS
  // Find the maximum periods required by ANY class vs Global Settings
  const globalPeriods = data.settings.periodsPerDay;
  const maxClassPeriods = Math.max(
    0,
    ...data.classes.map((c) => c.periodCount || 0)
  );
  const maxPeriods = Math.max(globalPeriods, maxClassPeriods);

  // 2. INITIALIZE EMPTY CONTAINERS
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

  // 3. INITIALIZE TEACHERS (Create grids first)
  data.teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = createOccupancyGrid(days, maxPeriods);
    state.teacherDailyLoad[t.id] = {};
    for (let d = 0; d < days; d++) state.teacherDailyLoad[t.id][d] = 0;

    // PRE-FILL: Teacher Constraints (Unavailable times)
    if (t.constraints) {
      t.constraints.forEach((row, d) => {
        if (d >= days) return;
        row.forEach((isBlocked, p) => {
          if (isBlocked && p < maxPeriods) {
            state.teacherOccupancy[t.id][d][p] = true;
          }
        });
      });
    }
  });

  // 4. INITIALIZE ROOMS
  (data.rooms || []).forEach((r) => {
    state.roomOccupancy[r.id] = createOccupancyGrid(days, maxPeriods);
  });

  // 5. INITIALIZE SINGLE RESOURCES
  data.subjects
    .filter((s) => s.isSingleResource)
    .forEach((s) => {
      state.singleResourceUsage[s.id] = createOccupancyGrid(days, maxPeriods);
    });

  // 6. INITIALIZE CLASSES & BURN IN FIXED SESSIONS
  data.classes.forEach((c) => {
    // A. Time Ranges
    const structure = c.structure || data.settings.dayStructure;
    const ranges: TimeSlot[] = calculateClassSchedule(
      c,
      data.settings,
      structure
    );
    state.classTimeRanges.set(c.id, ranges);

    // B. Basic Containers
    state.schedule[c.id] = {};
    state.classOccupancy[c.id] = createOccupancyGrid(days, maxPeriods);
    state.classDailySubjects[c.id] = {};
    for (let d = 0; d < days; d++)
      state.classDailySubjects[c.id][d] = new Set();

    // C. CRITICAL: Burn in Fixed Sessions
    // If the class has specific fixed sessions (not just global structure), mark them occupied.
    if (c.fixedSessions) {
      // fixedSessions is typically [day][period] = "SubjectID" or Object
      Object.keys(c.fixedSessions).forEach((dayStr) => {
        const d = parseInt(dayStr);
        if (isNaN(d) || d >= days) return;

        const daySessions = c.fixedSessions![d];
        if (!daySessions) return;

        Object.keys(daySessions).forEach((pStr) => {
          const p = parseInt(pStr);
          if (isNaN(p) || p >= maxPeriods) return;

          const val = daySessions[p];
          // If there is a value, this slot is TAKEN.
          if (val) {
            state.classOccupancy[c.id][d][p] = true;

            // Note: We don't populate 'schedule' fully here because we might not
            // have the full metadata (teacherId, etc) inside fixedSessions,
            // but marking occupancy prevents the solver from overwriting it.
          }
        });
      });
    }
  });

  return state;
};
