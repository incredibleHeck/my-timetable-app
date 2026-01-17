import { ClassGroup } from "../features/classes/types";
import { Settings, PeriodType, PeriodConfig, TimeSlot } from "../types";

/**
 * Resolves the duration for a specific slot type.
 * Priority: Class Override > Global Setting > Hardcoded Default.
 */
export function getEffectiveDuration(
  classGroup: ClassGroup,
  globalSettings: Settings,
  type: PeriodType
): number {
  switch (type) {
    case "CLASS":
      return classGroup.duration ?? globalSettings.defaultClassDuration ?? 40;
    case "BREAK":
      return (
        classGroup.breakDuration ?? globalSettings.defaultBreakDuration ?? 15
      );
    case "LUNCH":
      return (
        classGroup.lunchDuration ?? globalSettings.defaultLunchDuration ?? 45
      );
    case "ASSEMBLY":
      return 40;
    default:
      return 40;
  }
}

/**
 * Core Schedule Calculator
 * Generates time slots based on a start time, structure, and duration resolver.
 */
export function calculateSchedule(
  startTime: string,
  structure: (PeriodType | PeriodConfig)[],
  durationResolver: (type: PeriodType) => number
): TimeSlot[] {
  const schedule: TimeSlot[] = [];
  let currentMinutes = timeToMinutes(startTime);

  for (const item of structure) {
    const type = typeof item === "string" ? item : item.type;
    const duration = durationResolver(type);

    const start = minutesToTime(currentMinutes);
    const end = minutesToTime(currentMinutes + duration);

    schedule.push({ start, end });

    // Increment for the next slot
    currentMinutes += duration;
  }

  return schedule;
}

/**
 * Logical-to-Physical Mapper:
 * Accumulates durations to build a timeline for a class day.
 */
export function calculateClassSchedule(
  classGroup: ClassGroup,
  globalSettings: Settings,
  dayStructure: (PeriodType | PeriodConfig)[]
): TimeSlot[] {
  const startTime = globalSettings.schoolStartTime || "08:00";
  return calculateSchedule(startTime, dayStructure, (type) => 
    getEffectiveDuration(classGroup, globalSettings, type)
  );
}

/**
 * Generates default time slots for initial app state.
 */
export function generateDefaultTimeSlots(structure: (PeriodType | PeriodConfig)[]): TimeSlot[] {
  // Hardcoded defaults to match original constants.ts logic
  return calculateSchedule("08:00", structure, (type) => {
    if (type === "BREAK") return 20;
    if (type === "LUNCH") return 60;
    return 50; // Default Class
  });
}

/**
 * Interval Arithmetic: Overlap Detection
 * Uses the logic: (StartA < EndB) AND (StartB < EndA).
 * This correctly treats back-to-back classes (EndA === StartB) as NOT overlapping.
 */
export function doTimeRangesOverlap(
  range1: TimeSlot,
  range2: TimeSlot
): boolean {
  const s1 = timeToMinutes(range1.start);
  const e1 = timeToMinutes(range1.end);
  const s2 = timeToMinutes(range2.start);
  const e2 = timeToMinutes(range2.end);

  // Standard interval overlap formula
  return s1 < e2 && s2 < e1;
}

/**
 * Formats a TimeSlot for UI display or conflict reporting.
 */
export function getFormattedTimeRange(slot?: TimeSlot): string {
  if (!slot) return "";
  return `${slot.start} - ${slot.end}`;
}

/**
 * Time String Parser: Converts "HH:mm" to total minutes.
 * Includes defensive split to handle malformed strings.
 */
export function timeToMinutes(time: string): number {
  if (!time || !time.includes(":")) return 0;
  const [hours, minutes] = time.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Time String Generator: Converts total minutes to "HH:mm".
 */
export function minutesToTime(minutes: number): string {
  // Ensure we don't exceed 24 hours
  const normalizedMinutes = minutes % 1440;
  const hours = Math.floor(normalizedMinutes / 60);
  const mins = Math.floor(normalizedMinutes % 60);

  return `${hours.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}`;
}