import { AppData, TimeSlot } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { calculateClassSchedule } from "../../../utils/timeUtils";
import { getNextClassPeriod } from "./utils";

/**
 * Helper to create a 2D grid (Days x Periods) initialized with null
 */
const createOccupancyGrid = (days: number, periods: number): (string | null)[][] => {
  return Array(days)
    .fill(null)
    .map(() => Array(periods).fill(null));
};

export const initializeState = (data: AppData): SchedulerState => {
  const days = (data.settings as any).daysPerWeek || 5;

  // 1. CALCULATE DIMENSIONS
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
    unitPlacements: new Map(),
  };

  // 3. INITIALIZE TEACHERS
  data.teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = createOccupancyGrid(days, maxPeriods);
    state.teacherDailyLoad[t.id] = {};
    for (let d = 0; d < days; d++) state.teacherDailyLoad[t.id][d] = 0;

    // PRE-FILL: Teacher Constraints
    if (t.constraints) {
      t.constraints.forEach((row, d) => {
        if (d >= days) return;
        row.forEach((isBlocked, p) => {
          if (isBlocked && p < maxPeriods) {
            // Use a reserved keyword for static blocks
            state.teacherOccupancy[t.id][d][p] = "BLOCK"; 
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
    const structure = c.structure || data.settings.dayStructure;
    const ranges: TimeSlot[] = calculateClassSchedule(
      c,
      data.settings,
      structure
    );
    state.classTimeRanges.set(c.id, ranges);

    state.schedule[c.id] = {};
    state.classOccupancy[c.id] = createOccupancyGrid(days, maxPeriods);
    state.classDailySubjects[c.id] = {};
    for (let d = 0; d < days; d++)
      state.classDailySubjects[c.id][d] = new Set();

    if (c.fixedSessions) {
      Object.keys(c.fixedSessions).forEach((dayStr) => {
        const d = parseInt(dayStr);
        if (isNaN(d) || d >= days) return;

        const daySessions = c.fixedSessions![d];
        if (!daySessions) return;

        Object.keys(daySessions).forEach((pStr) => {
          const p = parseInt(pStr);
          if (isNaN(p) || p >= maxPeriods) return;

          const val = daySessions[p];
          if (val) {
            state.classOccupancy[c.id][d][p] = "BLOCK";
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
    // Store detailed placement info for O(1) eviction
    state.unitPlacements.set(u.id, { d, p, p2, rooms });
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
      // Store Unit ID in grid
      state.classOccupancy[cid][d][p] = u.id; 
      state.classDailySubjects[cid][d].add(u.subjectId);

      if (u.duration === 2) {
        state.schedule[cid][d][p2] = { ...entry, isFixed: true }; 
        state.classOccupancy[cid][d][p2] = u.id;
      }
    });

    u.teacherIds.forEach((tid) => {
      state.teacherOccupancy[tid][d][p] = u.id;
      state.teacherDailyLoad[tid][d]++;
      if (u.duration === 2) {
        state.teacherOccupancy[tid][d][p2] = u.id;
        state.teacherDailyLoad[tid][d]++;
      }
    });

    if (roomId) {
      state.roomOccupancy[roomId][d][p] = u.id;
      if (u.duration === 2) state.roomOccupancy[roomId][d][p2] = u.id;
    }

    if (state.singleResourceUsage[u.subjectId]) {
      state.singleResourceUsage[u.subjectId][d][p] = u.id;
      if (u.duration === 2)
        state.singleResourceUsage[u.subjectId][d][p2] = u.id;
    }
  });
}

export function removeGangFromState(state: SchedulerState, gang: AllocationUnit[], data: AppData) {
    gang.forEach(u => {
        // Use the new unitPlacements map
        const placement = state.unitPlacements.get(u.id);
        if (!placement) return;
        
        state.unitPlacements.delete(u.id);
        unassignUnit(state, u, placement, data);
    });
}

export function unassignUnit(
  state: SchedulerState, 
  unit: AllocationUnit, 
  placement: { d: number; p: number; p2: number; rooms: Record<string, string> },
  data: AppData
) {
  const { d, p, p2, rooms } = placement;
  const assignedRoomId = rooms[unit.id];

  // 1. Clear Schedule & Class Occupancy
  unit.classIds.forEach((cid) => {
    // Only delete if it matches OUR unit (safety check)
    if (state.classOccupancy[cid][d][p] === unit.id) {
        if (state.schedule[cid]?.[d]?.[p]) delete state.schedule[cid][d][p];
        state.classOccupancy[cid][d][p] = null;
    }

    const hasOther = Object.values(state.schedule[cid][d] || {}).some(s => s.subjectId === unit.subjectId);
    if (!hasOther) {
      state.classDailySubjects[cid][d].delete(unit.subjectId);
    }

    if (p2 !== -1) {
        if (state.classOccupancy[cid][d][p2] === unit.id) {
            if (state.schedule[cid]?.[d]?.[p2]) delete state.schedule[cid][d][p2];
            state.classOccupancy[cid][d][p2] = null;
        }
    }
  });

  // 2. Revert Teacher Load
  unit.teacherIds.forEach((tid) => {
    if (state.teacherOccupancy[tid][d][p] === unit.id) {
        state.teacherOccupancy[tid][d][p] = null;
        state.teacherDailyLoad[tid][d]--;
        if (p2 !== -1 && state.teacherOccupancy[tid][d][p2] === unit.id) {
          state.teacherOccupancy[tid][d][p2] = null;
          state.teacherDailyLoad[tid][d]--;
        }
    }
  });

  // 3. Free Room & Resources
  if (assignedRoomId && state.roomOccupancy[assignedRoomId]) {
    if (state.roomOccupancy[assignedRoomId][d][p] === unit.id) {
        state.roomOccupancy[assignedRoomId][d][p] = null;
    }
    if (p2 !== -1 && state.roomOccupancy[assignedRoomId][d][p2] === unit.id) {
        state.roomOccupancy[assignedRoomId][d][p2] = null;
    }
  }

  if (state.singleResourceUsage[unit.subjectId]) {
    if (state.singleResourceUsage[unit.subjectId][d][p] === unit.id) {
        state.singleResourceUsage[unit.subjectId][d][p] = null;
    }
    if (p2 !== -1 && state.singleResourceUsage[unit.subjectId][d][p2] === unit.id) {
        state.singleResourceUsage[unit.subjectId][d][p2] = null;
    }
  }
}