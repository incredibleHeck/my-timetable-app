import { PeriodConfig, PeriodType } from "../../types";

// Handles the difference between Global (Object) and Class (String) structures
export const getPeriodType = (
  structure: (PeriodConfig | PeriodType)[],
  index: number
): PeriodType => {
  const item = structure[index];
  if (!item) return "CLASS"; // Default to class if undefined
  if (typeof item === "string") return item; // It's a Class-Specific Structure (String)
  return item.type; // It's a Global Structure (Object)
};

// Find the next available CLASS period index (Skips Breaks/Lunches)
export const getNextClassPeriod = (
  startIndex: number,
  structure: (PeriodConfig | PeriodType)[],
  maxPeriods: number
): number | null => {
  for (let i = startIndex + 1; i < maxPeriods; i++) {
    if (getPeriodType(structure, i) === "CLASS") {
      return i;
    }
  }
  return null;
};
