import { doTimeRangesOverlap } from "../../../../utils/timeUtils";
import { ValidationContext, ValidationResult } from "./types";

/**
 * RULE: Overlaps (Time, Teacher, Room)
 * Checks if the proposed slot physically overlaps with any other class's schedule.
 * Handles "Joint Classes" by allowing overlap if the classes are linked in 'jointClasses'.
 */
export const checkOverlaps = (
  ctx: ValidationContext,
  p: number
): ValidationResult | null => {
  const {
    data,
    classId,
    teacherId,
    roomId,
    targetDay,
    subjectId,
    classSchedule: targetTimeRange,
    allClassSchedules,
  } = ctx;

  // 1. Get the physical time range of the proposed slot
  const targetTime = targetTimeRange[p];
  if (!targetTime) return null; // Should not happen if configuration is correct

  // 2. Iterate over EVERY other class in the school
  for (const cId of Object.keys(data.schedule)) {
    if (cId === classId) continue; // Skip checking against self

    // Get calculated time schedule for the "other" class
    const otherClassSchedule = allClassSchedules.get(cId);
    if (!otherClassSchedule) continue;

    // Get the "other" class's assignments for this day
    const otherDaySlots = data.schedule[cId]?.[targetDay] || {};

    // 3. Check every period in the "other" class
    for (const otherPStr in otherDaySlots) {
      const otherP = parseInt(otherPStr);
      const slot = otherDaySlots[otherP];
      if (!slot) continue;

      const otherTime = otherClassSchedule[otherP];
      if (!otherTime) continue;

      // 4. PHYSICAL TIME OVERLAP CHECK
      // If the times don't touch, we don't care about resources.
      if (!doTimeRangesOverlap(targetTime, otherTime)) continue;

      // --- A. TEACHER OVERLAP ---
      // If the teacher is the same...
      if (teacherId && slot.teacherId === teacherId) {
        // CHECK: Are they Joint Class Partners?
        // (Do they share a 'jointClass' entry for this Subject ID?)
        const isJointSession = data.jointClasses?.some(
          (jc) =>
            jc.subjectId === subjectId &&
            jc.classIds.includes(classId) &&
            jc.classIds.includes(cId)
        );

        // FATAL: If they are NOT joint partners, the teacher cannot be in two places.
        if (!isJointSession) {
          const otherCls = data.classes.find((c) => c.id === cId);
          return {
            valid: false,
            message: `Teacher is busy in ${otherCls?.name || "another class"}`,
            severity: "HIGH",
          };
        }
        // If they ARE partners, overlap is ALLOWED (Joint Teaching).
      }

      // --- B. ROOM OVERLAP ---
      // If the room is the same...
      if (roomId && slot.roomId === roomId) {
        // CHECK: Are they Joint Class Partners?
        const isJointPartner = data.jointClasses?.some(
          (jc) =>
            jc.subjectId === subjectId &&
            jc.classIds.includes(classId) &&
            jc.classIds.includes(cId)
        );

        // FATAL: If NOT partners, the room is double-booked.
        if (!isJointPartner) {
          const otherCls = data.classes.find((c) => c.id === cId);
          return {
            valid: false,
            message: `Room occupied by ${otherCls?.name || "another class"}`,
            severity: "HIGH",
          };
        }
      }
    }
  }
  return null;
};
