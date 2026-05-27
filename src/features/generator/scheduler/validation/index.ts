import { AppData, Conflict } from "../../../../types";
import { getType } from "./utils";
import { initializeState } from "../core/state";
import {
  collectResourceDoubleBookings,
  conflictDedupeKey,
  curriculumGapsToConflicts,
  dedupeConflicts,
  detectCurriculumGaps,
} from "./final-conflicts";
import { ValidationContext, ValidationResult } from "./types";
import { SchedulerState } from "../core/types";
import { getNextClassPeriod, getPrevClassPeriod } from "../utils/utils";
import {
  checkGlobalAndClassBlocks,
  checkResourceAndAvailability,
} from "./basic-rules";
import { checkOverlaps } from "./overlap-checks";
import { 
  checkTeacherLoad, 
  checkSubjectLimit, 
  checkGapDetection,
  checkTeacherContinuity,
  checkSubjectContinuity
} from "./load-checks";

/**
 * CORE VALIDATOR: checkSlotValidity
 * Re-engineered to support Heuristic-Driven Optimization.
 * Now returns penalty points and conflict counts for the Min-Conflicts solver.
 */
export const checkSlotValidity = (
  data: AppData,
  targetDay: number,
  targetPeriod: number,
  teacherId: string,
  classId: string,
  subjectId: string,
  state: SchedulerState, // Now Mandatory for O(1) performance
  ignoreSlot?: { day: number; period: number; duration?: number },
  roomId?: string,
  duration: number = 1,
  ignoreTargetSlot?: { day: number; period: number; duration: number },
  isAuto: boolean = false
): ValidationResult => {
  const { settings, classes, rooms } = data;

  // --- RANK 0 & 1.1: CONTEXT SETUP ---
  const cls = classes.find((c) => c.id === classId);
  const structure = cls?.structure || settings.dayStructure;
  
  // PRIORITIZE Class Structure: If a class says it only has 12 periods, 
  // the 13th period is functionally non-existent for them.
  const maxPeriods = cls?.periodCount ?? settings.periodsPerDay;

  // --- 2. IGNORE LIST SETUP (For Non-Destructive Simulation) ---
  const ignoredSlots = new Set<string>(); // Use "day-period" strings to support cross-day moves
  const scheduleSource = state ? state.schedule : data.schedule;

  const populateIgnored = (setting: { day: number; period: number; duration?: number }) => {
    let startP = setting.period;
    let dur = setting.duration ?? duration;
    const d = setting.day;

    // If we are looking at the 'tail' of a double, move to the 'head'
    const entry = scheduleSource[classId]?.[d]?.[startP];
    if (entry?.isFixed) {
      const prev = getPrevClassPeriod(startP, structure);
      if (prev !== null) {
        const prevEntry = scheduleSource[classId]?.[d]?.[prev];
        const sameUnit =
          prevEntry?.unitId &&
          entry.unitId &&
          prevEntry.unitId === entry.unitId;
        const sameLesson =
          prevEntry &&
          !prevEntry.isFixed &&
          prevEntry.subjectId === entry.subjectId &&
          prevEntry.teacherId === entry.teacherId;
        if (sameUnit || sameLesson) {
          startP = prev;
        }
      }
    }

    let consumed = 0, offset = 0;
    while (consumed < dur && (startP + offset) < maxPeriods) {
      if (getType(structure, startP + offset) === "CLASS") {
        ignoredSlots.add(`${d}-${startP + offset}`);
        consumed++;
      }
      offset++;
    }
  };

  if (ignoreSlot) populateIgnored(ignoreSlot);
  if (ignoreTargetSlot) populateIgnored(ignoreTargetSlot);

  const hasRealTeacher =
    !!teacherId && data.teachers.some((t) => t.id === teacherId);
  const hasRealSubject =
    !!subjectId && data.subjects.some((s) => s.id === subjectId);

  // --- 3. CONTEXT INITIALIZATION ---
  const ctx: ValidationContext = {
    data,
    targetDay,
    targetPeriod,
    teacherId,
    classId,
    subjectId,
    roomId,
    duration,
    maxPeriods,
    structure,
    classSchedule: state.classTimeRanges.get(classId) || [],
    allClassSchedules: state.classTimeRanges,
    ignoredSlots,
  };

  // --- 4. PERIOD LOOP (RANK 1: THE INVARIANTS) ---
  const proposedSlots = new Set<number>();
  let periodsConsumed = 0;
  let currentOffset = 0;

  while (periodsConsumed < duration) {
    const p = targetPeriod + currentOffset;
    
    // Boundary check
    if (p >= maxPeriods) {
      return { 
        valid: false, message: "Exceeds daily period limit", 
        severity: "HIGH", penaltyPoints: 2000, conflictCount: 1 
      };
    }

    // RANK 0: Structural Hierarchy (Must be CLASS slot for this specific class)
    // If this is not a 'CLASS' slot, we skip it for multi-period units (Bridge Logic).
    if (getType(structure, p) !== "CLASS") {
      // If the lesson STARTS on a break, it's invalid.
      if (periodsConsumed === 0) {
        return { 
          valid: false, message: "Non-instructional slot (Break/Lunch/Hidden)", 
          severity: "HIGH", penaltyPoints: 100000, conflictCount: 1 
        };
      }
      // Otherwise, we skip this slot and look for the next class slot
      currentOffset++;
      continue;
    }
    
    proposedSlots.add(p);

    // A. Global & Class Blocks (Worship, Assembly, off-site sessions)
    const blockError = checkGlobalAndClassBlocks(ctx, p);
    if (blockError) return { ...blockError, penaltyPoints: 20000, conflictCount: 1 };

    // B/C. Resource + overlap checks only for assigned real teacher/subject
    if (hasRealTeacher && hasRealSubject) {
      const resourceError = checkResourceAndAvailability(ctx, p, state);
      if (resourceError) {
        if (resourceError.message && resourceError.message.includes("Teacher Busy")) {
          return { ...resourceError, message: "Teacher is busy", penaltyPoints: 5000, conflictCount: 1 };
        }
        return { ...resourceError, penaltyPoints: 5000, conflictCount: 1 };
      }

      const overlapError = checkOverlaps(ctx, p, state);
      if (overlapError) return { ...overlapError, penaltyPoints: 5000, conflictCount: 1 };
    }

    // D. Room Capacity
    if (roomId) {
      const room = rooms.find((r) => r.id === roomId);
      if (room && cls && (cls.studentCount || 0) > room.capacity) {
        return { 
          valid: false, message: `Room capacity exceeded (${cls.studentCount}/${room.capacity})`, 
          severity: "MEDIUM", penaltyPoints: 2000, conflictCount: 1 
        };
      }
    }

    periodsConsumed++;
    currentOffset++;
  }

  // --- 4.1 PEDAGOGICAL HARD WALLS ---
  // RANK 1.4: Curriculum Respect (Subject Max Per Day)
  const subjectError = checkSubjectLimit(ctx, proposedSlots, ignoredSlots, state);
  if (subjectError) return { ...subjectError, penaltyPoints: 10000, conflictCount: 1 };

  // --- 5. SWAP ANALYSIS (interactive drag-and-drop only, not schedule re-audit) ---
  const targetSlot = data.schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot && !isAuto && ignoreTargetSlot) {
    if ((targetSlot as any).locked)
      return {
        valid: false,
        message: "Target slot is locked",
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    return {
      valid: true,
      isSwap: true,
      message: "Swap available",
      penaltyPoints: 0,
      conflictCount: 0,
    };
  }

  // --- 6. PATTERN & CURRICULUM CHECKS (SOFT/MEDIUM CONSTRAINTS) ---
  
  // RANK 1.3: Teacher Load (Daily Limits & Consecutive Max)
  const loadError = checkTeacherLoad(ctx, proposedSlots, ignoredSlots, state);
  if (loadError) {
    return { ...loadError, penaltyPoints: loadError.penaltyPoints ?? 800, conflictCount: loadError.conflictCount ?? 0 };
  }

  // RANK 1.5: Class Gaps (The Sandwich Rule)
  const gapError = checkGapDetection(ctx, proposedSlots, ignoredSlots, state);
  if (gapError) return { ...gapError, penaltyPoints: 400, conflictCount: 0 };

  // RANK 8: Subject Continuity
  const continuityError = checkSubjectContinuity(ctx, proposedSlots, ignoredSlots, state);
  if (continuityError) return { ...continuityError, penaltyPoints: 1500, conflictCount: 1 };

  // Teacher Continuity (Same Class Rule)
  const teacherContinuityError = checkTeacherContinuity(ctx, proposedSlots, ignoredSlots, state);
  if (teacherContinuityError) {
    return { ...teacherContinuityError, penaltyPoints: 600, conflictCount: 0 };
  }

  // --- 6. JOINT CLASS INTEGRITY ---
  const isJoint = data.jointClasses?.some(jc => jc.subjectId === subjectId && jc.classIds.includes(classId));
  if (isJoint && !isAuto) {
    return { 
      valid: false, message: "Joint classes must be moved via the Generator", 
      severity: "HIGH", penaltyPoints: 1000, conflictCount: 1 
    };
  }

  return { valid: true, message: "Available", penaltyPoints: 0, conflictCount: 0 };
};

/**
 * FULL AUDIT: validateFullSchedule
 * Scans the entire generated state to find every constraint violation.
 *
 * GHOST-CONFLICT ISOLATION
 * - `allConflicts` is a brand-new array per call; it is not seeded from
 *   `data.conflicts` and never references any external mutable list.
 * - `state` MUST be a freshly built `initializeState(data)` snapshot of the
 *   FINAL committed timetable. Passing in a solver-internal state that was
 *   mutated mid-iteration will produce ghost conflicts. The only sanctioned
 *   caller is `auditFinalSchedule` below, which always rebuilds state.
 */
export const validateFullSchedule = (data: AppData, state: SchedulerState): Conflict[] => {
  const { classes, subjects, teachers, settings } = data;
  // Read EXCLUSIVELY from the freshly-rebuilt state.schedule so that
  // ad-hoc mutations to `data.schedule` made elsewhere cannot bleed in.
  const schedule = state.schedule;
  const allConflicts: Conflict[] = [];

  for (const classId of Object.keys(schedule)) {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) continue;

    const structure = cls.structure || settings.dayStructure;
    const classLimit = cls.periodCount ?? settings.periodsPerDay;

    for (const dayStr of Object.keys(schedule[classId])) {
      const day = parseInt(dayStr);
      const daySchedule = schedule[classId][day];

      for (const periodStr of Object.keys(daySchedule)) {
        const period = parseInt(periodStr);
        const slot = daySchedule[period];

        if (!slot?.subjectId || !slot?.teacherId) continue;
        if (!teachers.some((t) => t.id === slot.teacherId)) continue;
        if (slot.isFixed) continue; // Skip tails
        if (getType(structure, period) !== "CLASS") continue;

        // Determine duration by looking ahead using navigation logic
        let duration = 1;
        const nextP = getNextClassPeriod(period, structure, classLimit);
        if (nextP !== null) {
            const nextSlot = daySchedule[nextP];
            if (
              nextSlot &&
              nextSlot.isFixed &&
              nextSlot.subjectId === slot.subjectId &&
              (!nextSlot.unitId ||
                !slot.unitId ||
                nextSlot.unitId === slot.unitId)
            ) {
                duration = 2;
            }
        }

        // Shared/specialist rooms only — not implicit homerooms
        const subject = subjects.find((s) => s.id === slot.subjectId);
        const effectiveRoomId = slot.roomId || subject?.requiredRoomId;

        const result = checkSlotValidity(
          data, day, period, slot.teacherId, classId, slot.subjectId,
          state, { day, period, duration }, effectiveRoomId, duration, undefined, false
        );

        if (!result.valid) {
          const auditSkipMessages = [
            "Non-instructional slot (Break/Lunch/Hidden)",
            "Invalid Period Type",
          ];
          if (
            auditSkipMessages.some((m) =>
              (result.message || "").includes(m),
            )
          ) {
            continue;
          }

          const teacher = teachers.find((t) => t.id === slot.teacherId);
          allConflicts.push({
            classId,
            className: cls.name,
            subjectId: slot.subjectId,
            subjectName: subject?.name || "Unknown",
            teacherId: slot.teacherId,
            teacherName: teacher?.name || "Unknown",
            roomId: effectiveRoomId,
            duration,
            day,
            period,
            reason: result.message || "Constraint Violation",
            severity: result.severity || "HIGH",
            kind: "blocking",
          });
        }
      }
    }
  }
  return allConflicts;
};

/** Post-generate audit: curriculum gaps + slot validation + resource double-bookings, deduped. */
export type ScheduleAuditMode = "generated" | "full";

/**
 * FINAL-STATE AUDIT
 *
 * Hard contract: this function produces conflicts based ONLY on the timetable
 * snapshot present in `data.schedule` at the moment of the call. It MUST NOT
 * read `data.conflicts` (i.e., callers may pass any value or `[]` - it is
 * irrelevant to the result).
 *
 * GHOST-CONFLICT GUARANTEES
 *  1. `state` is freshly built from scratch via `initializeState(data)` -
 *     no reference to any solver tracker survives across audit invocations.
 *  2. `collectResourceDoubleBookings` allocates its own `Map`/`Set` trackers.
 *  3. We seed the audit with an EMPTY `Conflict[]` (`raw`) - never from
 *     `data.conflicts`, never via array spread of any prior list.
 *  4. The returned array is a NEW array (via `dedupeConflicts`) - mutating it
 *     does not retroactively affect any input.
 */
export function auditFinalSchedule(
  data: AppData,
  options?: { mode?: ScheduleAuditMode },
): Conflict[] {
  const mode = options?.mode ?? "full";

  // Defensive: rebuild a clean view of the input where any pre-existing
  // `conflicts` field is wiped. Downstream collectors only read schedule +
  // static catalogs (classes, teachers, rooms, subjects, settings), but this
  // makes the "no historical data" guarantee structurally enforced.
  const auditData: AppData = { ...data, conflicts: [] };

  // Fresh O(1)-lookup state computed from the FINAL committed schedule.
  const state = initializeState(auditData);

  const raw: Conflict[] = [];
  raw.push(...curriculumGapsToConflicts(detectCurriculumGaps(auditData, state)));
  if (mode === "full") {
    raw.push(...validateFullSchedule(auditData, state));
  }
  raw.push(...collectResourceDoubleBookings(auditData));

  return dedupeConflicts(raw);
}

export {
  detectCurriculumGaps,
  dedupeConflicts,
  conflictDedupeKey,
  collectResourceDoubleBookings,
} from "./final-conflicts";
export { runPreflightCheck } from "./preflight";
export type { PreflightIssue, PreflightResult } from "./preflight";
export type { CurriculumGap } from "./final-conflicts";
