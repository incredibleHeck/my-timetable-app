import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";
import { getType } from "./utils";
import { getPrevClassPeriod } from "../utils";

/**
 * RULE: Teacher Load & Consecutive Limits
 * Uses a Gradient Penalty: Small violations cost points, large ones trigger repair.
 */
export const checkTeacherLoad = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<string>,
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
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
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
  ignoredSlots: Set<string>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods } = ctx;
  
  // 1. DAILY LIMIT (Pedagogical Variety)
  const maxDaily = data.settings.maxSubjectPeriodsPerDay || 2;
  let dailyCount = 0;

  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      dailyCount++;
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
      const entry = state ? state.schedule[classId]?.[targetDay]?.[p] : data.schedule[classId]?.[targetDay]?.[p];
      if (entry && entry.subjectId === subjectId) {
        dailyCount++;
      }
    }
  }

  if (dailyCount > maxDaily) {
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
    
    // 1. Start with the proposed slots count (The new placement)
    let totalScheduled = proposedSlots.size;

    const daysPerWeek = (data.settings as any).daysPerWeek || 5;
    
    for (let d = 0; d < daysPerWeek; d++) {
      const daySched = state ? state.schedule[classId]?.[d] : data.schedule[classId]?.[d];
      if (!daySched) continue;

      Object.keys(daySched).forEach((pStr) => {
        const p = parseInt(pStr);
        const slot = daySched[p];

        // Skip tails of double periods (to count as a single unit below)
        if (!slot || (slot as any).isFixed) return;

        // SKIP if this slot is part of what we are currently "proposing" to add
        if (d === targetDay && proposedSlots.has(p)) return;

        // SKIP if this slot is part of what we are "ignoring" (the source of the move)
        if (ignoredSlots.has(`${d}-${p}`)) return;

        if (slot.subjectId === subjectId) {
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
        penaltyPoints: 5000, 
        conflictCount: 1,
      };
    }
  }

  return null;
};

/**
 * REFACTORED: Gap Detection (Break/Lunch Aware & Class-Sensitive)
 * 1. Ignores BREAK and LUNCH periods (Bridge Logic).
 * 2. Only flags gaps if the empty slot occurs between sessions of the SAME class group (Same Class Rule).
 * 3. TEACHER Gaps are now explicitly ignored as per user directive.
 */
export const checkGapDetection = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<string>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, targetDay, structure } = ctx;

  // 1. CLASS GAP DETECTION
  // We only care about gaps for THIS class on THIS day.
  for (const p of Array.from(proposedSlots)) {
    const prevInstructionalP = getPrevClassPeriod(p, structure);
    if (prevInstructionalP !== null) {
      const isNeighborEmpty = state
        ? (state.classOccupancy[classId]?.[targetDay]?.[prevInstructionalP] === null || ignoredSlots.has(`${targetDay}-${prevInstructionalP}`))
        : (data.schedule[classId]?.[targetDay]?.[prevInstructionalP] === undefined || ignoredSlots.has(`${targetDay}-${prevInstructionalP}`));

      if (isNeighborEmpty) {
        const sourceInstructionalP = getPrevClassPeriod(prevInstructionalP, structure);
        if (sourceInstructionalP !== null) {
          const isSourceOccupied = state
            ? (state.classOccupancy[classId]?.[targetDay]?.[sourceInstructionalP] !== null && !ignoredSlots.has(`${targetDay}-${sourceInstructionalP}`))
            : (data.schedule[classId]?.[targetDay]?.[sourceInstructionalP] !== undefined && !ignoredSlots.has(`${targetDay}-${sourceInstructionalP}`));

          if (isSourceOccupied) {
            return {
              valid: false,
              message: "Class Gap detected",
              severity: "MEDIUM",
              penaltyPoints: 400,
              conflictCount: 0,
            };
          }
        }
      }
    }
  }

  return null;
};

/**
 * RULE: Teacher Continuity (Same Class Rule)
 * Ensures that if a teacher has multiple lessons with the same Class Group on a specific day,
 * they are NOT separated by sessions with OTHER class groups.
 * Gaps (Free periods) are allowed and ignored for teachers.
 */
export const checkTeacherContinuity = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<string>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, teacherId, classId, targetDay, maxPeriods, structure } = ctx;

  const occupiedPeriods: number[] = [];

  for (let p = 0; p < maxPeriods; p++) {
    let isOccupiedByThisClass = false;

    if (proposedSlots.has(p)) {
      isOccupiedByThisClass = true;
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
      const entry = state 
        ? state.schedule[classId]?.[targetDay]?.[p] 
        : data.schedule[classId]?.[targetDay]?.[p];
      
      if (entry && entry.teacherId === teacherId) {
        isOccupiedByThisClass = true;
      }
    }

    if (isOccupiedByThisClass) {
      occupiedPeriods.push(p);
    }
  }

  if (occupiedPeriods.length <= 1) return null;

  const minP = occupiedPeriods[0];
  const maxP = occupiedPeriods[occupiedPeriods.length - 1];

  for (let p = minP + 1; p < maxP; p++) {
    if (getType(structure, p) === "CLASS") {
      let isThisClass = false;
      if (proposedSlots.has(p)) {
        isThisClass = true;
      } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
        const entry = state 
          ? state.schedule[classId]?.[targetDay]?.[p] 
          : data.schedule[classId]?.[targetDay]?.[p];
        
        if (entry && entry.teacherId === teacherId) {
          isThisClass = true;
        }
      }

      if (!isThisClass) {
        // We only flag if the teacher is busy with ANOTHER class.
        // If the teacher is FREE (null), we ignore the gap.
        if (state) {
          const teacherOccupant = state.teacherOccupancy[teacherId]?.[targetDay]?.[p];
          if (teacherOccupant && teacherOccupant !== "BLOCK" && !ignoredSlots.has(`${targetDay}-${p}`)) {
            const cls = data.classes.find(c => c.id === classId);
            return {
              valid: false,
              message: `Teacher sessions with ${cls?.name || "this class"} must be continuous`,
              severity: "MEDIUM",
              penaltyPoints: 600,
              conflictCount: 0,
            };
          }
        } else {
          for (const otherCId of Object.keys(data.schedule)) {
             const slot = data.schedule[otherCId]?.[targetDay]?.[p];
             if (slot && slot.teacherId === teacherId && !ignoredSlots.has(`${targetDay}-${p}`)) {
                const cls = data.classes.find(c => c.id === classId);
                return {
                  valid: false,
                  message: `Teacher sessions with ${cls?.name || "this class"} must be continuous`,
                  severity: "MEDIUM",
                  penaltyPoints: 600,
                  conflictCount: 0,
                };
             }
          }
        }
      }
    }
  }

  return null;
};

/**
 * RULE: Subject Continuity
 * Ensures that a subject is only scheduled in one continuous block per day for a class.
 * Breaks and Lunches act as "bridges" and do not count as splits.
 */
export const checkSubjectContinuity = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<string>,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods, structure } = ctx;

  const occupiedPeriods: number[] = [];

  for (let p = 0; p < maxPeriods; p++) {
    let isOccupiedBySubject = false;

    if (proposedSlots.has(p)) {
      isOccupiedBySubject = true;
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
      const entry = state 
        ? state.schedule[classId]?.[targetDay]?.[p] 
        : data.schedule[classId]?.[targetDay]?.[p];
      
      if (entry && entry.subjectId === subjectId) {
        isOccupiedBySubject = true;
      }
    }

    if (isOccupiedBySubject) {
      occupiedPeriods.push(p);
    }
  }

  if (occupiedPeriods.length <= 1) return null;

  const minP = occupiedPeriods[0];
  const maxP = occupiedPeriods[occupiedPeriods.length - 1];

  for (let p = minP + 1; p < maxP; p++) {
    if (getType(structure, p) === "CLASS") {
      let isThisSubject = false;
      if (proposedSlots.has(p)) {
        isThisSubject = true;
      } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
        const entry = state 
          ? state.schedule[classId]?.[targetDay]?.[p] 
          : data.schedule[classId]?.[targetDay]?.[p];
        
        if (entry && entry.subjectId === subjectId) {
          isThisSubject = true;
        }
      }

      if (!isThisSubject) {
        const subject = data.subjects.find(s => s.id === subjectId);
        return {
          valid: false,
          message: `Subject '${subject?.name || "Unknown"}' must be in a continuous block`,
          severity: "HIGH",
          penaltyPoints: 1500,
          conflictCount: 1,
        };
      }
    }
  }

  return null;
};