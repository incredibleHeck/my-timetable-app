import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";
import { getType } from "./utils";

/**
 * RULE: Teacher Load (with Gradient Penalty)
 */
export const checkTeacherLoad = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, teacherId, targetDay, maxPeriods } = ctx;

  const teacher = data.teachers.find((t) => t.id === teacherId);

  const maxDailyLoad =
    teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;

  let currentDailyLoad = 0;
  let consecutiveCount = 0;

  for (let p = 0; p < maxPeriods; p++) {
    let isOccupied = false;

    if (proposedSlots.has(p)) {
      isOccupied = true;
    }
    else {
      // O(1) check if state is provided
      if (state) {
        const occupier = state.teacherOccupancy[teacherId]?.[targetDay]?.[p];
        if (occupier && (ctx.classId !== ctx.classId || !ignoredSlots.has(p))) {
            // Wait, logic for ignoredSlots with state:
            // If the unit in the slot is the one we are moving, skip it.
            // But we don't have unitId here easily without scanning ctx.
            // Actually, if it's the SAME teacher and SAME slot index we are vacating...
            // Let's stick to the binary 'ignoredSlots' for now.
            if (!ignoredSlots.has(p)) isOccupied = true;
        }
      } else {
        // Fallback: O(N) scan
        for (const cId of Object.keys(data.schedule)) {
          if (cId === ctx.classId && ignoredSlots.has(p)) continue;

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
        return {
          valid: false,
          message: `Exceeds consecutive limit (${maxConsecutive})`,
          severity: "MEDIUM",
          penaltyPoints: 50 + (consecutiveCount - maxConsecutive) * 100,
          conflictCount: 1,
        };
      }
    } else {
      consecutiveCount = 0;
    }
  }

  // GRADIENT PENALTY CALCULATION
  if (currentDailyLoad > maxDailyLoad) {
    const overflow = currentDailyLoad - maxDailyLoad;
    return {
      valid: false,
      message: `Exceeds daily limit (${maxDailyLoad})`,
      severity: "MEDIUM",
      penaltyPoints: overflow * 500, // High cost for each period over limit
      conflictCount: 1,
    };
  }

  // LCV: Reward keeping teachers below their max
  if (currentDailyLoad === maxDailyLoad) {
      // Not an error per se, but we can report it as a "Soft Constraint" with points
      // However, checkSlotValidity returns null for success. 
      // We might need to return a successful result with points?
      // For now, we only use this for 'valid: false' cases in the solver.
  }

  return null;
};

export const checkSubjectLimit = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods } = ctx;
  const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;

  let count = 0;
  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      count++;
    } else {
      // O(1) check via state if available
      if (state) {
        const entry = state.schedule[classId]?.[targetDay]?.[p];
        if (entry && entry.subjectId === subjectId && !ignoredSlots.has(p)) {
          count++;
        }
      } else {
        const slot = data.schedule[classId]?.[targetDay]?.[p];
        if (slot && slot.subjectId === subjectId && !ignoredSlots.has(p)) {
          count++;
        }
      }
    }
  }

  if (count > maxSubj) {
    const overflow = count - maxSubj;
    return {
      valid: false,
      message: `Max ${maxSubj} periods per day`,
      severity: "MEDIUM",
      penaltyPoints: overflow * 100,
      conflictCount: 1,
    };
  }
  return null;
};

export const checkGapDetection = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, targetDay, maxPeriods, structure } = ctx;

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

  for (let i = 0; i < occupied.length - 1; i++) {
    const start = occupied[i];
    const end = occupied[i + 1];

    for (let p = start + 1; p < end; p++) {
      if (getType(structure, p) === "CLASS" && !proposedSlots.has(p)) {
        return {
          valid: false,
          message: "Gap detected (Sandwich rule)",
          severity: "MEDIUM",
          penaltyPoints: 50,
          conflictCount: 1,
        };
      }
    }
  }
  return null;
};
