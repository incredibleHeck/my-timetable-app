import { AppData, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";

export type RoomResolveOptions = {
  /** When true, only return a room that is free for the slot(s). */
  requireAvailable?: boolean;
  /** When false, return the ideal room even if occupied (repair eviction). */
  allowFallback?: boolean;
};

function isRoomFree(
  state: SchedulerState,
  roomId: string,
  d: number,
  p: number,
  p2: number,
  duration: number,
): boolean {
  const grid = state.roomOccupancy[roomId];
  if (!grid) return true;
  if (grid[d]?.[p]) return false;
  if (duration === 2 && p2 !== -1 && grid[d]?.[p2]) return false;
  return true;
}

/**
 * Ordered room candidates for a unit.
 * requiredRoomId → preferredRoomIds → homeroom → type-matched rooms.
 */
export function getRoomCandidates(
  unit: AllocationUnit,
  subject: Subject | undefined,
  classGroup: ClassGroup | undefined,
  roomMap: Map<string, Room>,
): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const add = (roomId: string | null | undefined) => {
    if (!roomId || seen.has(roomId) || !roomMap.has(roomId)) return;
    seen.add(roomId);
    candidates.push(roomId);
  };

  add(subject?.requiredRoomId);
  if (subject?.requiredRoomId) {
    return candidates;
  }

  // A required room TYPE narrows the choice; it does not merely widen it.
  //
  // These rooms used to be appended after the class's home classroom, and the
  // resolver takes the first candidate that is free — so the home classroom,
  // which is nearly always free, won every time. A school could mark ICT as
  // needing a Computer Lab and find every ICT lesson scheduled in the ordinary
  // classroom, with the lab reporting 0% utilisation and nothing explaining why.
  //
  // If no room of the type exists the list comes back empty and the lesson goes
  // unplaced, which is the honest outcome: the requirement cannot be met, and
  // diagnose-unplaced will say so rather than quietly ignoring it.
  if (unit.requiredRoomType) {
    for (const room of roomMap.values()) {
      if (room.type === unit.requiredRoomType) add(room.id);
    }
    return candidates;
  }

  unit.preferredRoomIds?.forEach(add);
  add(classGroup?.defaultRoomId);
  add(unit.defaultRoomId);

  return candidates;
}

/**
 * Shared room resolution for construction, repair, and conflict detection.
 */
export function resolveTargetRoom(
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: SchedulerState,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  options: RoomResolveOptions = {},
): string | undefined {
  const { requireAvailable = false, allowFallback = true } = options;
  const subject = subjectMap.get(unit.subjectId);
  const classGroup = classMap.get(unit.classIds[0]);
  if (!subject || !classGroup) return undefined;

  const candidates = getRoomCandidates(unit, subject, classGroup, roomMap);
  if (candidates.length === 0) return undefined;

  if (!requireAvailable) {
    return candidates[0];
  }

  if (!allowFallback && subject.requiredRoomId) {
    return isRoomFree(state, subject.requiredRoomId, d, p, p2, unit.duration)
      ? subject.requiredRoomId
      : undefined;
  }

  for (const roomId of candidates) {
    if (isRoomFree(state, roomId, d, p, p2, unit.duration)) {
      return roomId;
    }
  }

  return undefined;
}

/** Phase 1: first available room in the fallback chain. */
export function determineRoom(
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: SchedulerState,
  _data: AppData,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
): string | undefined {
  return resolveTargetRoom(d, p, p2, unit, state, subjectMap, classMap, roomMap, {
    requireAvailable: true,
    allowFallback: true,
  });
}

/** Phase 2: ideal room (first candidate), even if occupied. */
export function forceDetermineRoom(
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: SchedulerState,
  _data: AppData,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
): string | undefined {
  return resolveTargetRoom(d, p, p2, unit, state, subjectMap, classMap, roomMap, {
    requireAvailable: false,
  });
}
