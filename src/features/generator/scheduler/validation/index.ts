import { AppData, Conflict } from "../../../../types";
import { calculateClassSchedule } from "../../../../utils/timeUtils";
import { getType } from "./utils";
import { ValidationContext, ValidationResult } from "./types";
import { SchedulerState } from "../types";
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

  // --- 1. CONTEXT SETUP ---
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
    if (entry && (entry as any).isFixed) startP--; 

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

  // --- 4. PERIOD LOOP (HARD CONSTRAINT & OVERLAP CHECKS) ---
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

    // Skip non-teaching slots (Lunch/Break)
    // If this is a BREAK or LUNCH, we skip it but DON'T count it toward duration
    if (getType(structure, p) !== "CLASS") {
      currentOffset++;
      continue;
    }

    // Logic for cross-day ignored slots
    // During the loop for the TARGET day, we still need to know if the target period is ignored
    // (though usually ignoredSlots for targetDay are for the source of a same-day move)
    
    proposedSlots.add(p);

    // A. Global & Class Blocks (Worship, Assembly, off-site sessions)
    const blockError = checkGlobalAndClassBlocks(ctx, p);
    if (blockError) return { ...blockError, penaltyPoints: 1500, conflictCount: 1 };

    // B. Resource Availability (Teacher/Resource grids)
    const resourceError = checkResourceAndAvailability(ctx, p, state);
    if (resourceError) {
      if (resourceError.message && resourceError.message.includes("Teacher Busy")) {
        return { ...resourceError, message: "Teacher is busy", penaltyPoints: 1000, conflictCount: 1 };
      }
      return { ...resourceError, penaltyPoints: 1000, conflictCount: 1 };
    }

    // C. Physical Overlaps (Teacher/Room double-booking)
    const overlapError = checkOverlaps(ctx, p, state);
    if (overlapError) return { ...overlapError, penaltyPoints: 1000, conflictCount: 1 };

    // D. Room Capacity
    if (roomId) {
      const room = rooms.find((r) => r.id === roomId);
      if (room && cls && (cls.studentCount || 0) > room.capacity) {
        return { 
          valid: false, message: `Room capacity exceeded (${cls.studentCount}/${room.capacity})`, 
          severity: "MEDIUM", penaltyPoints: 500, conflictCount: 1 
        };
      }
    }

    periodsConsumed++;
    currentOffset++;
  }

  // --- 5. SWAP ANALYSIS (Before Soft Checks) ---
  const targetSlot = data.schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot && !isAuto) {
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
  
  // A. Teacher Load (Daily Limits & Consecutive Max)
  const loadError = checkTeacherLoad(ctx, proposedSlots, ignoredSlots, state);
  if (loadError) return { ...loadError, penaltyPoints: 800, conflictCount: 0 };

  // B. Curriculum Respect (Subject Max Per Day)
  const subjectError = checkSubjectLimit(ctx, proposedSlots, ignoredSlots, state);
  if (subjectError) return { ...subjectError, penaltyPoints: 600, conflictCount: 0 };

  // B2. Subject Continuity (Hard Constraint) - Prevents subject sandwiching
  const continuityError = checkSubjectContinuity(ctx, proposedSlots, ignoredSlots, state);
  if (continuityError) return { ...continuityError, penaltyPoints: 1500, conflictCount: 1 };

  // D. Teacher Continuity (Same Class Rule) - Prevents sandwiching different classes
  const teacherContinuityError = checkTeacherContinuity(ctx, proposedSlots, ignoredSlots, state);
  if (teacherContinuityError) return { ...teacherContinuityError, penaltyPoints: 600, conflictCount: 0 };

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
 */
export const validateFullSchedule = (data: AppData, state: SchedulerState): Conflict[] => {
  const { classes, subjects, teachers } = data;
  // Use the schedule from the state (result) if provided, otherwise fallback to data (input)
  const schedule = state ? state.schedule : data.schedule;
  const allConflicts: Conflict[] = [];

  for (const classId of Object.keys(schedule)) {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) continue;

    for (const dayStr of Object.keys(schedule[classId])) {
      const day = parseInt(dayStr);
      const daySchedule = schedule[classId][day];

      for (const periodStr of Object.keys(daySchedule)) {
        const period = parseInt(periodStr);
        const slot = daySchedule[period];

        if (slot.isFixed) continue; // Skip tails

        // Determine duration
        let nextP = period + 1;
        const hasNext = daySchedule[nextP] && daySchedule[nextP].isFixed && daySchedule[nextP].subjectId === slot.subjectId;
        const duration = hasNext ? 2 : 1;

        // Resolve Effective Room (Subject Specific or Home Room Fallback)
        const subject = subjects.find((s) => s.id === slot.subjectId);
        const effectiveRoomId = slot.roomId || subject?.requiredRoomId || cls.defaultRoomId;

        const result = checkSlotValidity(
          data, day, period, slot.teacherId, classId, slot.subjectId,
          state, { day, period, duration }, effectiveRoomId, duration, undefined, true
        );

        if (!result.valid) {
          const subject = subjects.find((s) => s.id === slot.subjectId);
          const teacher = teachers.find((t) => t.id === slot.teacherId);
          allConflicts.push({
            classId,
            className: cls.name,
            subjectId: slot.subjectId,
            subjectName: subject?.name || "Unknown",
            teacherName: teacher?.name || "Unknown",
            day, period,
            reason: result.message || "Constraint Violation",
            severity: result.severity || "HIGH",
          });
        }
      }
    }
  }
  return allConflicts;
};
