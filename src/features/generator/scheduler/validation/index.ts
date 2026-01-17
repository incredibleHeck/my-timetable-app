import { AppData, Conflict } from "../../../../types";
import { calculateClassSchedule } from "../../../../utils/timeUtils";
import { getType } from "./utils";
import { ValidationContext, ValidationResult } from "./types";
import {
  checkGlobalAndClassBlocks,
  checkResourceAndAvailability,
} from "./basic-rules";
import { checkOverlaps } from "./overlap-checks";
import { checkTeacherLoad, checkSubjectLimit, checkGapDetection } from "./load-checks";

/**
 * CORE VALIDATOR: checkSlotValidity
 * Checks if a specific assignment (or move) is valid within the current schedule state.
 */
export const checkSlotValidity = (
  data: AppData,
  targetDay: number,
  targetPeriod: number,
  teacherId: string,
  classId: string,
  subjectId: string,
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
  const maxPeriods = Math.max(
    cls?.periodCount || settings.periodsPerDay,
    structure?.length || 0
  );

  // --- 2. IGNORE LIST SETUP ---
  // When validating a 'Move', we must ignore the teacher's current presence in the 'Old' slots
  const ignoredSlots = new Set<number>();
  const daySchedule = data.schedule[classId]?.[targetDay] || {};

  const populateIgnored = (setting: {
    day: number;
    period: number;
    duration?: number;
  }) => {
    if (targetDay === setting.day) {
      let startP = setting.period;
      let dur = setting.duration ?? duration;
      const s = daySchedule[startP];
      if (s && (s as any).isFixed) startP--; // Correctly identify the head of a double

      let c = 0,
        o = 0;
      while (c < dur) {
        const p = startP + o;
        if (p >= maxPeriods) break;
        if (getType(structure, p) === "CLASS") {
          ignoredSlots.add(p);
          c++;
        }
        o++;
      }
    }
  };

  if (ignoreSlot) populateIgnored(ignoreSlot);
  if (ignoreTargetSlot) populateIgnored(ignoreTargetSlot as any);

  // Pre-calculate all class schedules for physical overlap checking
  const allClassSchedules = new Map<string, any[]>();
  classes.forEach((c) => {
    allClassSchedules.set(
      c.id,
      calculateClassSchedule(c, settings, c.structure || settings.dayStructure)
    );
  });

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
    classSchedule: allClassSchedules.get(classId) || [],
    allClassSchedules,
    ignoredSlots,
  };

  // --- 3. PERIOD LOOP (SLOT BY SLOT CHECKS) ---
  const proposedSlots = new Set<number>();
  let periodsConsumed = 0;
  let currentOffset = 0;

  // We iterate until we've satisfied the duration, skipping non-class slots (Breaks/Lunch)
  while (periodsConsumed < duration) {
    const p = targetPeriod + currentOffset;
    if (p >= maxPeriods)
      return { valid: false, message: "Exceeds daily limit", severity: "HIGH" };

    // Skip Breaks/Lunch but keep looking for the next CLASS slot
    if (getType(structure, p) !== "CLASS") {
      currentOffset++;
      continue;
    }

    proposedSlots.add(p);

    // Hard Constraint Checks
    const blockError = checkGlobalAndClassBlocks(ctx, p);
    if (blockError) {
      console.log(`Failed blockError at P${p}: ${blockError.message}`);
      return blockError;
    }

    const resourceError = checkResourceAndAvailability(ctx, p);
    if (resourceError) {
      console.log(`Failed resourceError at P${p}: ${resourceError.message}`);
      return resourceError;
    }

    const overlapError = checkOverlaps(ctx, p);
    if (overlapError) {
      console.log(`Failed overlapError at P${p}: ${overlapError.message}`);
      return overlapError;
    }

    // Room Capacity Check
    if (roomId) {
      const room = rooms.find((r) => r.id === roomId);
      if (room && cls && (cls.studentCount || 0) > room.capacity) {
        return {
          valid: false,
          message: `Room capacity exceeded (${cls.studentCount}/${room.capacity})`,
          severity: "MEDIUM",
        };
      }
    }

    periodsConsumed++;
    currentOffset++;
  }

  // --- 4. LOAD & PATTERN CHECKS ---
  const loadError = checkTeacherLoad(ctx, proposedSlots, ignoredSlots);
  if (loadError) return loadError;

  const subjectError = checkSubjectLimit(ctx, proposedSlots, ignoredSlots);
  if (subjectError) return subjectError;

  const gapError = checkGapDetection(ctx, proposedSlots, ignoredSlots);
  if (gapError) return gapError;

  // --- 5. JOINT CLASS INTEGRITY ---
  const isJoint = data.jointClasses?.some(
    (jc) => jc.subjectId === subjectId && jc.classIds.includes(classId)
  );
  if (isJoint && !isAuto) {
    return {
      valid: false,
      message: "Joint classes must be moved via the Generator",
      severity: "HIGH",
    };
  }

  // --- 6. SWAP ANALYSIS ---
  const targetSlot = data.schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
    if ((targetSlot as any).locked)
      return {
        valid: false,
        message: "Target slot is locked",
        severity: "HIGH",
      };
    return { valid: true, isSwap: true, message: "Swap available" };
  }

  return { valid: true, message: "Available" };
};

/**
 * FULL AUDIT: validateFullSchedule
 * Scans the entire generated schedule and returns a list of all existing conflicts.
 */

export const validateFullSchedule = (data: AppData): Conflict[] => {
  const { schedule, classes, subjects, teachers } = data;
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

        // Skip "Tails" (The second part of a double period) to avoid double-validating
        if (slot.isFixed) continue;

        // Detect if this is a double period
        let nextP = period + 1;
        const hasNext =
          daySchedule[nextP] &&
          daySchedule[nextP].isFixed &&
          daySchedule[nextP].subjectId === slot.subjectId;
        const duration = hasNext ? 2 : 1;

        const result = checkSlotValidity(
          data,
          day,
          period,
          slot.teacherId,
          classId,
          slot.subjectId,
          { day, period, duration }, // Ignore the current placement to see if it's legally valid
          slot.roomId,
          duration,
          undefined,
          true
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
            day,
            period,
            reason: result.message || "Constraint Violation",
            severity: result.severity || "HIGH",
          });
        }
      }
    }
  }
  return allConflicts;
};
