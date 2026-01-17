import { AppData, ScheduleResult, Conflict } from "../../../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";

export const generateSchedule = (
  data: AppData
): { schedule: ScheduleResult; conflicts: Conflict[] } => {
  // 1. Prepare & Sort
  // preparation.ts already handles the heuristic calculation and initial sorting
  const units = prepareAllocationUnits(data);

  // 2. Solve
  return solveSmart(units, data);
};
