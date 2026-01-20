import { SchedulerState } from "../core/types";
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

  // 1. Teacher Overlap (O(1) fast path + O(P) staggered fallback)
  const dayOccupancy = state.teacherOccupancy[teacherId]?.[targetDay];
  if (dayOccupancy) {
      // A. Fast Path: Direct period index match
      const teacherOccupant = dayOccupancy[p];
      if (teacherOccupant && teacherOccupant !== "BLOCK" && !ignoredSlots.has(`${targetDay}-${p}`)) {
          // Allow if it's the SAME unit (for double period heads/tails or joint sessions)
          const currentUnitId = state.classOccupancy[classId]?.[targetDay]?.[p];
          if (teacherOccupant !== currentUnitId) {
              const isJoint = data.jointClasses?.some(jc => 
                  jc.subjectId === ctx.subjectId && 
                  jc.classIds.includes(classId) && 
                  jc.classIds.some(cid => state.classOccupancy[cid]?.[targetDay]?.[p] === teacherOccupant)
              );
              if (!isJoint) {
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
      }

      // B. Staggered Path: Check for time overlaps in other period indices
      const myRange = ctx.classSchedule[p];
      if (myRange) {
          for (let otherP = 0; otherP < dayOccupancy.length; otherP++) {
              if (otherP === p) continue; 
              const uId = dayOccupancy[otherP];
              if (uId && uId !== "BLOCK" && !ignoredSlots.has(`${targetDay}-${otherP}`)) {
                  const otherClsId = state.unitToClassMap.get(uId);
                  if (otherClsId) {
                      const otherSchedule = state.classTimeRanges.get(otherClsId);
                      const otherRange = otherSchedule?.[otherP];
                      
                      if (otherRange && myRange.start < otherRange.end && otherRange.start < myRange.end) {
                          // Apply joint class exception
                          const isJoint = data.jointClasses?.some(jc => 
                              jc.subjectId === ctx.subjectId && 
                              jc.classIds.includes(classId) && 
                              jc.classIds.includes(otherClsId)
                          );
                          if (isJoint) continue;

                          const otherCls = data.classes.find(c => c.id === otherClsId);
                          return {
                            valid: false,
                            message: `Teacher Busy in ${otherCls?.name || "another class"} (Staggered)`,
                            severity: "HIGH",
                            penaltyPoints: 1000,
                            conflictCount: 1,
                          };
                      }
                  }
              }
          }
      }
  }

  // 2. Room Overlap (O(1))
  if (roomId) {
      const roomOccupant = state.roomOccupancy[roomId]?.[targetDay]?.[p];
      if (roomOccupant && roomOccupant !== "BLOCK" && !ignoredSlots.has(`${targetDay}-${p}`)) {
          const currentUnitId = state.classOccupancy[classId]?.[targetDay]?.[p];
          if (roomOccupant !== currentUnitId) {
              // EXCEPTION: Joint Classes (Allowed to share same room)
              const isJoint = data.jointClasses?.some(jc => 
                  jc.subjectId === ctx.subjectId && 
                  jc.classIds.includes(classId) && 
                  jc.classIds.some(cid => state.classOccupancy[cid]?.[targetDay]?.[p] === roomOccupant)
              );
              if (isJoint) return null;

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