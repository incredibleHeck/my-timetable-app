import {
  AppData,
  ScheduleSlot,
  Conflict,
  PeriodConfig,
  PeriodType,
} from "../../../types";
import {
  calculateClassSchedule,
  doTimeRangesOverlap,
} from "../../../utils/timeUtils";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  isSwap?: boolean;
  severity?: "HIGH" | "MEDIUM" | "LOW";
};

// HELPER: Safely get the type of a period (handling string vs object structure)
const getType = (
  structure: (PeriodConfig | PeriodType)[] | undefined,
  p: number
): string => {
  const item = structure?.[p];
  if (!item) return "CLASS"; // Default
  if (typeof item === "string") return item;
  return item.type;
};

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
  const { schedule, settings, classes, teachers, subjects, rooms } = data;

  // Pre-calculate all class schedules once (Consider moving this outside if performance issues arise)
  const allClassSchedules = new Map<string, any[]>();
  classes.forEach((c) => {
    allClassSchedules.set(
      c.id,
      calculateClassSchedule(c, settings, c.structure || settings.dayStructure)
    );
  });

  const targetClassSchedule = allClassSchedules.get(classId) || [];
  const cls = classes.find((c) => c.id === classId);
  const structure = cls?.structure || settings.dayStructure;
  const maxPeriods = Math.max(
    cls?.periodCount || settings.periodsPerDay,
    cls?.structure?.length || 0
  );

  // Track which periods are actually being proposed (skipping breaks)
  const proposedSlots = new Set<number>();
  let periodsConsumed = 0;
  let currentOffset = 0;

  while (periodsConsumed < duration) {
    const p = targetPeriod + currentOffset;
    if (p >= maxPeriods)
      return { valid: false, message: "Exceeds daily limit", severity: "HIGH" };

    const type = getType(structure, p);

    if (type !== "CLASS") {
      currentOffset++;
      continue;
    }

    proposedSlots.add(p);

    // 1. GLOBAL CHECKS
    const globalFixed = settings.fixedOccasions?.[targetDay]?.[p];
    if (globalFixed) {
      const label =
        typeof globalFixed === "object" && "name" in globalFixed
          ? globalFixed.name
          : "School Event";
      return { valid: false, message: `Global: ${label}`, severity: "HIGH" };
    }

    // 2. CLASS CHECKS
    if (cls?.fixedSessions?.[targetDay]?.[p]) {
      const fixedLabel = cls.fixedSessions[targetDay][p];
      return {
        valid: false,
        message: `Class Busy: ${fixedLabel}`,
        severity: "HIGH",
      };
    }

    // 3. RESOURCE CHECKS
    const subject = subjects.find((s) => s.id === subjectId);
    if (subject?.isSingleResource) {
      for (const otherCId of Object.keys(schedule)) {
        if (otherCId === classId) continue;
        const otherSlot = schedule[otherCId]?.[targetDay]?.[p];
        if (otherSlot && otherSlot.subjectId === subjectId) {
          return {
            valid: false,
            message: `${subject.name} is already being taught elsewhere`,
            severity: "HIGH",
          };
        }
      }
    }

    // 4. TEACHER CHECKS
    const teacher = teachers.find((t) => t.id === teacherId);
    if (teacher?.constraints?.[targetDay]?.[p]) {
      return {
        valid: false,
        message: `${teacher.name} not available`,
        severity: "HIGH",
      };
    }

    // Overlaps
    const targetTimeRange = targetClassSchedule[p];
    for (const cId of Object.keys(schedule)) {
      if (cId === classId) continue;
      const otherClassSchedule = allClassSchedules.get(cId);
      if (!otherClassSchedule) continue;

      const otherDaySlots = schedule[cId]?.[targetDay] || {};
      for (const otherPStr in otherDaySlots) {
        const otherP = parseInt(otherPStr); // FIX: Ensure numeric index
        const slot = otherDaySlots[otherP]; // FIX: Access via number

        if (slot && slot.teacherId === teacherId) {
          const otherTimeRange = otherClassSchedule[otherP];
          if (
            targetTimeRange &&
            otherTimeRange &&
            doTimeRangesOverlap(targetTimeRange, otherTimeRange)
          ) {
            // Check if this is a Joint Class or Elective Block overlap (Allowed)
            const isJointOverlap = data.jointClasses?.some(
              (jc) =>
                jc.subjectId === subjectId &&
                jc.classIds.includes(classId) &&
                jc.classIds.includes(cId)
            );
            const isElectiveOverlap = data.electives?.some(
              (e) => e.classIds.includes(classId) && e.classIds.includes(cId)
            );

            if (!isJointOverlap && !isElectiveOverlap) {
              const otherCls = classes.find((c) => c.id === cId);
              const className = otherCls?.name || "another class";
              return {
                valid: false,
                message: `Teacher is busy in ${className}`,
                severity: "HIGH",
              };
            }
          }
        }
        if (roomId && slot && slot.roomId === roomId) {
          const otherTimeRange = otherClassSchedule[otherP];
          if (
            targetTimeRange &&
            otherTimeRange &&
            doTimeRangesOverlap(targetTimeRange, otherTimeRange)
          ) {
            const otherCls = classes.find((c) => c.id === cId);
            const className = otherCls?.name || "another class";
            return {
              valid: false,
              message: `Room occupied by ${className}`,
              severity: "HIGH",
            };
          }
        }
      }
    }

    if (roomId) {
      const room = rooms.find((r) => r.id === roomId);
      if (room && cls && (cls.studentCount || 0) > room.capacity) {
        return {
          valid: false,
          message: `Room capacity (${room.capacity}) exceeded by ${cls.name}`,
          severity: "MEDIUM",
        };
      }
    }

    periodsConsumed++;
    currentOffset++;
  }

  // --- ATOMIC CALCULATION SETS ---
  // FIX: Access safely
  const daySchedule = schedule[classId]?.[targetDay] || {};

  const ignoredSourceSlots = new Set<number>();
  if (ignoreSlot && String(targetDay) === String(ignoreSlot.day)) {
    let startP = ignoreSlot.period;
    let srcDur = ignoreSlot.duration ?? duration;

    // FIX: Access using numeric key only
    const slotAtIgnore = daySchedule[startP];

    if (slotAtIgnore && (slotAtIgnore as any).isFixed) {
      for (let i = startP - 1; i >= 0; i--) {
        const type = getType(structure, i);
        if (type === "CLASS") {
          startP = i;
          break;
        }
      }
      srcDur = Math.max(srcDur, 2);
    }
    let c = 0,
      o = 0;
    while (c < srcDur && startP + o < maxPeriods) {
      const p = startP + o;
      const type = getType(structure, p);
      if (type === "CLASS") {
        ignoredSourceSlots.add(p);
        c++;
      }
      o++;
    }
  }

  const ignoredTargetSlots = new Set<number>();
  if (ignoreTargetSlot && String(targetDay) === String(ignoreTargetSlot.day)) {
    let c = 0,
      o = 0;
    while (
      c < ignoreTargetSlot.duration &&
      ignoreTargetSlot.period + o < maxPeriods
    ) {
      const p = ignoreTargetSlot.period + o;
      const type = getType(structure, p);
      if (type === "CLASS") {
        ignoredTargetSlots.add(p);
        c++;
      }
      o++;
    }
  }

  // 4. TEACHER WHOLE-DAY CHECKS
  const teacher = teachers.find((t) => t.id === teacherId);
  const maxDailyLoad =
    teacher?.maxPeriodsPerDay ?? (settings.maxTeacherPeriodsPerDay || 6);
  const maxConsecutive = settings.maxConsecutivePeriods || 4;
  let consecutiveCount = 0;
  const busyPeriods = new Set<number>();

  for (let checkP = 0; checkP < maxPeriods; checkP++) {
    let isBusy = false;
    if (proposedSlots.has(checkP)) {
      isBusy = true;
    } else {
      for (const cId of Object.keys(schedule)) {
        const s = schedule[cId]?.[targetDay]?.[checkP];
        if (s && s.teacherId === teacherId) {
          if (
            cId === classId &&
            (ignoredSourceSlots.has(checkP) || ignoredTargetSlots.has(checkP))
          )
            continue;
          isBusy = true;
          break;
        }
      }
    }
    if (isBusy) {
      busyPeriods.add(checkP);
      consecutiveCount++;
      if (consecutiveCount > maxConsecutive)
        return {
          valid: false,
          message: `${teacher?.name} would exceed consecutive period limit (${maxConsecutive})`,
          severity: "MEDIUM",
        };
    } else {
      consecutiveCount = 0;
    }
  }
  if (busyPeriods.size > maxDailyLoad)
    return {
      valid: false,
      message: `Exceeds ${teacher?.name}'s daily limit of ${maxDailyLoad} periods`,
      severity: "MEDIUM",
    };

  // 5. JOINT CLASS INTEGRITY
  const isJoint = data.jointClasses?.some(
    (jc) => jc.subjectId === subjectId && jc.classIds.includes(classId)
  );
  if (isJoint && !isAuto)
    return {
      valid: false,
      message: "Cannot move Joint Class manually (breaks sync)",
      severity: "HIGH",
    };

  // 6. CLASS-LEVEL SUBJECT CONSTRAINTS
  let existingPeriods = proposedSlots.size;
  let firstP = 999,
    lastP = -999;
  proposedSlots.forEach((p) => {
    firstP = Math.min(firstP, p);
    lastP = Math.max(lastP, p);
  });

  for (const pStr in daySchedule) {
    const pIdx = parseInt(pStr); // FIX: Ensure number
    if (
      ignoredSourceSlots.has(pIdx) ||
      ignoredTargetSlots.has(pIdx) ||
      proposedSlots.has(pIdx)
    )
      continue;

    const s = daySchedule[pIdx]; // FIX: Access via number
    if (s && s.subjectId === subjectId) {
      existingPeriods++;
      firstP = Math.min(firstP, pIdx);
      lastP = Math.max(lastP, pIdx);
    }
  }

  const maxSubjPeriods = settings.maxSubjectPeriodsPerDay || 2;
  if (existingPeriods > maxSubjPeriods)
    return {
      valid: false,
      message: `Max ${maxSubjPeriods} periods of ${
        subjects.find((s) => s.id === subjectId)?.name
      } per day`,
      severity: "MEDIUM",
    };

  if (existingPeriods > 1) {
    for (let gapP = firstP + 1; gapP < lastP; gapP++) {
      const type = getType(structure, gapP);
      if (type === "CLASS") {
        // FIX: Access daySchedule via gapP (number) safely
        const isOccupied =
          proposedSlots.has(gapP) ||
          (daySchedule[gapP]?.subjectId === subjectId &&
            !ignoredSourceSlots.has(gapP) &&
            !ignoredTargetSlots.has(gapP));
        if (!isOccupied)
          return {
            valid: false,
            message: `Gap detected in ${
              subjects.find((s) => s.id === subjectId)?.name
            } sessions`,
            severity: "MEDIUM",
          };
      }
    }
  }

  // TARGET OCCUPANCY
  const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
    if ((targetSlot as any).locked)
      return {
        valid: false,
        message: "Target slot is Locked",
        severity: "HIGH",
      };
    if (targetSlot.electiveBlockId)
      return {
        valid: false,
        message: "Cannot move Elective Block manually",
        severity: "HIGH",
      };
    return { valid: true, isSwap: true, message: "Swap with existing lesson" };
  }

  if (duration === 2) {
    let nextP = targetPeriod + 1;
    while (nextP < maxPeriods) {
      const type = getType(structure, nextP);
      if (type === "CLASS") break;
      nextP++;
    }
    if (nextP < maxPeriods && schedule[classId]?.[targetDay]?.[nextP])
      return {
        valid: true,
        isSwap: true,
        message: "Swap with existing lesson (P2)",
      };
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
        if (slot.isFixed) {
          const prevP = period > 0 ? daySchedule[period - 1] : null;
          if (prevP && prevP.subjectId === slot.subjectId) continue;
        }
        const nextP = period + 1;
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
            reason: result.message || "Invalid placement",
            severity: result.severity || "HIGH",
          });
        }
      }
    }
  }
  return allConflicts;
};
