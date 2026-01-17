import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";
import { getType } from "./utils";

/**
 * RULE: Teacher Load & Consecutive Limits
 * Uses a Gradient Penalty: Small violations cost points, large ones trigger repair.
 */
export const checkTeacherLoad = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, teacherId, targetDay, maxPeriods } = ctx;
  const teacher = data.teachers.find((t) => t.id === teacherId);

  const maxDailyLoad = teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;

  let currentDailyLoad = 0;
  let consecutiveCount = 0;

  for (let p = 0; p < maxPeriods; p++) {
    let isOccupied = false;

    if (proposedSlots.has(p)) {
      isOccupied = true;
    } else if (!ignoredSlots.has(p)) {
      // O(1) Lookup: Check if teacher is busy elsewhere
      if (state) {
        if (state.teacherOccupancy[teacherId]?.[targetDay]?.[p] !== null) {
          isOccupied = true;
        }
      } else {
        // Fallback for manual UI validation
        for (const cId of Object.keys(data.schedule)) {
          const slot = data.schedule[cId]?.[targetDay]?.[p];
          if (slot && slot.teacherId === teacherId) {
            isOccupied = true;
            break;
          }
        }
      }
    }

    if (isOccupied) {
      currentDailyLoad++;
      consecutiveCount++;

      if (consecutiveCount > maxConsecutive) {
        const overflow = consecutiveCount - maxConsecutive;
        return {
          valid: false,
          message: `Exceeds consecutive limit (${maxConsecutive})`,
          severity: "MEDIUM",
          penaltyPoints: 500 + (overflow * 200), // Escalating penalty
          conflictCount: 0, // Soft conflict: repairable via shuffling
        };
      }
    } else {
      consecutiveCount = 0;
    }
  }

  if (currentDailyLoad > maxDailyLoad) {
    return {
      valid: false,
      message: `Exceeds daily limit (${currentDailyLoad}/${maxDailyLoad})`,
      severity: "MEDIUM",
      penaltyPoints: 1000 + (currentDailyLoad - maxDailyLoad) * 500,
      conflictCount: 1, // Triggers Min-Conflicts eviction
    };
  }

  return null;
};

/**
 * RULE: Subject Limits & Total Curriculum Allocation
 * Ensures we don't exceed daily pedagogical limits OR the total weekly curriculum.
 */
export const checkSubjectLimit = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods } = ctx;
  
  // 1. DAILY LIMIT (Pedagogical Variety)
  const maxDaily = data.settings.maxSubjectPeriodsPerDay || 2;
  let dailyCount = 0;

  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      dailyCount++;
    } else if (!ignoredSlots.has(p)) {
      const entry = state ? state.schedule[classId]?.[targetDay]?.[p] : data.schedule[classId]?.[targetDay]?.[p];
      if (entry && entry.subjectId === subjectId) {
        dailyCount++;
      }
    }
  }

  if (dailyCount > maxDaily) {
    // console.log(`Subject limit exceeded: dailyCount=${dailyCount}, maxDaily=${maxDaily}, subjectId=${subjectId}`);
    return {
      valid: false,
      message: `Max ${maxDaily} periods per day`,
      severity: "LOW",
      penaltyPoints: 300, 
      conflictCount: 0,
    };
  }

  // 2. TOTAL CURRICULUM ALLOCATION (The "Hard Wall")
  const cls = data.classes.find((c) => c.id === classId);
  const curriculumItem = cls?.curriculum?.find((curr) => curr.subjectId === subjectId);
  
  if (curriculumItem) {
    const totalAllowed = (curriculumItem.singles || 0) + (curriculumItem.doubles || 0) * 2;
    let totalScheduled = proposedSlots.size;

    // We must count across the ENTIRE week
    // Safe cast for settings, fallback to 5 days if missing
    const daysPerWeek = (data.settings as any).daysPerWeek || 5;
    
    for (let d = 0; d < daysPerWeek; d++) {
      const daySched = state ? state.schedule[classId]?.[d] : data.schedule[classId]?.[d];
      if (!daySched) continue;

      Object.keys(daySched).forEach((pStr) => {
        const p = parseInt(pStr);
        const slot = daySched[p];
        
        // Skip current day if we're simulating/ignoring or it's a fixed 'tail'
        const isCurrentSimulation = (d === targetDay && (proposedSlots.has(p) || ignoredSlots.has(p)));
        if (isCurrentSimulation || (slot as any).isFixed) return;

        if (slot && slot.subjectId === subjectId) {
          const nextSlot = daySched[p+1];
          const isDouble = nextSlot && (nextSlot as any).isFixed && nextSlot.subjectId === subjectId;
          
          totalScheduled += (isDouble ? 2 : 1);
        }
      });
    }

    if (totalScheduled > totalAllowed) {
      return {
        valid: false,
        message: `Curriculum Over-Allocation: ${totalScheduled}/${totalAllowed} periods`,
        severity: "HIGH",
        penaltyPoints: 5000, // Absolute wall: Solver must evict this move
        conflictCount: 1,
      };
    }
  }

  return null;
};

/**
 * REFACTORED: Gap Detection (Break/Lunch Aware)
 * Only flags a gap if an empty CLASS period exists between two occupied slots.
 */
export const checkGapDetection = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, targetDay, maxPeriods, structure } = ctx;

  // 1. Collect all periods that will be occupied for this class on this day
  const occupied: number[] = [];
  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      occupied.push(p);
    } else {
      const isOccupied = state 
        ? state.classOccupancy[classId]?.[targetDay]?.[p] !== null
        : data.schedule[classId]?.[targetDay]?.[p] !== undefined;

      if (isOccupied && !ignoredSlots.has(p)) {
        occupied.push(p);
      }
    }
  }

  if (occupied.length < 2) return null;
  occupied.sort((a, b) => a - b);

  // 2. Scan the space BETWEEN occupied periods
  for (let i = 0; i < occupied.length - 1; i++) {
    const start = occupied[i];
    const end = occupied[i + 1];

    for (let p = start + 1; p < end; p++) {
      const periodType = getType(structure, p);

      // CRITICAL FIX: 
      // A gap is ONLY valid if the period type is "CLASS".
      // If p is a "BREAK" or "LUNCH", it is NOT a gap.
      if (periodType === "CLASS" && !proposedSlots.has(p)) {
        return {
          valid: false,
          message: "Gap detected",
          severity: "MEDIUM",
          penaltyPoints: 400,
          conflictCount: 0,
        };
      }
    }
  }
  return null;
};
