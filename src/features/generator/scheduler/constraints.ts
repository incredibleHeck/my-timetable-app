import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";

/**
 * OPTIMIZED HELPER: Check Consecutive Limit
 * Prevents teacher burnout by ensuring they don't teach too many periods in a row.
 */
const checkConsecutiveLimit = (
  state: SchedulerState,
  d: number,
  p: number,
  p2: number,
  duration: number,
  teacherId: string,
  maxConsecutive: number
): boolean => {
  const dailyGrid = state.teacherOccupancy[teacherId][d];
  const gridLen = dailyGrid.length;
  let currentRun = 0;

  for (let i = 0; i < gridLen; i++) {
    const isOccupied = dailyGrid[i] !== null || i === p || (duration === 2 && i === p2);
    if (isOccupied) {
      currentRun++;
      if (currentRun > maxConsecutive) return false;
    } else {
      currentRun = 0;
    }
  }
  return true;
};

export const isGlobalSlotBlocked = (val: any): boolean => {
  if (!val) return false;
  if (typeof val === "string") return val.trim().length > 0;
  return typeof val === "object"; 
};

/**
 * CORE HARD CONSTRAINTS
 * Includes Teacher Load, Class Occupancy, and Physical Room Integrity.
 */
export const checkHardConstraints = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  classes: any[]
): boolean => {
  const { duration, subjectId, teacherIds, classIds } = unit;

  // 1. GLOBAL & STRUCTURAL BLOCKS
  const globalP1 = data.settings.fixedOccasions?.[d]?.[p];
  if (isGlobalSlotBlocked(globalP1)) return false;

  if (duration === 2) {
    if (p2 === -1) return false;
    const globalP2 = data.settings.fixedOccasions?.[d]?.[p2];
    if (isGlobalSlotBlocked(globalP2)) return false;
  }

  // 2. TEACHER CONSTRAINTS (Load & Availability)
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;
  for (const tid of teacherIds) {
    if (state.teacherOccupancy[tid]?.[d]?.[p]) return false;
    if (duration === 2 && state.teacherOccupancy[tid]?.[d]?.[p2]) return false;

    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = data.teachers.find((t) => t.id === tid);
    const maxLoad = teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);

    if (currentLoad + duration > maxLoad) return false;

    if (currentLoad + duration >= maxConsecutive) {
      if (!checkConsecutiveLimit(state, d, p, p2, duration, tid, maxConsecutive)) return false;
    }
  }

  // 3. CLASS & CURRICULUM CONSTRAINTS
  const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;
  for (const cid of classIds) {
    if (state.classOccupancy[cid]?.[d]?.[p]) return false;
    if (duration === 2 && state.classOccupancy[cid]?.[d]?.[p2]) return false;

    // Fixed Sessions (Off-site/Swimming/etc)
    const cls = classes.find((c) => c.id === cid);
    if (cls?.fixedSessions) {
      if (cls.fixedSessions[d]?.[p]) return false;
      if (duration === 2 && cls.fixedSessions[d]?.[p2]) return false;
    }

    // Daily Subject Variety
    if (state.classDailySubjects[cid]?.[d]?.has(subjectId)) {
      let count = 0;
      const sched = state.schedule[cid]?.[d];
      if (sched) {
        for (const key in sched) {
          if (sched[key].subjectId === subjectId) count++;
        }
      }
      if (count + duration > maxSubj) return false;
    }
  }

  // 4. PHYSICAL ROOM INTEGRITY (Your New Requirement)
  // We check if the room that WILL be assigned to this move is currently free.
  const subject = data.subjects.find(s => s.id === subjectId);
  const repClass = classes.find(c => c.id === classIds[0]);
  
  // Rule: Specialist Room if needed, else Classroom (Homeroom)
  const targetRoomId = subject?.requiredRoomId || repClass?.defaultRoomId;

  if (targetRoomId) {
    // If the room is currently occupied by ANY unit, this move is illegal in Phase 1
    if (state.roomOccupancy[targetRoomId]?.[d]?.[p]) return false;
    if (duration === 2 && state.roomOccupancy[targetRoomId]?.[d]?.[p2]) return false;
  }

  // 5. SINGLE RESOURCE CHECK
  if (subject?.isSingleResource) {
    if (state.singleResourceUsage[subjectId]?.[d]?.[p]) return false;
    if (duration === 2 && state.singleResourceUsage[subjectId]?.[d]?.[p2]) return false;
  }

  return true;
};

/**
 * IMMUTABLE CONSTRAINTS
 * These are the 'Hard Walls' that even the Repair Phase cannot break.
 */
export function checkImmutableConstraints(d: number, p: number, p2: number, unit: AllocationUnit, data: AppData): boolean {
   // 1. Global Blocked Slots
   if (isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p])) return false;
   if (unit.duration === 2 && p2 !== -1 && isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p2])) return false;

   // 2. Teacher Unavailable Grid
   for (const tid of unit.teacherIds) {
       const t = data.teachers.find(x => x.id === tid);
       if (t?.constraints?.[d]?.[p]) return false;
       if (unit.duration === 2 && p2 !== -1 && t?.constraints?.[d]?.[p2]) return false;
   }
   
   // 3. Class Pre-scheduled Blocks
   for (const cid of unit.classIds) {
       const cls = data.classes.find(c => c.id === cid);
       if (cls?.fixedSessions?.[d]?.[p]) return false;
       if (unit.duration === 2 && p2 !== -1 && cls?.fixedSessions?.[d]?.[p2]) return false;
   }
   return true;
}