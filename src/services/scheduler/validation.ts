import { AppData, ScheduleSlot } from "../../types";

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
  const cls = classes.find((c) => c.id === classId);
  const structure = cls?.structure || settings.dayStructure;
  const structItem = structure?.[targetPeriod];
  const structureType = typeof structItem === "string" ? structItem : structItem?.type;

  if (structureType && structureType !== "CLASS") {
    return { valid: false, message: `Period is ${structureType}` };
  }

  // 2. CLASS CHECKS
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

  // 4. ROOM CHECKS (Simplified)
  // Note: We don't have the "Subject" of the dragged item passed in here explicitly in current signature,
  // but if we did, we could check preferred rooms.
  // For now, we rely on the `useDragAndDrop` hook which performs more detailed room validation.
  // However, we SHOULD check if the TARGET slot is a locked elective block.

  const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
     // FIX: Safely check for locked property
    if ((targetSlot as any).locked) {
      return { valid: false, message: "Target slot is Locked" };
    }
    // Prevent moving Elective Blocks manually for now (too complex to maintain consistency without solver)
    if (targetSlot.electiveBlockId) {
        return { valid: false, message: "Cannot move Elective Block manually" };
    }
    return { valid: true, isSwap: true, message: "Swap with existing lesson" };
  }

  return { valid: true, message: "Available" };
};
