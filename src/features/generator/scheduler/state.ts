import { AppData, TimeSlot } from "../../../types";
import { AllocationUnit, SchedulerState, ScheduleEntry } from "./types";
import { calculateClassSchedule } from "../../../utils/timeUtils";
import { getType } from "./validation/utils";

/**
 * Helper to create a 2D grid (Days x Periods) initialized with null
 */
const createOccupancyGrid = (days: number, periods: number): (string | null)[][] => {
  return Array(days)
    .fill(null)
    .map(() => Array(periods).fill(null));
};

/**
 * INITIALIZE STATE: The Foundation of the Solver
 * Pre-calculates navigation maps to ensure O(1) jumps over non-lesson slots.
 */
export const initializeState = (data: AppData): SchedulerState => {
  const classes = data.classes || [];
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  const rooms = data.rooms || [];
  const settings = data.settings;
  const days = (settings as any).daysPerWeek || 5;
  const periods = settings.periodsPerDay;

  // 1. Storage for Pre-Calculated Navigation
  const classTimeRanges = new Map<string, TimeSlot[]>();
  const lessonNavigation = new Map<string, number[]>(); // Maps currentP -> nextClassP

  // 2. Build Occupancy Grids
  const state: SchedulerState = {
    schedule: {},
    classOccupancy: {},
    teacherOccupancy: {},
    roomOccupancy: {},
    singleResourceUsage: {},
    teacherDailyLoad: {},
    classDailySubjects: {},
    classTimeRanges,
    lessonNavigation,
    unitPlacements: new Map(),
  };

  // Initialize Teachers
  teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = createOccupancyGrid(days, periods); 
    state.teacherDailyLoad[t.id] = Array.from({ length: days }, () => 0);
  });
  
  // Calculate true max periods across all classes to handle extended days
  const maxClassPeriods = Math.max(
    periods,
    ...classes.map((c) => c.periodCount || 0)
  );
  
  // Re-initialize grids with maxPeriods to be safe
  teachers.forEach((t) => {
      state.teacherOccupancy[t.id] = createOccupancyGrid(days, maxClassPeriods);
      
      // Apply Static Blocks (Teacher Unavailability)
      if (t.constraints) {
        for (let d = 0; d < days; d++) {
          if (d >= t.constraints.length) continue;
          for (let p = 0; p < maxClassPeriods; p++) {
            if (p < t.constraints[d].length && t.constraints[d][p]) {
              state.teacherOccupancy[t.id][d][p] = "BLOCK";
            }
          }
        }
      }
  });

  // Initialize Classes & Pre-calculate Navigation
  classes.forEach((c) => {
    state.classOccupancy[c.id] = createOccupancyGrid(days, maxClassPeriods);
    state.classDailySubjects[c.id] = {};
    for (let d = 0; d < days; d++) state.classDailySubjects[c.id][d] = new Set();
    state.schedule[c.id] = {};

    // A. Pre-calculate Time Slots (e.g., P1 is 08:00 - 09:00)
    const structure = c.structure || settings.dayStructure;
    const timeSlots = calculateClassSchedule(c, settings, structure);
    classTimeRanges.set(c.id, timeSlots);

    // B. Pre-calculate Lesson Navigation (Skip Breaks/Lunch)
    // We scan up to maxClassPeriods
    const nextLessonMap: number[] = new Array(maxClassPeriods).fill(-1);
    for (let p = 0; p < maxClassPeriods; p++) {
      let lookAhead = p + 1;
      while (lookAhead < maxClassPeriods) {
        if (getType(structure, lookAhead) === "CLASS") {
          nextLessonMap[p] = lookAhead;
          break;
        }
        lookAhead++;
      }
    }
    lessonNavigation.set(c.id, nextLessonMap);
    
    // Fixed Sessions
    if (c.fixedSessions) {
      Object.keys(c.fixedSessions).forEach((dayStr) => {
        const d = parseInt(dayStr);
        if (isNaN(d) || d >= days) return;
        
        const daySessions = c.fixedSessions![d];
        if (!daySessions) return;

        Object.keys(daySessions).forEach((pStr) => {
            const p = parseInt(pStr);
            if (isNaN(p) || p >= maxClassPeriods) return;
            if (daySessions[p]) {
                state.classOccupancy[c.id][d][p] = "BLOCK";
            }
        });
      });
    }
  });

  // Initialize Rooms
  rooms.forEach((r) => {
    state.roomOccupancy[r.id] = createOccupancyGrid(days, maxClassPeriods);
  });

  // Initialize Single Resources (Labs/ICT)
  subjects.filter(s => s.isSingleResource).forEach(s => {
    state.singleResourceUsage[s.id] = createOccupancyGrid(days, maxClassPeriods);
  });
  
  // NEW: Burn in existing schedule
  if (data.schedule) {
      Object.keys(data.schedule).forEach(cId => {
          const clsSched = data.schedule[cId];
          if (!clsSched) return;
          
          Object.keys(clsSched).forEach(dStr => {
              const d = parseInt(dStr);
              if (isNaN(d) || d >= days) return;
              
              Object.keys(clsSched[d]).forEach(pStr => {
                  const p = parseInt(pStr);
                  if (isNaN(p) || p >= maxClassPeriods) return;
                  
                  const slot = clsSched[d][p];
                  if (!slot) return;
                  
                  const unitId = slot.unitId || `LEGACY-${slot.subjectId}`;
                  
                  // 0. State Schedule
                  if (!state.schedule[cId]) state.schedule[cId] = {};
                  if (!state.schedule[cId][d]) state.schedule[cId][d] = {};
                  state.schedule[cId][d][p] = { ...slot, unitId };

                  // 0.5 Register Placement
                  if (!state.unitPlacements.has(unitId)) {
                      state.unitPlacements.set(unitId, { d, p, p2: -1, rooms: { [unitId]: slot.roomId || "" } });
                  }

                  // 1. Class
                  if (state.classOccupancy[cId]) {
                      state.classOccupancy[cId][d][p] = unitId;
                      state.classDailySubjects[cId][d].add(slot.subjectId);
                  }
                  
                  // 2. Teacher
                  if (slot.teacherId && state.teacherOccupancy[slot.teacherId]) {
                      state.teacherOccupancy[slot.teacherId][d][p] = unitId;
                      state.teacherDailyLoad[slot.teacherId][d]++;
                  }
                  
                  // 3. Room
                  if (slot.roomId && state.roomOccupancy[slot.roomId]) {
                      state.roomOccupancy[slot.roomId][d][p] = unitId;
                  }
                  
                  // 4. Single Resource
                  if (state.singleResourceUsage[slot.subjectId]) {
                      state.singleResourceUsage[slot.subjectId][d][p] = unitId;
                  }
              });
          });
      });
  }

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
      duration: unit.duration,
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
