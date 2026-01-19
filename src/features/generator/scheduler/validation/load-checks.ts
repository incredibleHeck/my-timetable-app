import { SchedulerState } from "../core/types";
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
  state?: SchedulerState,
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
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
      // O(1) Lookup: Check if teacher is busy elsewhere
      if (state) {
        // Safe check: Ensure we don't treat 'undefined' as occupied
        const occupant = state?.teacherOccupancy[teacherId]?.[targetDay]?.[p];
        if (occupant !== undefined && occupant !== null) {
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
          penaltyPoints: 500 + overflow * 200, // Escalating penalty
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
  state?: SchedulerState,
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods } = ctx;

  // 1. DAILY LIMIT (Pedagogical Variety)
  const maxDaily = data.settings.maxSubjectPeriodsPerDay || 2;
  let dailyCount = 0;

  for (let p = 0; p < maxPeriods; p++) {
    if (proposedSlots.has(p)) {
      dailyCount++;
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
      const entry = state
        ? state?.schedule[classId]?.[targetDay]?.[p]
        : data.schedule[classId]?.[targetDay]?.[p];
      if (entry && entry.subjectId === subjectId) {
        dailyCount++;
      }
    }
  }

  if (dailyCount > maxDaily) {
    return {
      valid: false,
      message: `Max ${maxDaily} periods per day`,
      severity: "HIGH",
      penaltyPoints: 2000,
      conflictCount: 1,
    };
  }

  // 2. TOTAL CURRICULUM ALLOCATION (The "Hard Wall")
  const cls = data.classes.find((c) => c.id === classId);
  const curriculumItem = cls?.curriculum?.find(
    (curr) => curr.subjectId === subjectId,
  );

  if (curriculumItem) {
    const totalAllowed =
      (curriculumItem.singles || 0) + (curriculumItem.doubles || 0) * 2;

    // 1. Start with the proposed slots count (The new placement)
    let totalScheduled = proposedSlots.size;

    const daysPerWeek = (data.settings as any).daysPerWeek || 5;

    for (let d = 0; d < daysPerWeek; d++) {
      const daySched = state
        ? state?.schedule[classId]?.[d]
        : data.schedule[classId]?.[d];
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
          const nextSlot = daySched[p + 1];
          const isDouble =
            nextSlot &&
            (nextSlot as any).isFixed &&
            nextSlot.subjectId === subjectId;

          totalScheduled += isDouble ? 2 : 1;
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
  state?: SchedulerState,
): ValidationResult | null => {
  const { data, classId, targetDay, structure } = ctx;

  // 1. Find the earliest period in the proposed lesson
  const sortedProposed = Array.from(proposedSlots).sort((a, b) => a - b);
  const lessonStart = sortedProposed[0];
  if (lessonStart === undefined) return null;

  // 2. CLASS GAP DETECTION
  // Look backward from the start of this lesson for any PREVIOUS occupied instructional period.
  // If we find an empty CLASS slot between this lesson and a previous one, it's a gap.

  let checkP = getPrevClassPeriod(lessonStart, structure);
  let foundEmptyClassSlot = false;

  while (checkP !== null) {
    // A slot is "Empty" if it's not occupied in state/data AND it's not part of the source we're ignoring
    const isEmpty = state
      ? state?.classOccupancy[classId]?.[targetDay]?.[checkP] === null ||
        ignoredSlots.has(`${targetDay}-${checkP}`)
      : data.schedule[classId]?.[targetDay]?.[checkP] === undefined ||
        ignoredSlots.has(`${targetDay}-${checkP}`);

    if (isEmpty) {
      foundEmptyClassSlot = true;
    } else {
      // We found an occupied slot.
      // If we already passed an empty CLASS slot on the way here, then there's a gap!
      if (foundEmptyClassSlot) {
        return {
          valid: false,
          message: "Class Gap detected",
          severity: "MEDIUM",
          penaltyPoints: 400,
          conflictCount: 0,
        };
      }
      // If we found an occupied slot immediately (no empty CLASS slots in between),
      // then there is no gap between this lesson and the one immediately before it.
      return null;
    }

    checkP = getPrevClassPeriod(checkP, structure);
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
  state?: SchedulerState,
): ValidationResult | null => {
  const { data, teacherId, classId, targetDay, maxPeriods, structure } = ctx;

  const occupiedPeriods: number[] = [];

  for (let p = 0; p < maxPeriods; p++) {
    let isOccupiedByThisClass = false;

    if (proposedSlots.has(p)) {
      isOccupiedByThisClass = true;
    } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
      const entry = state
        ? state?.schedule[classId]?.[targetDay]?.[p]
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
    const type = getType(structure, p);

    if (type === "CLASS") {
      let isThisClass = false;
      if (proposedSlots.has(p)) {
        isThisClass = true;
      } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
        const entry = state
          ? state?.schedule[classId]?.[targetDay]?.[p]
          : data.schedule[classId]?.[targetDay]?.[p];

        if (entry && entry.teacherId === teacherId) {
          isThisClass = true;
        }
      }

      if (!isThisClass) {
        // We only flag if the teacher is busy with ANOTHER class.
        // If the teacher is FREE (null), we ignore the gap.
        if (state) {
          const teacherOccupant =
            state?.teacherOccupancy[teacherId]?.[targetDay]?.[p];
          if (
            teacherOccupant &&
            teacherOccupant !== "BLOCK" &&
            !ignoredSlots.has(`${targetDay}-${p}`)
          ) {
            const cls = data.classes.find((c) => c.id === classId);
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
            if (
              slot &&
              slot.teacherId === teacherId &&
              !ignoredSlots.has(`${targetDay}-${p}`)
            ) {
              const cls = data.classes.find((c) => c.id === classId);
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
 * RULE: Subject Continuity (Holistic)
 * Ensures that EVERY subject scheduled for a class on a specific day exists in one continuous block.
 * This prevents Subject A -> Subject B -> Subject A patterns.
 * Breaks and Lunches act as "bridges" and do not count as splits.
 */
export const checkSubjectContinuity = (
  ctx: ValidationContext,
  proposedSlots: Set<number>,
  ignoredSlots: Set<string>,
  state?: SchedulerState,
): ValidationResult | null => {
  const { data, classId, subjectId, targetDay, maxPeriods, structure } = ctx;

  // 1. Identify all subjects that have any presence for this class today.
  // We check the subject being placed AND any subjects already in the schedule.
  const subjectsToCheck = new Set<string>();
  subjectsToCheck.add(subjectId);

  const daySched = state
    ? state?.schedule[classId]?.[targetDay]
    : data.schedule[classId]?.[targetDay];

  if (daySched) {
    Object.values(daySched).forEach((slot) => {
      if (slot && slot.subjectId) subjectsToCheck.add(slot.subjectId);
    });
  }

  // 2. For each subject, verify it only has ONE continuous block.
  for (const sId of subjectsToCheck) {
    const occupiedPeriods: number[] = [];

    for (let p = 0; p < maxPeriods; p++) {
      let isOccupiedByThisSubject = false;

      // Check if this period is part of the subject's presence
      if (sId === subjectId && proposedSlots.has(p)) {
        isOccupiedByThisSubject = true;
      } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
        const entry = state
          ? state?.schedule[classId]?.[targetDay]?.[p]
          : data.schedule[classId]?.[targetDay]?.[p];

        if (entry && entry.subjectId === sId) {
          isOccupiedByThisSubject = true;
        }
      }

      if (isOccupiedByThisSubject) {
        occupiedPeriods.push(p);
      }
    }

    if (occupiedPeriods.length <= 1) continue;

    const minP = occupiedPeriods[0];
    const maxP = occupiedPeriods[occupiedPeriods.length - 1];

    // Check everything between the first and last occurrence of this subject
    for (let p = minP + 1; p < maxP; p++) {
      const type = getType(structure, p);
      if (type === "CLASS") {
        let currentSubjectAtP: string | null = null;

        if (sId === subjectId && proposedSlots.has(p)) {
          currentSubjectAtP = sId;
        } else if (!ignoredSlots.has(`${targetDay}-${p}`)) {
          const entry = state
            ? state?.schedule[classId]?.[targetDay]?.[p]
            : data.schedule[classId]?.[targetDay]?.[p];

          if (entry) {
            currentSubjectAtP = entry.subjectId;
          }
        }

        // STRICT CONTINUITY CHECK:
        // Every period between min and max must be the SAME subject.
        // Free slots (null) or different subjects are both INVALID.
        if (currentSubjectAtP !== sId) {
          const splitSubject = data.subjects.find((s) => s.id === sId);
          const fillerSubject = currentSubjectAtP
            ? data.subjects.find((s) => s.id === currentSubjectAtP)
            : null;
          const reason = fillerSubject
            ? `sandwiched by '${fillerSubject.name}'`
            : `split by empty period`;

          return {
            valid: false,
            message: `Subject '${splitSubject?.name || "Unknown"}' is ${reason} at P${p + 1} (${type})`,
            severity: "HIGH",
            penaltyPoints: 1500,
            conflictCount: 1,
          };
        }
      }
    }
  }

  return null;
};
