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

  // 1. Daily Limit Check
  let dailyCount = 0;
  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      dailyCount++;
    } else {
      // O(1) check via state if available
      if (state) {
        const entry = state.schedule[classId]?.[targetDay]?.[p];
        if (entry && entry.subjectId === subjectId && !ignoredSlots.has(p)) {
          dailyCount++;
        }
      } else {
        const slot = data.schedule[classId]?.[targetDay]?.[p];
        if (slot && slot.subjectId === subjectId && !ignoredSlots.has(p)) {
          dailyCount++;
        }
      }
    }
  }

  if (dailyCount > maxSubj) {
    const overflow = dailyCount - maxSubj;
    return {
      valid: false,
      message: `Max ${maxSubj} periods per day`,
      severity: "MEDIUM",
      penaltyPoints: overflow * 100,
      conflictCount: 1,
    };
  }

  // 2. Weekly/Total Curriculum Limit Check
  const cls = data.classes.find((c) => c.id === classId);
  const curr = cls?.curriculum.find((c) => c.subjectId === subjectId);
  if (curr) {
    const totalAllowed = (curr.singles || 0) + (curr.doubles || 0) * 2;
    let totalScheduled = proposedSlots.size;

    // Iterate over all days to count existing placements
    for (let d = 0; d < (data.settings as any).daysPerWeek || 5; d++) {
      for (let p = 0; p < maxPeriods; p++) {
        // Skip current day's proposed slots as we already added them to totalScheduled
        if (d === targetDay && proposedSlots.has(p)) continue;

        const slot = data.schedule[classId]?.[d]?.[p];
        // If it's a move, ignore the slot we are moving FROM
        const isIgnored = d === ctx.targetDay && ignoredSlots.has(p);

        if (slot && slot.subjectId === subjectId && !isIgnored) {
          totalScheduled++;
        }
      }
    }

    if (totalScheduled > totalAllowed) {
      return {
        valid: false,
        message: `Exceeds curriculum limit (${totalScheduled}/${totalAllowed})`,
        severity: "HIGH",
        penaltyPoints: 2000,
        conflictCount: 1,
      };
    }
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
