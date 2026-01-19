/* eslint-disable no-restricted-globals */
import { AppData, Conflict } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { solveSmart } from "../solver/solver";
import { runConflictAudit } from "../validation/audit";
import { generateFinalReport } from "../validation/final-audit";

const ctx: Worker = self as any;

/**
 * HELPER: Fast Core Subject Check
 * Identifies core subjects for pedagogical scoring (Math, Science, etc.)
 */
const CORE_KEYWORDS = ["math", "english", "science", "physics", "chem", "bio", "history", "geography"];
const isCoreSubject = (name: string) => {
    const n = name.toLowerCase();
    return CORE_KEYWORDS.some(k => n.includes(k));
};

ctx.onmessage = (e: MessageEvent<AppData>) => {
  const data = e.data;
  const startTime = Date.now();
  const TIME_LIMIT = 28000; // 28 seconds (browser safety margin)

  try {
    // 1. PREPARATION
    // Units are strictly curriculum-compliant and prioritized
    const units = prepareAllocationUnits(data);

    // ARCHITECT: Safety Patch
    // Ensure 'isCore' is populated for O(1) scoring performance.
    // We do this ONCE here so the solver doesn't do it in hot loops.
    units.forEach(u => {
        if (u.isCore === undefined) {
            u.isCore = isCoreSubject(u.subjectName || "");
        }
    });

    // 2. HYBRID SOLVER
    // Runs the Optimized Construction + Repair phases with Map-based constraints
    const { schedule, conflicts: solverConflicts, state, iterations } = solveSmart(
      units, 
      data, 
      (phase, progress, total, currentConflictCount) => {
        // Timeout Protection: Return current best state if worker hangs
        if (Date.now() - startTime > TIME_LIMIT) {
           return false; 
        }

        ctx.postMessage({
          type: "progress",
          payload: { 
            phase, 
            iteration: progress, 
            total,
            conflicts: currentConflictCount 
          }
        });
        return true;
      }
    );

    // 3. AUDIT & REPORT CONSOLIDATION
    const audit = runConflictAudit(data, state);
    const finalConflicts: Conflict[] = [];
    const reportedGaps = new Set<string>(); // "classId-subjectId"

    // A. Add Solver Direct Failures (The immediate unplaced units)
    solverConflicts.forEach(c => {
        finalConflicts.push(c);
        if (c.classId && c.subjectId) reportedGaps.add(`${c.classId}-${c.subjectId}`);
    });

    // B. Add Curriculum Gaps from Audit
    audit.curriculumGaps.forEach((gap: any) => {
        const key = `${gap.classId}-${gap.subjectId}`;
        if (!reportedGaps.has(key)) {
            finalConflicts.push({
                classId: gap.classId,
                className: gap.className,
                subjectId: gap.subjectId,
                subjectName: data.subjects.find((s: any) => s.id === gap.subjectId)?.name || gap.subjectId,
                teacherName: "Unassigned",
                day: 0,
                period: 0,
                missingPeriods: gap.missing,
                reason: gap.message,
                severity: "HIGH"
            });
            reportedGaps.add(key);
        }
    });

    // C. LOGICAL AUDIT: Grid-based conflicts (Overlaps, Continuity, etc.)
    const gridData = { ...data, schedule };
    const logicalConflicts = generateFinalReport(gridData);

    const allConflicts = [
        ...finalConflicts,
        ...logicalConflicts
    ];

    // 4. FINAL RESPONSE
    ctx.postMessage({
      type: "success",
      payload: {
        schedule,
        conflicts: allConflicts,
        curriculumGaps: audit.curriculumGaps,
        statistics: audit.statistics,
        iterations, 
        duration: Date.now() - startTime,
      },
    });

  } catch (error) {
    console.error("Critical Worker Failure:", error);
    ctx.postMessage({
      type: "error",
      payload: error instanceof Error ? error.message : "Internal Scheduler Error",
    });
  }
};
