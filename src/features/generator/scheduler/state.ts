import { AppData, TimeSlot } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { calculateClassSchedule } from "../../../utils/timeUtils";
import { getNextClassPeriod } from "./utils";

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
    unitLocations: new Map(),
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

export function applyGangToState(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: { d: number; p: number; p2: number; rooms: Record<string, string> }
) {
  const { d, p, p2, rooms } = move;

  gang.forEach((u) => {
    state.unitLocations.set(u.id, { day: d, period: p });
    const roomId = rooms[u.id];

    u.classIds.forEach((cid) => {
      if (!state.schedule[cid][d]) state.schedule[cid][d] = {};
      const entry = {
        subjectId: u.subjectId,
        teacherId: u.teacherIds[0],
        classId: cid,
        roomId: roomId,
        electiveBlockId: u.electiveBlockId,
        isFixed: false,
        unitId: u.id 
      };

      state.schedule[cid][d][p] = entry;
      state.classOccupancy[cid][d][p] = true;
      state.classDailySubjects[cid][d].add(u.subjectId);

      if (u.duration === 2) {
        state.schedule[cid][d][p2] = { ...entry, isFixed: true }; 
        state.classOccupancy[cid][d][p2] = true;
      }
    });

    u.teacherIds.forEach((tid) => {
      state.teacherOccupancy[tid][d][p] = true;
      state.teacherDailyLoad[tid][d]++;
      if (u.duration === 2) {
        state.teacherOccupancy[tid][d][p2] = true;
        state.teacherDailyLoad[tid][d]++;
      }
    });

    if (roomId) {
      state.roomOccupancy[roomId][d][p] = true;
      if (u.duration === 2) state.roomOccupancy[roomId][d][p2] = true;
    }

    if (state.singleResourceUsage[u.subjectId]) {
      state.singleResourceUsage[u.subjectId][d][p] = true;
      if (u.duration === 2)
        state.singleResourceUsage[u.subjectId][d][p2] = true;
    }
  });
}

export function removeGangFromState(state: SchedulerState, gang: AllocationUnit[], data: AppData) {
    gang.forEach(u => {
        const loc = state.unitLocations.get(u.id);
        if (!loc) return;
        const { day: d, period: p } = loc;
        state.unitLocations.delete(u.id);
        unassignUnit(state, u, d, p, data);
    });
}

export function unassignUnit(state: SchedulerState, unit: AllocationUnit, d: number, p: number, data: AppData) {
  const struct = data.settings.dayStructure;
  let p2 = -1;
  if (unit.duration === 2) {
      const next = getNextClassPeriod(p, struct, data.settings.periodsPerDay);
      if (next !== null) p2 = next;
  }

  let assignedRoomId: string | undefined;

  unit.classIds.forEach((cid) => {
    const entry = state.schedule[cid]?.[d]?.[p];
    if (entry) {
      assignedRoomId = entry.roomId;
      delete state.schedule[cid][d][p];
      state.classOccupancy[cid][d][p] = false;

      const hasOther = Object.values(state.schedule[cid][d]).some(s => s.subjectId === unit.subjectId);
      if (!hasOther) {
        state.classDailySubjects[cid][d].delete(unit.subjectId);
      }

      if (p2 !== -1) {
        delete state.schedule[cid][d][p2];
        state.classOccupancy[cid][d][p2] = false;
      }
    }
  });

  unit.teacherIds.forEach((tid) => {
    if (state.teacherOccupancy[tid]?.[d]) {
        state.teacherOccupancy[tid][d][p] = false;
        state.teacherDailyLoad[tid][d]--;
        if (p2 !== -1) {
          state.teacherOccupancy[tid][d][p2] = false;
          state.teacherDailyLoad[tid][d]--;
        }
    }
  });

  if (assignedRoomId && state.roomOccupancy[assignedRoomId]?.[d]) {
    state.roomOccupancy[assignedRoomId][d][p] = false;
    if (p2 !== -1) state.roomOccupancy[assignedRoomId][d][p2] = false;
  }

  if (state.singleResourceUsage[unit.subjectId]?.[d]) {
    state.singleResourceUsage[unit.subjectId][d][p] = false;
    if (p2 !== -1) state.singleResourceUsage[unit.subjectId][d][p2] = false;
  }
}