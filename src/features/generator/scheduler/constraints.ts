import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";

/**
 * OPTIMIZED HELPER: Check Consecutive Limit (No Array Cloning)
 * Iterates the existing grid and virtually simulates occupancy.
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
    // Virtual Check: Is this slot occupied physically OR by our proposed move?
    const isOccupied = dailyGrid[i] !== null || i === p || (duration === 2 && i === p2);

    if (isOccupied) {
      currentRun++;
      if (currentRun > maxConsecutive) return false; // Hard Stop
    } else {
      currentRun = 0;
    }
  }
  return true;
};

/**
 * HELPER: Checks if a global fixed occasion value constitutes a block.
 * Handles both Strings ("Worship") and Legacy Objects ({ name: "..." }).
 */
export const isGlobalSlotBlocked = (val: any): boolean => {
  if (!val) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "object") return true; // Legacy object blocks
  return false;
};

export const checkHardConstraints = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number, // Explicitly receive p2 for accurate break handling
  unit: AllocationUnit,
  classes: any[]
): boolean => {
  const duration = unit.duration;

  // 1. GLOBAL FIXED OCCASIONS (Strict Check & Legacy Support)
  // Matches Validator logic: Strings or Objects block the slot.
  const globalP1 = data.settings.fixedOccasions?.[d]?.[p];
  if (isGlobalSlotBlocked(globalP1)) return false;

  if (duration === 2) {
    // Ensure p2 is valid (not -1) before checking
    if (p2 === -1) return false;
    const globalP2 = data.settings.fixedOccasions?.[d]?.[p2];
    if (isGlobalSlotBlocked(globalP2)) return false;
  }

  // 2. TEACHER CONSTRAINTS
  // Hoist setting lookup out of loop if possible, or keep here for safety
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;

  for (const tid of unit.teacherIds) {
    // A. Availability (Grid Check)
    if (state.teacherOccupancy[tid]?.[d]?.[p]) return false;
    if (duration === 2 && state.teacherOccupancy[tid]?.[d]?.[p2]) return false;

    // B. Daily Load Check (Teaching Limit)
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = data.teachers.find((t) => t.id === tid);
    const maxLoad =
      teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);

    if (currentLoad + duration > maxLoad) return false;

    // C. CONSECUTIVE LIMIT (Optimized Fix)
    // Only check if we are approaching the limit to save cycles
    if (currentLoad + duration >= maxConsecutive) {
      if (
        !checkConsecutiveLimit(state, d, p, p2, duration, tid, maxConsecutive)
      ) {
        return false;
      }
    }
  }

  // 3. CLASS CONSTRAINTS (Occupancy & Max Subjects)
  const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;

  for (const cid of unit.classIds) {
    // A. Slot Occupancy
    if (state.classOccupancy[cid]?.[d]?.[p]) return false;
    if (duration === 2 && state.classOccupancy[cid]?.[d]?.[p2]) return false;

    // B. Fixed Sessions (Class Specific)
    const cls = classes.find((c) => c.id === cid);
    if (cls?.fixedSessions) {
      if (cls.fixedSessions[d]?.[p]) return false;
      if (duration === 2 && cls.fixedSessions[d]?.[p2]) return false;
    }

    // C. MAX SUBJECT PER DAY CHECK
    if (state.classDailySubjects[cid]?.[d]?.has(unit.subjectId)) {
      let count = 0;
      const sched = state.schedule[cid]?.[d];

      if (sched) {
        // Fast iteration over object keys
        for (const key in sched) {
          // Count existing periods for this subject
          if (sched[key].subjectId === unit.subjectId) {
            // Determine if this existing slot is part of a double or single
            // (Simplified: assuming 1 slot = 1 duration unit for this check)
            count++;
          }
        }
      }

      // If adding this unit exceeds the limit
      if (count + duration > maxSubj) return false;
    }
  }

  // 4. SINGLE RESOURCE CHECK
  const subj = data.subjects.find((s) => s.id === unit.subjectId);
  if (subj?.isSingleResource) {
    if (state.singleResourceUsage[unit.subjectId]?.[d]?.[p]) return false;
    if (duration === 2 && state.singleResourceUsage[unit.subjectId]?.[d]?.[p2])
      return false;
  }

  return true;
};

export function checkImmutableConstraints(d: number, p: number, p2: number, unit: AllocationUnit, data: AppData): boolean {
   const globalP1 = data.settings.fixedOccasions?.[d]?.[p];
   if (isGlobalSlotBlocked(globalP1)) return false;
   
   if (unit.duration === 2 && p2 !== -1) {
       const globalP2 = data.settings.fixedOccasions?.[d]?.[p2];
       if (isGlobalSlotBlocked(globalP2)) return false;
   }

   for (const tid of unit.teacherIds) {
       const t = data.teachers.find(x => x.id === tid);
       if (t?.constraints?.[d]?.[p]) return false;
       if (unit.duration === 2 && p2 !== -1 && t?.constraints?.[d]?.[p2]) return false;
   }
   
   for (const cid of unit.classIds) {
       const cls = data.classes.find(c => c.id === cid);
       if (cls?.fixedSessions?.[d]?.[p]) return false;
       if (unit.duration === 2 && p2 !== -1 && cls?.fixedSessions?.[d]?.[p2]) return false;
   }
   return true;
}
