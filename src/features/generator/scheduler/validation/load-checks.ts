import { ValidationContext, ValidationResult } from "./types";
import { getType } from "./utils";

export const checkTeacherLoad = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>
): ValidationResult | null => {
  const { data, teacherId, targetDay, maxPeriods } = ctx;

  const teacher = data.teachers.find((t) => t.id === teacherId);

  // Resolve Limits: Teacher specific > Global Settings > Defaults
  const maxDailyLoad =
    teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;

  let currentDailyLoad = 0;
  let consecutiveCount = 0;

  // Simulate the entire day to check patterns (Consecutive & Total)
  for (let p = 0; p < maxPeriods; p++) {
    let isOccupied = false;

    // 1. Is this a PROPOSED slot? (The move we are simulating)
    if (proposedSlots.has(p)) {
      isOccupied = true;
    }
    // 2. Is this an EXISTING slot? (That we aren't moving)
    else {
      // We scan all classes to see if this teacher is teaching ANYWHERE else at this time.
      // Optimization: We iterate class IDs because we don't have a teacher-centric index in ValidationContext.
      for (const cId of Object.keys(data.schedule)) {
        // Skip the class we are currently validating if this slot is marked to be ignored (moved from)
        if (cId === ctx.classId && ignoredSlots.has(p)) continue;

        const slot = data.schedule[cId]?.[targetDay]?.[p];

        // If the slot exists and is taught by this teacher
        if (slot && slot.teacherId === teacherId) {
          isOccupied = true;
          break; // Found them, no need to check other classes
        }
      }
    }

    // 3. Update Counters
    if (isOccupied) {
      currentDailyLoad++;
      consecutiveCount++;

      // Check Consecutive Limit immediately
      if (consecutiveCount > maxConsecutive) {
        return {
          valid: false,
          message: `Exceeds consecutive limit (${maxConsecutive})`,
          severity: "MEDIUM",
        };
      }
    } else {
      // Reset consecutive count on breaks or empty slots
      consecutiveCount = 0;
    }
  }

  // 4. Check Total Daily Load
  if (currentDailyLoad > maxDailyLoad) {
    return {
      valid: false,
      message: `Exceeds daily limit (${maxDailyLoad})`,
      severity: "MEDIUM",
    };
  }

  return null;
};

export const checkSubjectLimit = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods } = ctx;
  const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;

  let count = 0;
  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      count++;
    } else {
      const slot = data.schedule[classId]?.[targetDay]?.[p];
      if (slot && slot.subjectId === subjectId && !ignoredSlots.has(p)) {
        count++;
      }
    }
  }

  if (count > maxSubj) {
    return {
      valid: false,
      message: `Max ${maxSubj} periods per day`,
      severity: "MEDIUM",
    };
  }
  return null;
};

export const checkGapDetection = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<number>
): ValidationResult | null => {
  const { data, classId, targetDay, maxPeriods, structure } = ctx;

  // Find all occupied slots for this class on this day
  const occupied: number[] = [];
  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      occupied.push(p);
    } else {
      const slot = data.schedule[classId]?.[targetDay]?.[p];
      if (slot && !ignoredSlots.has(p)) {
        occupied.push(p);
      }
    }
  }

  if (occupied.length < 2) return null;
  occupied.sort((a, b) => a - b);

  for (let i = 0; i < occupied.length - 1; i++) {
    const start = occupied[i];
    const end = occupied[i + 1];

    // Check if there's a gap of only CLASS periods between them
    for (let p = start + 1; p < end; p++) {
      if (getType(structure, p) === "CLASS" && !proposedSlots.has(p)) {
        // If this slot is NOT in proposed and NOT in existing (already handled by occupied list)
        // it must be empty.
        return {
          valid: false,
          message: "Gap detected (Sandwich rule)",
          severity: "MEDIUM",
        };
      }
    }
  }
  return null;
};
