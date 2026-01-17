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

  // 1. Global Fixed Occasions (STRICT CHECK)
  // We check safely for both string values and legacy object configurations
  const globalFixed = data.settings.fixedOccasions?.[targetDay]?.[p];

  if (globalFixed) {
    // Case A: Simple String (e.g., "Worship") - Must be non-empty to block
    if (typeof globalFixed === "string" && globalFixed.trim() !== "") {
      return {
        valid: false,
        message: `Global: ${globalFixed}`,
        severity: "HIGH",
      };
    }
    // Case B: Legacy Object (e.g., { name: "Assembly", ... }) - Always blocks
    if (typeof globalFixed === "object") {
      // Access .name safely if it exists, or default to "Fixed Event"
      const label =
        (globalFixed as any).name ||
        (globalFixed as any).label ||
        "Fixed Event";
      return {
        valid: false,
        message: `Global: ${label}`,
        severity: "HIGH",
      };
    }
  }

  // 2. Class Fixed Sessions
  // Specific slots where this class is busy (e.g. Swimming Lesson off-site)
  if (cls?.fixedSessions?.[targetDay]?.[p]) {
    const reason = cls.fixedSessions[targetDay][p];
    return {
      valid: false,
      message: `Class Busy: ${
        typeof reason === "string" ? reason : "Fixed Session"
      }`,
      severity: "HIGH",
    };
  }

  return null;
};

/**
 * RULE: Resource & Teacher Availability
 * Checks:
 * 1. Single Resources (Two classes cannot have "Science" at the same time if only 1 lab exists)
 * 2. Teacher Constraints (Teacher marked as "Unavailable" in their grid)
 */
export const checkResourceAndAvailability = (
  ctx: ValidationContext,
  p: number
): ValidationResult | null => {
  const { data, subjectId, targetDay, classId, teacherId } = ctx;

  // 1. Single Resource Check
  // "Is this subject a bottleneck resource?"
  const subject = data.subjects.find((s) => s.id === subjectId);

  if (subject?.isSingleResource) {
    // If the subject itself is being moved from this slot, don't block
    if (ctx.ignoredSlots.has(p)) {
      // Logic: If it's a swap of the SAME subject, we allow it.
      // (This is rare but possible if user drags a Science slot onto another Science slot)
    } else {
      // ITERATIVE SCAN: Check every other class's schedule for this specific time slot.
      for (const otherCId of Object.keys(data.schedule)) {
        if (otherCId === classId) continue; // Don't check against self

        const otherSlot = data.schedule[otherCId]?.[targetDay]?.[p];

        // If another class is holding this Subject ID at this time...
        if (otherSlot && otherSlot.subjectId === subjectId) {
          return {
            valid: false,
            message: `${subject.name} is already being taught elsewhere`,
            severity: "HIGH",
          };
        }
      }
    }
  }

  // 2. Teacher Static Availability
  // "Did the teacher explicitly block this slot?"
  const teacher = data.teachers.find((t) => t.id === teacherId);
  if (teacher?.constraints?.[targetDay]?.[p]) {
    return {
      valid: false,
      message: `${teacher.name || "Teacher"} is unavailable`,
      severity: "HIGH",
    };
  }

  return null;
};
