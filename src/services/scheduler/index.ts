import { AppData, ScheduleResult, Conflict } from "../../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";

export const generateSchedule = (
  data: AppData
): { schedule: ScheduleResult; conflicts: Conflict[] } => {
  const units = prepareAllocationUnits(data);
  return solveSmart(units, data);
};
