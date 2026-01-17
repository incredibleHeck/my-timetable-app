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
 * UTILITY: getNextClassPeriod
 * Finds the next available CLASS period index, skipping Breaks/Lunches/Assemblies.
 * Critical for scheduling Double Periods (Duration = 2).
 */
export const getNextClassPeriod = (
  startIndex: number,
  structure: (PeriodConfig | PeriodType)[],
  maxPeriods: number
): number | null => {
  // Look ahead starting from the immediate next slot
  for (let i = startIndex + 1; i < maxPeriods; i++) {
    // If we find a teaching slot, that's our p2
    if (getPeriodType(structure, i) === "CLASS") {
      return i;
    }
    // If it's a BREAK or LUNCH, the loop continues to the next index
    // effectively "bridging" the gap.
  }

  // If we run out of day without finding a class slot, the double period cannot fit.
  return null;
};
