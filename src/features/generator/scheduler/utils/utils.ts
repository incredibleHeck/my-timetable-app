import { AppData, PeriodType, PeriodConfig, Settings } from "../../../../types";

export const getDaysPerWeek = (settings: Settings): number => settings.daysPerWeek ?? 5;

/**
 * Highest period index any class could legitimately use, plus one.
 *
 * The slot scans used to stop at a hardcoded 15 "as per UI limits". That is
 * wrong in both directions: a school with 12 periods paid to test three columns
 * that cannot exist, and a school with more than 15 would have had lessons
 * silently refused a home with no constraint to explain it. Classes may also
 * override the global structure, so the ceiling is the widest day in the school,
 * not the default one.
 */
export function getMaxPeriodsPerDay(data: AppData): number {
  let max = data.settings.periodsPerDay ?? 0;
  for (const cls of data.classes ?? []) {
    const structure = cls.structure ?? data.settings.dayStructure;
    max = Math.max(max, cls.periodCount ?? 0, structure?.length ?? 0);
  }
  return max;
}

/**
 * ARCHITECT NOTES:
 * These helpers perform array lookups on the 'Day Structure'.
 * Since Day Structure is small (~8-12 items), simple iteration is faster
 * than Map overhead here.
 */

// --- 1. TYPE RESOLVER ---

/**
 * UTILITY: getPeriodType
 * Handles the difference between Global (Object) and Class (String) structures.
 * Returns the effective type ("CLASS", "BREAK", "LUNCH") of a specific slot.
 */
export const getPeriodType = (
  structure: (PeriodConfig | PeriodType)[] | undefined,
  index: number,
): PeriodType => {
  const item = structure?.[index];

  if (!item) return "CLASS"; // Default to class if undefined

  if (typeof item === "string") return item as PeriodType;
  return item.type;
};

// --- 2. NAVIGATION HELPERS (The "Bridge" Logic) ---

/**
 * Finds the next index that is strictly a 'CLASS' period.
 * Skips BREAK, LUNCH, ASSEMBLY, etc.
 * Returns NULL if end of day reached.
 */
export function getNextClassPeriod(
  currentP: number,
  structure: (PeriodType | PeriodConfig)[],
  maxPeriods: number,
): number | null {
  let nextP = currentP + 1;

  while (nextP < maxPeriods) {
    const type = getPeriodType(structure, nextP);

    if (type === "CLASS") {
      return nextP; // Found the second half of the double lesson
    }

    // If it's a BREAK, LUNCH, or ASSEMBLY, skip it
    nextP++;
  }

  return null; // Day ended before finding another lesson slot
}

/**
 * Finds the previous index that was strictly a 'CLASS' period.
 * Used for Gap Detection (Scoring).
 */
export function getPrevClassPeriod(
  currentP: number,
  structure: (PeriodType | PeriodConfig)[],
): number | null {
  let prevP = currentP - 1;

  while (prevP >= 0) {
    const type = getPeriodType(structure, prevP);
    if (type === "CLASS") return prevP;
    prevP--;
  }

  return null;
}

// --- 3. RE-EXPORT TIME UTILS ---
export * from "../../../../utils/timeUtils";
