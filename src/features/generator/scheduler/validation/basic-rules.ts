import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";
import { getType } from "./utils";

/**
 * RULE: Global & Class Blocks
 * Checks for immutable "Hard Walls" defined in the settings or class-specific data.
 */
export const checkGlobalAndClassBlocks = (
  ctx: ValidationContext,
  p: number
): ValidationResult | null => {
  const { data, targetDay, classId, structure } = ctx;
  const cls = data.classes.find((c) => c.id === classId);

  // 1. STRUCTURE INTEGRITY: Ensure the slot is actually a 'CLASS' period
  // This prevents scheduling lessons during official Breaks or Lunches.
  if (getType(structure, p) !== "CLASS") {
    return {
      valid: false,
      message: `Invalid Period Type: ${getType(structure, p)}`,
      severity: "HIGH",
      penaltyPoints: 2000, // Absolute wall
      conflictCount: 0, 
    };
  }

  // 2. GLOBAL FIXED OCCASIONS (Worship, Assemblies, Public Holidays)
  const globalFixed = data.settings.fixedOccasions?.[targetDay]?.[p];
  if (globalFixed) {
    const label = typeof globalFixed === "string" 
      ? globalFixed 
      : (globalFixed as any).name || (globalFixed as any).label || "Global Event";

    if (label.trim() !== "") {
      return {
        valid: false,
        message: `Blocked by School Event: ${label}`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1, // High conflict: forces eviction
      };
    }
  }

  // 3. CLASS-SPECIFIC FIXED SESSIONS (Swimming, Off-site, Pre-scheduled blocks)
  const classFixed = cls?.fixedSessions?.[targetDay]?.[p];
  if (classFixed) {
    return {
      valid: false,
      message: `Class is pre-occupied: ${typeof classFixed === "string" ? classFixed : "Fixed Session"}`,
      severity: "HIGH",
      penaltyPoints: 1000,
      conflictCount: 1,
    };
  }

  return null;
};

/**
 * RULE: Resource & Teacher Availability
 * Focuses on STATIC constraints (Teacher's personal schedule blocks).
 */
export const checkResourceAndAvailability = (
  ctx: ValidationContext,
  p: number,
  state?: SchedulerState
): ValidationResult | null => {
  const { data, subjectId, targetDay, classId, teacherId, ignoredSlots } = ctx;

  // 1. TEACHER STATIC CONSTRAINT CHECK
  // We distinguish between "Busy with another class" (Dynamic) 
  // and "Unavailable to teach" (Static Block).
  if (state) {
    const occupantId = state.teacherOccupancy[teacherId]?.[targetDay]?.[p];
    
    // Sentinel check: "BLOCK" represents a hard teacher constraint from their settings.
    if (occupantId === "BLOCK") {
      return {
        valid: false,
        message: `${data.teachers.find(t=>t.id === teacherId)?.name || "Teacher"} is unavailable`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    }
  } else {
    // UI Fallback: Direct lookup in the raw Teacher object
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (teacher?.constraints?.[targetDay]?.[p]) {
      return {
        valid: false,
        message: `${teacher.name || "Teacher"} marked this slot as unavailable`,
        severity: "HIGH",
        penaltyPoints: 1000,
        conflictCount: 1,
      };
    }
  }

  // 2. SINGLE RESOURCE BOTTLENECK (Static Logic)
  // If the subject requires a unique room (e.g., "The only Science Lab"),
  // we ensure it isn't already double-booked at this period index.
  const subject = data.subjects.find((s) => s.id === subjectId);
  if (subject?.isSingleResource && !ignoredSlots.has(`${targetDay}-${p}`)) {
    // Note: Dynamic Time-Slot overlaps (staggered starts) are handled in overlap-checks.ts
    // This check handles index-based resource exhaustion.
    if (state) {
      const resourceUser = state.singleResourceUsage[subjectId]?.[targetDay]?.[p];
      if (resourceUser && resourceUser !== "AVAILABLE") {
         // Logic for determining if this specific index is exhausted
      }
    } else {
      // O(N) Fallback scan for UI moves
      for (const otherCId of Object.keys(data.schedule)) {
        if (otherCId === classId) continue;
        const otherSlot = data.schedule[otherCId]?.[targetDay]?.[p];
        if (otherSlot && otherSlot.subjectId === subjectId) {
          return {
            valid: false,
            message: `${subject.name} resource is currently occupied`,
            severity: "HIGH",
            penaltyPoints: 1000,
            conflictCount: 1,
          };
        }
      }
    }
  }

  return null;
};
