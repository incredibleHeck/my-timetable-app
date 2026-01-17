import { AppData, Conflict } from "../../../../types";
import {
  calculateClassSchedule,
  doTimeRangesOverlap,
} from "../../../../utils/timeUtils";
import { getType } from "./utils";
import { ValidationContext, ValidationResult } from "./types";
import {
  checkGlobalAndClassBlocks,
  checkResourceAndAvailability,
} from "./basic-rules";
import { checkOverlaps } from "./overlap-checks";
import { checkTeacherLoad } from "./load-checks";

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
    cls?.structure?.length || 0
  );

  // Pre-calculate schedules (Optimization: could be moved out if perf issues arise)
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
  };

  // --- 2. PERIOD LOOP (SLOT BY SLOT CHECKS) ---
  const proposedSlots = new Set<number>();
  let periodsConsumed = 0;
  let currentOffset = 0;

  while (periodsConsumed < duration) {
    const p = targetPeriod + currentOffset;
    if (p >= maxPeriods)
      return { valid: false, message: "Exceeds daily limit", severity: "HIGH" };

    if (getType(structure, p) !== "CLASS") {
      currentOffset++;
      continue;
    }

    proposedSlots.add(p);

    // Rule A: Global & Class Blocks
    const blockError = checkGlobalAndClassBlocks(ctx, p);
    if (blockError) return blockError;

    // Rule B: Resources & Teacher Availability
    const resourceError = checkResourceAndAvailability(ctx, p);
    if (resourceError) return resourceError;

    // Rule C: Complex Overlaps (Teacher & Room with Joint Logic)
    const overlapError = checkOverlaps(ctx, p);
    if (overlapError) return overlapError;

    // Rule D: Room Capacity
    if (roomId) {
      const room = rooms.find((r) => r.id === roomId);
      if (room && cls && (cls.studentCount || 0) > room.capacity) {
        return {
          valid: false,
          message: `Capacity (${room.capacity}) exceeded by ${cls.name}`,
          severity: "MEDIUM",
        };
      }
    }

    periodsConsumed++;
    currentOffset++;
  }

  // --- 3. IGNORE LIST (FOR LOAD CHECKS) ---
  const ignoredSlots = new Set<number>();
  const daySchedule = data.schedule[classId]?.[targetDay] || {};

  const populateIgnored = (setting: {
    day: number;
    period: number;
    duration?: number;
  }) => {
    if (String(targetDay) === String(setting.day)) {
      let startP = setting.period;
      let dur = setting.duration ?? duration;
      // Adjust for tails
      const s = daySchedule[startP];
      if (s && (s as any).isFixed) startP--;

      let c = 0,
        o = 0;
      while (c < (dur === 2 && s && (s as any).isFixed ? 2 : dur)) {
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

  // --- 4. TEACHER LOAD CHECKS (WHOLE DAY) ---
  const loadError = checkTeacherLoad(ctx, proposedSlots, ignoredSlots);
  if (loadError) return loadError;

  // --- 5. JOINT CLASS INTEGRITY ---
  const isJoint = data.jointClasses?.some(
    (jc) => jc.subjectId === subjectId && jc.classIds.includes(classId)
  );
  if (isJoint && !isAuto) {
    return {
      valid: false,
      message: "Cannot move Joint Class manually",
      severity: "HIGH",
    };
  }

  // --- 6. SWAP LOGIC ---
  const targetSlot = data.schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
    if ((targetSlot as any).locked)
      return { valid: false, message: "Target Locked", severity: "HIGH" };
    if (targetSlot.electiveBlockId)
      return { valid: false, message: "Target is Elective", severity: "HIGH" };
    return { valid: true, isSwap: true, message: "Swap available" };
  }

  // Check P2 for Swap
  if (duration === 2) {
    let nextP = targetPeriod + 1;
    while (nextP < maxPeriods && getType(structure, nextP) !== "CLASS") nextP++;
    if (nextP < maxPeriods && data.schedule[classId]?.[targetDay]?.[nextP]) {
      return { valid: true, isSwap: true, message: "Swap available (P2)" };
    }
  }

  return { valid: true, message: "Available" };
};

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
        if (slot.isFixed) continue; // Skip tails

        // Calculate duration logic
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
          { day, period, duration },
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
            reason: result.message || "Invalid",
            severity: result.severity || "HIGH",
          });
        }
      }
    }
  }
  return allConflicts;
};
