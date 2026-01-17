import { PeriodConfig, PeriodType } from "../../../../types";

export const getType = (
  structure: (PeriodConfig | PeriodType)[] | undefined,
  p: number
): string => {
  const item = structure?.[p];
  if (!item) return "CLASS";
  if (typeof item === "string") return item;
  return item.type;
};
