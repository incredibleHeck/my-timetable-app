import { AppData, ScheduleResult, Conflict } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { solveSmart } from "../solver/solver";
import { runConflictAudit } from "../validation/audit"; // ARCHITECT: Switch to Fast Audit
import { generateFinalReport } from "../validation/final-audit";

/**
 * GENERATE SCHEDULE: The System Orchestrator
 * Coordinates the full pipeline from data preparation to solving and final auditing.
 */
export const generateSchedule = (
  data: AppData
): { schedule: ScheduleResult; conflicts: Conflict[]; statistics?: any } => {
  
  // 1. Prepare & Sort (Heuristic Phase)
  // Transforms raw data into AllocationUnits and prioritizes them (Tournament MRV)
  const units = prepareAllocationUnits(data);

  // 2. Solve (Constraint Satisfaction Phase)
  // Attempts to place every unit using LCV and Hard Constraints
  // solverConflicts contains "Unplaced Lessons" (Oversubscribed)
  const { schedule, conflicts: solverConflicts, state } = solveSmart(units, data);

  // 3. Verify & Audit (The O(1) Check)
  // We use the new Audit engine which leverages the State's internal trackers.
  const auditResult = runConflictAudit(data, state);

  const finalData = { ...data, schedule };
  const freshConflicts = generateFinalReport(finalData);

  // 4. Merge Conflicts
  // Combine unplaced lessons with curriculum gaps and rule violations.
  
  // Convert Curriculum Gaps to standard 'Conflict' type for the UI
  const gapConflicts: Conflict[] = auditResult.curriculumGaps.map(gap => ({
      classId: gap.classId,
      className: gap.className,
      subjectId: gap.subjectId,
      subjectName: data.subjects.find(s => s.id === gap.subjectId)?.name || gap.subjectId,
      teacherName: "",
      day: 0,
      period: 0,
      reason: gap.message,
      severity: "MEDIUM"
  }));

  const allConflicts = [
      ...solverConflicts, 
      ...freshConflicts, 
      ...gapConflicts
  ];

  return {
    schedule,
    conflicts: allConflicts,
    statistics: auditResult.statistics
  };
};