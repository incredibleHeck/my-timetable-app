import { AppData, ScheduleResult, Conflict } from "../../../types";
import { prepareAllocationUnits } from "./preparation";
import { solveSmart } from "./solver";
import { validateFullSchedule } from "./validation";

export const generateSchedule = (
  data: AppData
): { schedule: ScheduleResult; conflicts: Conflict[] } => {
  // 1. Prepare & Sort (Heuristic Phase)
  // Transforms raw data into AllocationUnits and prioritizes them (MRV)
  const units = prepareAllocationUnits(data);

  // 2. Solve (Constraint Satisfaction Phase)
  // Attempts to place every unit using LCV and Hard Constraints
  const { schedule, conflicts: solverConflicts, state } = solveSmart(units, data);

  // 3. Verify (Validation Phase)
  // The Solver knows *why* it couldn't place something (solverConflicts).
  // The Validator ensures what *was* placed is legal (validationConflicts).
  const dataWithSchedule = { ...data, schedule };
  const validationConflicts = validateFullSchedule(dataWithSchedule, state);

  // 4. Merge Conflicts
  // Combine "Unplaced Lessons" (Solver) with "Illegal Placements" (Validator)
  const allConflicts = [...solverConflicts, ...validationConflicts];

  return {
    schedule,
    conflicts: allConflicts,
  };
};
