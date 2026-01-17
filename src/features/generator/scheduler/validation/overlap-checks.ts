import {
  calculateClassSchedule,
  doTimeRangesOverlap,
} from "../../../../utils/timeUtils";
import { ValidationContext, ValidationResult } from "./types";

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

  const targetTime = targetTimeRange[p];

  for (const cId of Object.keys(data.schedule)) {
    if (cId === classId) continue;

    // Get schedule for the "other" class
    const otherClassSchedule = allClassSchedules.get(cId);
    if (!otherClassSchedule) continue;

    const otherDaySlots = data.schedule[cId]?.[targetDay] || {};

    for (const otherPStr in otherDaySlots) {
      const otherP = parseInt(otherPStr);
      const slot = otherDaySlots[otherP];
      if (!slot) continue;

      const otherTime = otherClassSchedule[otherP];
      if (!targetTime || !otherTime) continue;

      // --- A. TEACHER OVERLAP ---
      if (slot.teacherId === teacherId) {
        if (doTimeRangesOverlap(targetTime, otherTime)) {
          // IMPROVED FIX:
          // Instead of matching teacherId (which might be null in config),
          // we check if these classes are Joint Partners for this SUBJECT.
          const isJointSession = data.jointClasses?.some(
            (jc) =>
              jc.subjectId === subjectId && // Link by Subject
              jc.classIds.includes(classId) &&
              jc.classIds.includes(cId)
          );

          // If they are NOT joint partners, it is a real conflict.
          if (!isJointSession) {
            const otherCls = data.classes.find((c) => c.id === cId);
            return {
              valid: false,
              message: `Teacher is busy in ${otherCls?.name}`,
              severity: "HIGH",
            };
          }
          // If they ARE joint partners, we allow the overlap (continue).
        }
      }

      // --- B. ROOM OVERLAP ---
      if (roomId && slot.roomId === roomId) {
        if (doTimeRangesOverlap(targetTime, otherTime)) {
          // Logic:
          // If I am not the one currently occupying it...
          // AND we are not Joint Class partners...
          // Then it is a conflict.

          const isJointPartner = data.jointClasses?.some(
            (jc) =>
              jc.subjectId === subjectId &&
              jc.classIds.includes(classId) &&
              jc.classIds.includes(cId)
          );

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
  }
  return null;
};
