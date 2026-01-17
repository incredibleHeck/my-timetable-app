import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";

/**
 * RULE: Global & Class Blocks
 * Checks if the slot is blocked by:
 * 1. Global School Events (e.g., "Worship", "Assembly")
 * 2. Class-specific unavailable slots (fixedSessions)
 */
export const checkGlobalAndClassBlocks = (
  ctx: ValidationContext,
  p: number
): ValidationResult | null => {
  const { data, targetDay, classId } = ctx;
  const cls = data.classes.find((c) => c.id === classId);

  const globalFixed = data.settings.fixedOccasions?.[targetDay]?.[p];

  if (globalFixed) {
    if (typeof globalFixed === "string" && globalFixed.trim() !== "") {
      return {
        valid: false,
        message: `Global: ${globalFixed}`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    }
    if (typeof globalFixed === "object") {
      const label =
        (globalFixed as any).name ||
        (globalFixed as any).label ||
        "Fixed Event";
      return {
        valid: false,
        message: `Global: ${label}`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    }
  }

  if (cls?.fixedSessions?.[targetDay]?.[p]) {
    const reason = cls.fixedSessions[targetDay][p];
    return {
      valid: false,
      message: `Class Busy: ${
        typeof reason === "string" ? reason : "Fixed Session"
      }`,
      severity: "HIGH",
      penaltyPoints: 1000,
      conflictCount: 1,
    };
  }

  return null;
};

/**
 * RULE: Resource & Teacher Availability
 * REFACTORED: Resource Check using O(1) State Grids
 */
export const checkResourceAndAvailability = (
  ctx: ValidationContext,
  p: number,
  state?: SchedulerState // Optional for UI compatibility
): ValidationResult | null => {
  const { data, subjectId, targetDay, classId, teacherId, ignoredSlots } = ctx;

  // 1. Teacher Availability Check (O(1) if state provided)
  if (state) {
    const existingUnitId = state.teacherOccupancy[teacherId]?.[targetDay]?.[p];
    if (existingUnitId && !ignoredSlots.has(p)) {
      return {
        valid: false,
        message: `Teacher Busy (Unit: ${existingUnitId})`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    }
  } else {
    // Fallback: Check Static Constraints
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (teacher?.constraints?.[targetDay]?.[p]) {
      return {
        valid: false,
        message: `${teacher.name || "Teacher"} is unavailable`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    }
    // Note: Teacher occupancy scan is handled in overlap-checks.ts and load-checks.ts
  }

  // 2. Single Resource Check (O(1) if state provided, else O(N))
  const subject = data.subjects.find((s) => s.id === subjectId);
  if (subject?.isSingleResource) {
    if (!ignoredSlots.has(p)) {
      if (state) {
        if (state.singleResourceUsage[subjectId]?.[targetDay]?.[p]) {
          return {
            valid: false,
            message: "Resource bottleneck",
            severity: "HIGH",
            penaltyPoints: 1000,
            conflictCount: 1,
          };
        }
      }
      else {
        // Fallback: O(N) scan
        for (const otherCId of Object.keys(data.schedule)) {
          if (otherCId === classId) continue;
          const otherSlot = data.schedule[otherCId]?.[targetDay]?.[p];
          if (otherSlot && otherSlot.subjectId === subjectId) {
            return {
              valid: false,
              message: `${subject.name} is already being taught elsewhere`,
              severity: "HIGH",
              penaltyPoints: 1000,
              conflictCount: 1,
            };
          }
        }
      }
    }
  }

  return null;
};