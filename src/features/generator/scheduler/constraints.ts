import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { getPeriodType, getNextClassPeriod } from "./utils"; // From your utils file
import { doTimeRangesOverlap } from "../../../utils/timeUtils";

export const checkHardConstraints = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number, // -1 if single
  unit: AllocationUnit,
  classes: any[]
): boolean => {
  const duration = unit.duration;

  // 1. GLOBAL & CLASS BLOCKS
  // Check settings.fixedOccasions
  if (data.settings.fixedOccasions?.[d]?.[p]) return false;
  if (duration === 2 && data.settings.fixedOccasions?.[d]?.[p2]) return false;

  // Check Class Fixed Sessions
  for (const c of classes) {
    if (c.fixedSessions?.[d]?.[p]) return false;
    if (duration === 2 && c.fixedSessions?.[d]?.[p2]) return false;

    // Class Occupancy (Is class already busy?)
    if (state.classOccupancy[c.id][d][p]) return false;
    if (duration === 2 && state.classOccupancy[c.id][d][p2]) return false;
  }

  // 2. TEACHER CONSTRAINTS
  for (const tid of unit.teacherIds) {
    // A. Static Grid Check (Quick Fail)
    if (state.teacherOccupancy[tid][d][p]) return false;
    if (duration === 2 && state.teacherOccupancy[tid][d][p2]) return false;

    // B. Daily Load Limit
    const currentLoad = state.teacherDailyLoad[tid][d] || 0;
    const teacherObj = data.teachers.find((t) => t.id === tid);
    const maxLoad =
      teacherObj?.maxPeriodsPerDay ??
      (data.settings.maxTeacherPeriodsPerDay || 6);
    if (currentLoad + duration > maxLoad) return false;

    // C. TIME OVERLAP CHECK (Expensive but Necessary)
    // We must check if this teacher is in another class that overlaps in REAL TIME.
    // Iterating all classes is slow, so we optimize by skipping if teacher is not busy in grid.
    // (But we already passed grid check, so this is for partial overlaps if grid is coarse)

    const targetRanges = classes.map((c) => state.classTimeRanges.get(c.id));
    // Check against every other class the teacher is teaching *right now*
    for (const otherCId of Object.keys(state.schedule)) {
      // Skip self
      if (unit.classIds.includes(otherCId)) continue;

      const otherDaySched = state.schedule[otherCId][d];
      if (!otherDaySched) continue;

      for (const slotPStr in otherDaySched) {
        const slot = otherDaySched[slotPStr];
        if (slot.teacherId === tid) {
          const otherP = parseInt(slotPStr);
          const otherRanges = state.classTimeRanges.get(otherCId);
          const otherTime = otherRanges?.[otherP];

          // Compare P1
          const tRange1 = targetRanges[0]?.[p]; // Use first class as proxy for unit timing
          if (tRange1 && otherTime && doTimeRangesOverlap(tRange1, otherTime))
            return false;

          // Compare P2
          if (duration === 2) {
            const tRange2 = targetRanges[0]?.[p2];
            if (tRange2 && otherTime && doTimeRangesOverlap(tRange2, otherTime))
              return false;
          }
        }
      }
    }
  }

  // 3. SINGLE RESOURCE CHECK
  if (state.singleResourceUsage[unit.subjectId]) {
    // Grid check usually suffices unless you have shared resources across different bell schedules
    if (state.singleResourceUsage[unit.subjectId][d][p]) return false;
    if (duration === 2 && state.singleResourceUsage[unit.subjectId][d][p2])
      return false;
  }

  // 4. SUBJECT LIMITS & GAP CHECK (The Sandwich)
  const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;

  for (const c of classes) {
    // A. Max Periods
    if (state.classDailySubjects[c.id][d].has(unit.subjectId)) {
      let count = 0;
      const sched = state.schedule[c.id][d];
      for (const k in sched) {
        if (sched[k].subjectId === unit.subjectId) count++;
      }
      if (count + duration > maxSubj) return false;

      // B. Gap Check
      // If subject exists today, we must ensure we aren't creating a gap
      // Find min/max period of existing subject
      let minP = 999,
        maxP = -999;
      for (const k in sched) {
        if (sched[k].subjectId === unit.subjectId) {
          const kp = parseInt(k);
          minP = Math.min(minP, kp);
          maxP = Math.max(maxP, kp);
        }
      }
      // Include proposal
      minP = Math.min(minP, p);
      maxP = Math.max(maxP, duration === 2 ? p2 : p);

      // Scan the range for Gaps
      const struct = c.structure || data.settings.dayStructure;
      for (let i = minP + 1; i < maxP; i++) {
        const type = getPeriodType(struct, i);
        if (type === "CLASS") {
          // If this slot is empty (not proposed, not existing subject), it's a gap
          const isProposed = i === p || (duration === 2 && i === p2);
          const isExisting = sched[i]?.subjectId === unit.subjectId;
          if (!isProposed && !isExisting) return false; // Gap detected
        }
      }
    }
  }

  return true;
};
