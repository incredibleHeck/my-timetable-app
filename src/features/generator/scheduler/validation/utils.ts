import { PeriodConfig, PeriodType } from "../../../../types";

/**
 * HELPER: Resolves the type of a period at a specific index.
 * Handles polymorphic configuration:
 * 1. Legacy: Array of strings (e.g. ["CLASS", "BREAK"])
 * 2. Modern: Array of objects (e.g. [{ type: "CLASS", label: "P1" }])
 */
export const getType = (
  structure: (PeriodConfig | PeriodType)[] | undefined,
  p: number
): PeriodType => {
  const item = structure?.[p];

  // Default to "CLASS" if configuration is missing or index out of bounds
  // (This prevents crashes on edge cases)
  if (!item) return "CLASS";

  // Handle Legacy Config (String)
  if (typeof item === "string") return item as PeriodType;

  // Handle Modern Config (Object)
  return item.type;
};
