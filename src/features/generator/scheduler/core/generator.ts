import { AppData, ScheduleResult } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { solveSmart } from "../solver/solver";
import { runConflictAudit } from "../validation/audit";
import { auditFinalSchedule } from "../validation";

/**
 * GENERATE SCHEDULE: The System Orchestrator
 * Coordinates the full pipeline from data preparation to solving and final auditing.
 */
export const generateSchedule = (
  data: AppData,
): {
  schedule: ScheduleResult;
  conflicts: ReturnType<typeof auditFinalSchedule>;
  statistics?: ReturnType<typeof runConflictAudit>["statistics"];
} => {
  const units = prepareAllocationUnits(data);

  const { schedule, state } = solveSmart(units, data);

  const auditResult = runConflictAudit(data, state);
  const finalData = { ...data, schedule };

  return {
    schedule,
    conflicts: auditFinalSchedule(finalData, { mode: "generated" }),
    statistics: auditResult.statistics,
  };
};
