import { doTimeRangesOverlap } from "../../../../utils/timeUtils";
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

  // --- OPTIMIZED PATH: O(1) Check using Unit Registry ---
  if (state) {
    // 1. Teacher Overlap (O(1))
    const teacherVictim = state.teacherOccupancy[teacherId]?.[targetDay]?.[p];
    if (teacherVictim && !ignoredSlots.has(p)) {
        // Need to check if it's a joint class
        const isJoint = data.jointClasses?.some(jc => 
            jc.subjectId === subjectId && 
            jc.classIds.includes(classId) && 
            state.schedule[jc.classIds.find(id => id !== classId) || ""]?.[targetDay]?.[p]?.unitId === teacherVictim
        );
        if (!isJoint) {
            return {
                valid: false,
                message: `Teacher is busy elsewhere`,
                severity: "HIGH",
                penaltyPoints: 1000,
                conflictCount: 1
            };
        }
    }

    // 2. Room Overlap (O(1))
    if (roomId) {
        const roomVictim = state.roomOccupancy[roomId]?.[targetDay]?.[p];
        if (roomVictim && !ignoredSlots.has(p)) {
            const isJoint = data.jointClasses?.some(jc => 
                jc.subjectId === subjectId && 
                jc.classIds.includes(classId)
            );
            if (!isJoint) {
                return {
                    valid: false,
                    message: `Room occupied`,
                    severity: "HIGH",
                    penaltyPoints: 1000,
                    conflictCount: 1
                };
            }
        }
    }
    
    return null;
  }

  // --- FALLBACK PATH: O(N) Scan (Legacy/UI) ---
  for (const cId of Object.keys(data.schedule)) {
    if (cId === classId) continue;

    const otherClassSchedule = allClassSchedules.get(cId);
    if (!otherClassSchedule) continue;

    const otherDaySlots = data.schedule[cId]?.[targetDay] || {};

    for (const otherPStr in otherDaySlots) {
      const otherP = parseInt(otherPStr);
      if (ignoredSlots.has(otherP)) continue;

      const slot = otherDaySlots[otherP];
      if (!slot) continue;

      const otherTime = otherClassSchedule[otherP];
      if (!otherTime) continue;

      if (!doTimeRangesOverlap(targetTime, otherTime)) continue;

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
            message: `Teacher is busy in ${otherCls?.name || "another class"}`,
            severity: "HIGH",
            penaltyPoints: 1000,
            conflictCount: 1,
          };
        }
      }

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
    }
  }
  return null;
};
