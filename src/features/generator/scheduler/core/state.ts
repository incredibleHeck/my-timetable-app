import { AppData, TimeSlot } from "../../../../types";
import { AllocationUnit, SchedulerState, ScheduleEntry } from "./types";
import { calculateClassSchedule } from "../../../../utils/timeUtils";
import { getType } from "../validation/utils";
import { getDaysPerWeek } from "../utils/utils";

/**
 * ARCHITECT NOTES:
 * 1. Added 'classSubjectDuration' to track curriculum progress in O(1).
 * 2. Optimized unassignUnit to cleanly rollback state.
 */

const createOccupancyGrid = (days: number, periods: number): (string | null)[][] => {
  return Array(days)
    .fill(null)
    .map(() => Array(periods).fill(null));
};

export const initializeState = (data: AppData): SchedulerState => {
  const classes = data.classes || [];
  const teachers = data.teachers || [];
  const subjects = data.subjects || [];
  const rooms = data.rooms || [];
  const settings = data.settings;
  const days = getDaysPerWeek(settings);
  const periods = settings.periodsPerDay;

  // 1. Storage
  const classTimeRanges = new Map<string, TimeSlot[]>();
  const lessonNavigation = new Map<string, number[]>();

  // 2. Build State
  const state: SchedulerState = {
    schedule: {},
    classOccupancy: {},
    teacherOccupancy: {},
    roomOccupancy: {},
    singleResourceUsage: {},
    teacherDailyLoad: {},
    classDailySubjects: {},

    // ARCHITECT: New Tracker for O(1) Curriculum Validation
    classSubjectDuration: {},

    classTimeRanges,
    lessonNavigation,
    unitPlacements: new Map(),
    unitToClassMap: new Map(),
    settings,
  };

  // Init Grids & Teachers
  teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = createOccupancyGrid(days, periods);
    state.teacherDailyLoad[t.id] = Array.from({ length: days }, () => 0);
  });

  const maxClassPeriods = Math.max(periods, ...classes.map((c) => c.periodCount || 0));

  // Re-init with correct size
  teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = createOccupancyGrid(days, maxClassPeriods);
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

  // Init Classes
  classes.forEach((c) => {
    state.classOccupancy[c.id] = createOccupancyGrid(days, maxClassPeriods);
    state.classDailySubjects[c.id] = {};

    // Init the new tracker
    state.classSubjectDuration[c.id] = {};

    for (let d = 0; d < days; d++) state.classDailySubjects[c.id][d] = new Set();
    state.schedule[c.id] = {};

    // Navigation Pre-calc
    const structure = c.structure || settings.dayStructure;
    classTimeRanges.set(c.id, calculateClassSchedule(c, settings, structure));

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
          if (daySessions[p]) state.classOccupancy[c.id][d][p] = "BLOCK";
        });
      });
    }
  });

  rooms.forEach((r) => {
    state.roomOccupancy[r.id] = createOccupancyGrid(days, maxClassPeriods);
  });

  classes.forEach((c) => {
    const rid = c.defaultRoomId || c.classroomId;
    if (rid && !state.roomOccupancy[rid]) {
      state.roomOccupancy[rid] = createOccupancyGrid(days, maxClassPeriods);
    }
  });

  subjects
    .filter((s) => s.isSingleResource)
    .forEach((s) => {
      state.singleResourceUsage[s.id] = createOccupancyGrid(days, maxClassPeriods);
    });

  // BURN IN EXISTING SCHEDULE (Critical: Must update new trackers)
  if (data.schedule) {
    Object.keys(data.schedule).forEach((cId) => {
      const clsSched = data.schedule[cId];
      if (!clsSched) return;
      Object.keys(clsSched).forEach((dStr) => {
        const d = parseInt(dStr);
        if (isNaN(d) || d >= days) return;
        Object.keys(clsSched[d]).forEach((pStr) => {
          const p = parseInt(pStr);
          if (isNaN(p) || p >= maxClassPeriods) return;
          const slot = clsSched[d][p];
          if (!slot) return;

          const unitId = slot.unitId || `LEGACY-${cId}-${d}-${p}-${slot.subjectId}`;

          // Update Grids
          if (!state.schedule[cId]) state.schedule[cId] = {};
          if (!state.schedule[cId][d]) state.schedule[cId][d] = {};

          const entry: ScheduleEntry = {
            ...slot,
            unitId,
            duration: slot.duration || 1,
            isFixed: slot.isFixed || false,
          };
          state.schedule[cId][d][p] = entry;

          if (!state.unitPlacements.has(unitId)) {
            state.unitPlacements.set(unitId, {
              d,
              p,
              p2: -1,
              rooms: { [unitId]: slot.roomId || "" },
            });
            state.unitToClassMap.set(unitId, cId);
          }

          if (state.classOccupancy[cId]) {
            state.classOccupancy[cId][d][p] = unitId;
            state.classDailySubjects[cId][d].add(slot.subjectId);

            // ARCHITECT: Update Tracker
            if (!state.classSubjectDuration[cId][slot.subjectId]) {
              state.classSubjectDuration[cId][slot.subjectId] = 0;
            }

            // Only increment duration if this slot is the 'head' or not fixed
            // to avoid double counting doubles in legacy burn-in
            if (!slot.isFixed) {
              state.classSubjectDuration[cId][slot.subjectId] += slot.duration || 1;
            }
          }

          if (slot.teacherId && state.teacherOccupancy[slot.teacherId]) {
            const tid = slot.teacherId;
            // Only increment load if the slot was previously empty
            // This prevents double counting for joint/elective units
            if (state.teacherOccupancy[tid][d][p] === null) {
              state.teacherDailyLoad[tid][d]++;
            }
            state.teacherOccupancy[tid][d][p] = unitId;
          }
          if (slot.roomId && state.roomOccupancy[slot.roomId]) {
            state.roomOccupancy[slot.roomId][d][p] = unitId;
          }
          if (state.singleResourceUsage[slot.subjectId]) {
            state.singleResourceUsage[slot.subjectId][d][p] = unitId;
          }
        });
      });
    });
  }

  return state;
};

// --- APPLY MOVE (O(1)) ---

export function applyMove(
  state: SchedulerState,
  unit: AllocationUnit,
  move: { d: number; p: number; p2: number; rooms: Record<string, string> },
) {
  const { d, p, p2, rooms } = move;
  state.unitPlacements.set(unit.id, move);
  state.unitToClassMap.set(unit.id, unit.classIds[0]);

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
      isCore: unit.isCore,
    };

    state.schedule[cid][d][p] = entry;
    state.classOccupancy[cid][d][p] = unit.id;
    state.classDailySubjects[cid][d].add(unit.subjectId);

    // ARCHITECT: Update Curriculum Tracker
    if (!state.classSubjectDuration[cid][unit.subjectId]) {
      state.classSubjectDuration[cid][unit.subjectId] = 0;
    }
    state.classSubjectDuration[cid][unit.subjectId] += unit.duration;

    if (p2 !== -1) {
      state.schedule[cid][d][p2] = { ...entry, isFixed: true };
      state.classOccupancy[cid][d][p2] = unit.id;
    }
  });

  unit.teacherIds.forEach((tid) => {
    // Only increment load if the teacher was previously free in this slot
    if (state.teacherOccupancy[tid][d][p] === null) {
      state.teacherDailyLoad[tid][d]++;
    }
    state.teacherOccupancy[tid][d][p] = unit.id;

    if (p2 !== -1) {
      if (state.teacherOccupancy[tid][d][p2] === null) {
        state.teacherDailyLoad[tid][d]++;
      }
      state.teacherOccupancy[tid][d][p2] = unit.id;
    }
  });

  const rId = rooms[unit.id];
  if (rId) {
    state.roomOccupancy[rId][d][p] = unit.id;
    if (p2 !== -1) state.roomOccupancy[rId][d][p2] = unit.id;
  }

  if (state.singleResourceUsage[unit.subjectId]) {
    state.singleResourceUsage[unit.subjectId][d][p] = unit.id;
    if (p2 !== -1) state.singleResourceUsage[unit.subjectId][d][p2] = unit.id;
  }
}

export function applyGangToState(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: { d: number; p: number; p2: number; rooms: Record<string, string> },
) {
  gang.forEach((u) => {
    applyMove(state, u, move);
  });
}

export function removeGangFromState(state: SchedulerState, gang: AllocationUnit[], _data: AppData) {
  gang.forEach((u) => {
    unassignUnit(state, u);
  });
}

// --- UNASSIGN (O(1)) ---

export function unassignUnit(state: SchedulerState, unit: AllocationUnit) {
  const placement = state.unitPlacements.get(unit.id);
  if (!placement) return;

  const { d, p, p2, rooms } = placement;
  state.unitToClassMap.delete(unit.id);

  unit.teacherIds.forEach((tid) => {
    // Only decrement load if we are the current occupant
    if (state.teacherOccupancy[tid][d][p] === unit.id) {
      state.teacherOccupancy[tid][d][p] = null;
      state.teacherDailyLoad[tid][d]--;
    }

    if (p2 !== -1) {
      if (state.teacherOccupancy[tid][d][p2] === unit.id) {
        state.teacherOccupancy[tid][d][p2] = null;
        state.teacherDailyLoad[tid][d]--;
      }
    }
  });

  const rId = rooms[unit.id];
  if (rId) {
    state.roomOccupancy[rId][d][p] = null;
    if (p2 !== -1) state.roomOccupancy[rId][d][p2] = null;
  }

  unit.classIds.forEach((cid) => {
    delete state.schedule[cid][d][p];
    state.classOccupancy[cid][d][p] = null;

    // ARCHITECT: Update Curriculum Tracker
    if (state.classSubjectDuration[cid][unit.subjectId]) {
      state.classSubjectDuration[cid][unit.subjectId] -= unit.duration;
    }

    const hasOther = Object.values(state.schedule[cid][d] || {}).some(
      (s) => s.subjectId === unit.subjectId,
    );
    if (!hasOther) {
      state.classDailySubjects[cid][d].delete(unit.subjectId);
    }

    if (p2 !== -1) {
      delete state.schedule[cid][d][p2];
      state.classOccupancy[cid][d][p2] = null;
    }
  });

  if (state.singleResourceUsage[unit.subjectId]) {
    state.singleResourceUsage[unit.subjectId][d][p] = null;
    if (p2 !== -1) state.singleResourceUsage[unit.subjectId][d][p2] = null;
  }

  state.unitPlacements.delete(unit.id);
}
