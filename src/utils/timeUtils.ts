import { ClassGroup } from "../features/classes/types";
import { Settings, PeriodType, PeriodConfig, TimeSlot } from "../types";

/**
 * Resolves the duration for a specific slot type, prioritizing class overrides.
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
      return classGroup.breakDuration ?? globalSettings.defaultBreakDuration ?? 15;
    case "LUNCH":
      return classGroup.lunchDuration ?? globalSettings.defaultLunchDuration ?? 45;
    case "ASSEMBLY":
      return 40; // Default assembly duration
    default:
      return 40;
  }
}

/**
 * Calculates the full schedule for a class based on global and class-specific settings.
 */
export function calculateClassSchedule(
  classGroup: ClassGroup,
  globalSettings: Settings,
  dayStructure: (PeriodType | PeriodConfig)[]
): TimeSlot[] {
  const startTime = globalSettings.schoolStartTime || "08:00";
  const schedule: TimeSlot[] = [];

  let currentMinutes = timeToMinutes(startTime);

  for (const item of dayStructure) {
    const type = typeof item === "string" ? item : item.type;
    const duration = getEffectiveDuration(classGroup, globalSettings, type);
    const start = minutesToTime(currentMinutes);
    const end = minutesToTime(currentMinutes + duration);

    schedule.push({ start, end });
    currentMinutes += duration;
  }

  return schedule;
}

/**
 * Checks if two time ranges overlap.
 * Touching (end1 === start2) is NOT considered an overlap.
 */
export function doTimeRangesOverlap(range1: TimeSlot, range2: TimeSlot): boolean {
  const s1 = timeToMinutes(range1.start);
  const e1 = timeToMinutes(range1.end);
  const s2 = timeToMinutes(range2.start);
  const e2 = timeToMinutes(range2.end);

  return s1 < e2 && s2 < e1;
}

/**
 * Formats a time slot into a (HH:mm - HH:mm) string.
 */
export function getFormattedTimeRange(slot?: TimeSlot): string {
  if (!slot) return "";
  return `(${slot.start} - ${slot.end})`;
}

/**
 * Converts "HH:mm" string to total minutes from 00:00.
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts total minutes from 00:00 to "HH:mm" string.
 */
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}
