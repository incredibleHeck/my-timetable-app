import { AppData, ScheduleSlot } from "../types";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  isSwap?: boolean;
};

export const checkSlotValidity = (
  data: AppData,
  targetDay: number,
  targetPeriod: number,
  teacherId: string,
  classId: string,
  ignoreSlot?: { day: number; period: number }
): ValidationResult => {
  const { schedule, settings, classes } = data;

  // 1. GLOBAL CHECKS
  const globalFixed = settings.fixedOccasions?.[targetDay]?.[targetPeriod];
  if (globalFixed) {
    // FIX: Handle boolean 'true' vs object
    const label =
      typeof globalFixed === "object" && "name" in globalFixed
        ? globalFixed.name
        : "School Event";
    return { valid: false, message: `Global: ${label}` };
  }

  // Check Structure
  const structureType = settings.dayStructure?.[targetPeriod]?.type;
  if (structureType && structureType !== "CLASS") {
    return { valid: false, message: `Period is ${structureType}` };
  }

  // 2. CLASS CHECKS
  const cls = classes.find((c) => c.id === classId);
  if (cls?.fixedSessions?.[targetDay]?.[targetPeriod]) {
    const fixedLabel = cls.fixedSessions[targetDay][targetPeriod];
    return { valid: false, message: `Class Busy: ${fixedLabel}` };
  }

  // 3. TEACHER CHECKS
  for (const cId of Object.keys(schedule)) {
    if (cId === classId) continue;

    const slot = schedule[cId]?.[targetDay]?.[targetPeriod];
    if (slot && slot.teacherId === teacherId) {
      if (
        ignoreSlot &&
        ignoreSlot.day === targetDay &&
        ignoreSlot.period === targetPeriod
      ) {
        continue;
      }

      const className =
        classes.find((c) => c.id === cId)?.name || "another class";
      return { valid: false, message: `Teacher is busy in ${className}` };
    }
  }

  // 4. SWAP DETECTION
  const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
    // FIX: Safely check for locked property
    if ((targetSlot as any).locked) {
      return { valid: false, message: "Target slot is Locked" };
    }
    return { valid: true, isSwap: true, message: "Swap with existing lesson" };
  }

  return { valid: true, message: "Available" };
};
