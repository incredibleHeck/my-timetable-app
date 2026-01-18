import { doTimeRangesOverlap, calculateClassSchedule } from "../../../../utils/timeUtils";
import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";

/**
 * RULE: Overlaps (Time, Teacher, Room)
 */
export const checkOverlaps = (
  ctx: ValidationContext,
  p: number,
  state?: SchedulerState
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
    ignoredSlots,
  } = ctx;

  const targetTime = targetTimeRange[p];
  if (!targetTime) return null;

  // --- TIME-AWARE VALIDATION ---
  // We explicitly skip the O(1) "Optimized Path" (Index-Based) because it fails
  // when classes have different start/end times for the same period index.
  // Instead, we scan the schedule (O(N)) using strict Time-Range Overlap.

  // Use current Solver state if available, otherwise static data (UI mode)
  const scheduleSource = state ? state.schedule : data.schedule;

  // --- O(N) Scan for Physical Overlaps ---
  for (const cId of Object.keys(scheduleSource)) {
    if (cId === classId) continue;

    let otherClassSchedule = allClassSchedules.get(cId);
    if (!otherClassSchedule) {
        const cls = data.classes.find(c => c.id === cId);
        if (cls) {
            otherClassSchedule = calculateClassSchedule(cls, data.settings, cls.structure || data.settings.dayStructure);
        } else {
            otherClassSchedule = calculateClassSchedule({ id: cId, name: cId, curriculum: [] } as any, data.settings, data.settings.dayStructure);
        }
    }
    if (!otherClassSchedule) continue;

    const otherDaySlots = scheduleSource[cId]?.[targetDay] || {};

    for (const otherPStr in otherDaySlots) {
      const otherP = parseInt(otherPStr);
      if (ignoredSlots.has(`${targetDay}-${otherP}`)) continue;

      const slot = otherDaySlots[otherP];
      if (!slot) continue;

      const otherTime = otherClassSchedule[otherP];
      if (!otherTime) continue;

      // CRITICAL: Strict Time-Overlap Check
      if (!doTimeRangesOverlap(targetTime, otherTime)) continue;

      // 1. Teacher Overlap
      if (teacherId && slot.teacherId === teacherId) {
        const isJointSession = data.jointClasses?.some(
          (jc) =>
            jc.subjectId === subjectId &&
            jc.classIds.includes(classId) &&
            jc.classIds.includes(cId)
        );

        if (!isJointSession) {
          const otherCls = data.classes.find((c) => c.id === cId);
          return {
            valid: false,
            message: `Teacher Busy in ${otherCls?.name || "another class"}`,
            severity: "HIGH",
            penaltyPoints: 1000,
            conflictCount: 1,
          };
        }
      }

      // 2. Room Overlap
      if (roomId && slot.roomId === roomId) {
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
            penaltyPoints: 1000,
            conflictCount: 1,
          };
        }
      }

      // 3. Single Resource Overlap (e.g. Science Labs, Fields)
      const subject = data.subjects.find(s => s.id === subjectId);
      if (subject?.isSingleResource && slot.subjectId === subjectId) {
          // No Joint Check needed? Joint classes share the subject, so they are allowed to overlap?
          // YES. Joint classes are the *same* lesson.
          const isJointSession = data.jointClasses?.some(
              (jc) =>
                jc.subjectId === subjectId &&
                jc.classIds.includes(classId) &&
                jc.classIds.includes(cId)
          );

          if (!isJointSession) {
             return {
                 valid: false,
                 message: "Resource bottleneck",
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
