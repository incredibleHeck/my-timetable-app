import { AppData, Subject, ClassGroup } from "../../../types";
import { AllocationUnit, SchedulerState } from "./core/types";

/**
 * ARCHITECT NOTES:
 * 1. Performance: Replaced .find() with Map.get() for O(1) access.
 * 2. Logic: Maintains distinction between Phase 1 (Strict) and Phase 2 (Force/Evict).
 */

/**
 * determineRoom: Used in Phase 1 (Greedy).
 * Checks availability. If specific room is busy, returns undefined (Constraint Failure).
 */
export function determineRoom(
  d: number, 
  p: number, 
  p2: number, 
  unit: AllocationUnit, 
  state: SchedulerState, 
  data: AppData,
  subjectMap: Map<string, Subject>, 
  classMap: Map<string, ClassGroup> 
): string | undefined {
  
  const subject = subjectMap.get(unit.subjectId);
  const classGroup = classMap.get(unit.classIds[0]); 

  if (!subject || !classGroup) return undefined;

  // 1. RESOLVE TARGET ROOM
  // Priority: Subject-specific Specialist Room > Class Homeroom
  const targetRoomId = subject.requiredRoomId || classGroup.defaultRoomId;

  if (!targetRoomId) return undefined;

  // 2. AVAILABILITY CHECK
  const roomGrid = state.roomOccupancy[targetRoomId];
  if (!roomGrid) return targetRoomId; 

  if (roomGrid[d]?.[p]) return undefined;
  if (unit.duration === 2 && roomGrid[d]?.[p2]) return undefined;

  return targetRoomId;
}

/**
 * forceDetermineRoom: Used in Phase 2 (Repair).
 * Returns the intended room even if occupied, triggering an eviction.
 */
export function forceDetermineRoom(
  d: number, 
  p: number, 
  p2: number, 
  unit: AllocationUnit, 
  state: SchedulerState, 
  data: AppData,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>
): string | undefined {
  
  const subject = subjectMap.get(unit.subjectId);
  const classGroup = classMap.get(unit.classIds[0]);

  if (!subject || !classGroup) return undefined;

  // Return the Ideal Room
  return subject.requiredRoomId || classGroup.defaultRoomId;
}