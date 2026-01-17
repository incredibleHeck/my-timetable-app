import { ValidationContext, ValidationResult } from "./types";

export const checkGlobalAndClassBlocks = (
  ctx: ValidationContext,
  p: number
): ValidationResult | null => {
  const { data, targetDay, classId } = ctx;
  const cls = data.classes.find((c) => c.id === classId);

  // 1. Global Fixed Occasions (STRICT CHECK)
  const globalFixed = data.settings.fixedOccasions?.[targetDay]?.[p];
  if (globalFixed) {
    // If it's a string, it must be non-empty to block.
    if (typeof globalFixed === "string" && globalFixed.trim() !== "") {
      return {
        valid: false,
        message: `Global: ${globalFixed}`,
        severity: "HIGH",
      };
    }
    // If it's an object (legacy support), it blocks.
    if (typeof globalFixed === "object" && globalFixed !== null) {
      return {
        valid: false,
        message: `Global: ${globalFixed.name}`,
        severity: "HIGH",
      };
    }
  }

  // 2. Class Fixed Sessions
  if (cls?.fixedSessions?.[targetDay]?.[p]) {
    return {
      valid: false,
      message: `Class Busy: ${cls.fixedSessions[targetDay][p]}`,
      severity: "HIGH",
    };
  }
  return null;
};

export const checkResourceAndAvailability = (
  ctx: ValidationContext,
  p: number
): ValidationResult | null => {
  const { data, subjectId, targetDay, classId, teacherId } = ctx;

  // 1. Single Resource Check
  const subject = data.subjects.find((s) => s.id === subjectId);
  if (subject?.isSingleResource) {
    for (const otherCId of Object.keys(data.schedule)) {
      if (otherCId === classId) continue;
      const otherSlot = data.schedule[otherCId]?.[targetDay]?.[p];
      if (otherSlot && otherSlot.subjectId === subjectId) {
        return {
          valid: false,
          message: `${subject.name} is already being taught elsewhere`,
          severity: "HIGH",
        };
      }
    }
  }

  // 2. Teacher Static Availability
  const teacher = data.teachers.find((t) => t.id === teacherId);
  if (teacher?.constraints?.[targetDay]?.[p]) {
    return {
      valid: false,
      message: `${teacher.name} not available`,
      severity: "HIGH",
    };
  }

  return null;
};
