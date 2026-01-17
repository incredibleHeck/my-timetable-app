import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { doTimeRangesOverlap } from "../../../utils/timeUtils";

// NEW HELPER: Check Consecutive Slots
const checkConsecutiveLimit = (
  state: SchedulerState,
  d: number,
  p: number,
  duration: number,
  teacherId: string,
  maxConsecutive: number
): boolean => {
  // We need to simulate the day as if we added this lesson
  const dayGrid = [...state.teacherOccupancy[teacherId][d]]; // Copy current day
  
  // Mark proposed slots
  dayGrid[p] = true;
  if (duration === 2) dayGrid[p + 1] = true; // Simplified p+1, ideally use p2 logic

  let currentRun = 0;
  for (let i = 0; i < dayGrid.length; i++) {
    if (dayGrid[i]) {
      currentRun++;
      if (currentRun > maxConsecutive) return false; // Fail
    } else {
      currentRun = 0;
    }
  }
  return true;
};

export const checkHardConstraints = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  classes: any[]
): boolean => {
  const duration = unit.duration;

  // 1. GLOBAL FIXED OCCASIONS (Strict Check)
  // Any text value (e.g., "Worship") blocks the slot. Only "" or null/undefined is open.
  const globalP1 = data.settings.fixedOccasions?.[d]?.[p];
  if (globalP1 && typeof globalP1 === "string" && globalP1.trim().length > 0)
    return false;

  if (duration === 2) {
    const globalP2 = data.settings.fixedOccasions?.[d]?.[p2];
    if (globalP2 && typeof globalP2 === "string" && globalP2.trim().length > 0)
      return false;
  }

  // 2. TEACHER CONSTRAINTS
  for (const tid of unit.teacherIds) {
    // A. Availability (Grid Check)
    // This grid is initialized with teacher.constraints in state.ts.
    // If it's true, the teacher is either busy teaching OR blocked by constraint.
    if (state.teacherOccupancy[tid]?.[d]?.[p]) return false;
    if (duration === 2 && state.teacherOccupancy[tid]?.[d]?.[p2]) return false;

    // B. Daily Load Check (Teaching Limit)
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = data.teachers.find((t) => t.id === tid);
    const maxLoad =
      teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
    if (currentLoad + duration > maxLoad) return false;

    // C. CONSECUTIVE LIMIT (FIX 2)
    const maxConsecutive = data.settings.maxConsecutivePeriods || 4;
    // Only check if we are approaching the limit
    if (!checkConsecutiveLimit(state, d, p, duration, tid, maxConsecutive)) {
        return false;
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
    if (cls?.fixedSessions?.[d]?.[p]) return false;
    if (duration === 2 && cls?.fixedSessions?.[d]?.[p2]) return false;

    // C. MAX SUBJECT PER DAY CHECK
    // Only run this check if the class has this subject today
    if (state.classDailySubjects[cid]?.[d]?.has(unit.subjectId)) {
      let count = 0;
      const sched = state.schedule[cid]?.[d];
      if (sched) {
        for (const key in sched) {
          if (sched[key].subjectId === unit.subjectId) count++;
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
