import { SchedulerState } from "../types";
import { ValidationContext, ValidationResult } from "./types";

/**
 * ARCHITECT NOTES:
 * Refactored to O(1). We use the 'state' occupancy grids instead of scanning all classes.
 */
export const checkOverlaps = (
  ctx: ValidationContext,
  p: number,
  state: SchedulerState // Now Mandatory
): ValidationResult | null => {
  const {
    data,
    classId,
    teacherId,
    roomId,
    targetDay,
    ignoredSlots,
  } = ctx;

  // 1. Teacher Overlap (O(1))
  const teacherOccupant = state.teacherOccupancy[teacherId]?.[targetDay]?.[p];
  if (teacherOccupant && teacherOccupant !== "BLOCK" && !ignoredSlots.has(`${targetDay}-${p}`)) {
      // Allow if it's the SAME unit (for double period heads/tails or joint sessions)
      // Note: Joint sessions share unitId in EduScheduler 2.0
      const currentUnitId = state.classOccupancy[classId]?.[targetDay]?.[p];
      if (teacherOccupant !== currentUnitId) {
          const otherCls = data.classes.find(c => state.classOccupancy[c.id]?.[targetDay]?.[p] === teacherOccupant);
          return {
            valid: false,
            message: `Teacher Busy in ${otherCls?.name || "another class"}`,
            severity: "HIGH",
            penaltyPoints: 1000,
            conflictCount: 1,
          };
      }
  }

  // 2. Room Overlap (O(1))
  if (roomId) {
      const roomOccupant = state.roomOccupancy[roomId]?.[targetDay]?.[p];
      if (roomOccupant && roomOccupant !== "BLOCK" && !ignoredSlots.has(`${targetDay}-${p}`)) {
          const currentUnitId = state.classOccupancy[classId]?.[targetDay]?.[p];
          if (roomOccupant !== currentUnitId) {
              const otherCls = data.classes.find(c => state.classOccupancy[c.id]?.[targetDay]?.[p] === roomOccupant);
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

  return null;
};