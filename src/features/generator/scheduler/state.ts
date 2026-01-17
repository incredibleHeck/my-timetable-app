import { AppData, TimeSlot } from "../../../types";
import { AllocationUnit, SchedulerState, ScheduleEntry } from "./types";
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

export function applyMove(
  state: SchedulerState,
  unit: AllocationUnit,
  move: { d: number; p: number; p2: number; rooms: Record<string, string> }
) {
  const { d, p, p2, rooms } = move;

  // 1. Register the placement for O(1) unassigning later
  state.unitPlacements.set(unit.id, move);

  // 2. Occupy Class Resources
  unit.classIds.forEach((cid) => {
    if (!state.schedule[cid][d]) state.schedule[cid][d] = {};
    
    const entry: ScheduleEntry = {
      unitId: unit.id,
      subjectId: unit.subjectId,
      teacherId: unit.teacherIds[0],
      classId: cid,
      roomId: rooms[unit.id],
      isFixed: false,
    };

    state.schedule[cid][d][p] = entry;
    state.classOccupancy[cid][d][p] = unit.id; // Map to unitId
    state.classDailySubjects[cid][d].add(unit.subjectId);

    if (p2 !== -1) {
      state.schedule[cid][d][p2] = { ...entry, isFixed: true };
      state.classOccupancy[cid][d][p2] = unit.id;
    }
  });

  // 3. Occupy Teacher & Room
  unit.teacherIds.forEach((tid) => {
    state.teacherOccupancy[tid][d][p] = unit.id;
    state.teacherDailyLoad[tid][d]++; // Using original increment logic
    if (p2 !== -1) {
        state.teacherOccupancy[tid][d][p2] = unit.id;
        state.teacherDailyLoad[tid][d]++;
    }
  });

  const rId = rooms[unit.id];
  if (rId) {
    state.roomOccupancy[rId][d][p] = unit.id;
    if (p2 !== -1) state.roomOccupancy[rId][d][p2] = unit.id;
  }

  if (state.singleResourceUsage[unit.subjectId]) {
    state.singleResourceUsage[unit.subjectId][d][p] = unit.id;
    if (p2 !== -1)
      state.singleResourceUsage[unit.subjectId][d][p2] = unit.id;
  }
}

export function applyGangToState(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: { d: number; p: number; p2: number; rooms: Record<string, string> }
) {
  // Delegate to applyMove for each unit in the gang
  gang.forEach((u) => {
      applyMove(state, u, move);
  });
}

export function removeGangFromState(state: SchedulerState, gang: AllocationUnit[], data: AppData) {
    gang.forEach(u => {
        unassignUnit(state, u);
    });
}

export function unassignUnit(state: SchedulerState, unit: AllocationUnit) {
  const placement = state.unitPlacements.get(unit.id);
  if (!placement) return; // Not currently placed

  const { d, p, p2, rooms } = placement;

  // 1. Clean up Teacher
  unit.teacherIds.forEach((tid) => {
    state.teacherOccupancy[tid][d][p] = null;
    state.teacherDailyLoad[tid][d] -= (p2 !== -1 ? 2 : 1);
    if (p2 !== -1) state.teacherOccupancy[tid][d][p2] = null;
  });

  // 2. Clean up Room
  const rId = rooms[unit.id];
  if (rId) {
    state.roomOccupancy[rId][d][p] = null;
    if (p2 !== -1) state.roomOccupancy[rId][d][p2] = null;
  }

  // 3. Clean up Classes
  unit.classIds.forEach((cid) => {
    delete state.schedule[cid][d][p];
    state.classOccupancy[cid][d][p] = null;
    
    // Only delete from subject set if no other slots on this day have this subject
    const hasOther = Object.values(state.schedule[cid][d] || {}).some(s => s.subjectId === unit.subjectId);
    if (!hasOther) {
      state.classDailySubjects[cid][d].delete(unit.subjectId);
    }

    if (p2 !== -1) {
      delete state.schedule[cid][d][p2];
      state.classOccupancy[cid][d][p2] = null;
    }
  });

  // 4. Free Single Resources
  if (state.singleResourceUsage[unit.subjectId]) {
    state.singleResourceUsage[unit.subjectId][d][p] = null;
    if (p2 !== -1) state.singleResourceUsage[unit.subjectId][d][p2] = null;
  }

  state.unitPlacements.delete(unit.id);
}

