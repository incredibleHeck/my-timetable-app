import { PeriodConfig, PeriodType } from "../../../types";

/**
 * UTILITY: getPeriodType
 * Handles the difference between Global (Object) and Class (String) structures.
 * Returns the effective type ("CLASS", "BREAK", "LUNCH") of a specific slot.
 */
export const getPeriodType = (
  structure: (PeriodConfig | PeriodType)[] | undefined,
  index: number
): PeriodType => {
  // Safe access in case structure is shorter than maxPeriods
  const item = structure?.[index];

  if (!item) return "CLASS"; // Default to class if undefined (e.g. implicitly extended day)

  if (typeof item === "string") return item; // It's a Class-Specific Structure (Legacy String)
  return item.type; // It's a Global Structure (Modern Object)
};

/**
 * REFACTORED: getNextClassPeriod
 * Ensures a double period can "jump" over non-lesson slots (Break/Lunch).
 */
export function getNextClassPeriod(
  currentP: number,
  structure: (PeriodType | PeriodConfig)[],
  maxPeriods: number
): number | null {
  let nextP = currentP + 1;

  while (nextP < maxPeriods) {
    const type = getPeriodType(structure, nextP);
    
    if (type === "CLASS") {
      return nextP; // Found the second half of the double lesson
    }
    
    // If it's a BREAK, LUNCH, or ASSEMBLY, the solver skips it 
    // but the clock keeps ticking in the background.
    nextP++;
  }

  return null; // Day ended before finding another lesson slot
}
