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
  dayStructure: PeriodConfig[]
): TimeSlot[] {
  const startTime = globalSettings.schoolStartTime || "08:00";
  const schedule: TimeSlot[] = [];

  let currentMinutes = timeToMinutes(startTime);

  for (const config of dayStructure) {
    const duration = getEffectiveDuration(classGroup, globalSettings, config.type);
    const start = minutesToTime(currentMinutes);
    const end = minutesToTime(currentMinutes + duration);

    schedule.push({ start, end });
    currentMinutes += duration;
  }

  return schedule;
}

/**
 * Converts "HH:mm" string to total minutes from 00:00.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Converts total minutes from 00:00 to "HH:mm" string.
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}