import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";

/**
 * determineRoom: Used in Phase 1 (Greedy).
 * Strictly checks for availability before returning a room ID.
 */
export function determineRoom(
  d: number, 
  p: number, 
  p2: number, 
  unit: AllocationUnit, 
  state: SchedulerState, 
  data: AppData
): string | undefined {
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  const classGroup = data.classes.find((c) => c.id === unit.classIds[0]);

  if (!subject || !classGroup) return undefined;

  // 1. RESOLVE TARGET ROOM
  // Priority: Subject-specific Specialist Room > Class Homeroom
  const targetRoomId = subject.requiredRoomId || classGroup.defaultRoomId;

  if (!targetRoomId) return undefined;

  // 2. AVAILABILITY CHECK (O(1) lookup)
  // Check if the room is occupied by another Unit ID.
  const roomGrid = state.roomOccupancy[targetRoomId];
  if (!roomGrid) return targetRoomId; // If grid missing, assume free (or allow fallback)

  const isP1Occupied = roomGrid[d]?.[p] !== null;
  const isP2Occupied = unit.duration === 2 && roomGrid[d]?.[p2] !== null;

  if (isP1Occupied || isP2Occupied) {
    // If it's a homeroom and it's busy, this lesson cannot be held there currently.
    return undefined; 
  }

  return targetRoomId;
}

/**
 * forceDetermineRoom: Used in Phase 2 (Repair).
 * Returns the intended room regardless of occupancy.
 * The solver will then identify the occupant and EVICT them.
 */
export function forceDetermineRoom(
  d: number, 
  p: number, 
  p2: number, 
  unit: AllocationUnit, 
  state: SchedulerState, 
  data: AppData
): string | undefined {
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  const classGroup = data.classes.find((c) => c.id === unit.classIds[0]);

  if (!subject || !classGroup) return undefined;

  // Specialists like Labs/Studios/Fields take precedence.
  // Otherwise, default to the designated classroom (Homeroom).
  return subject.requiredRoomId || classGroup.defaultRoomId;
}
