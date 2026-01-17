import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";

export function determineRoom(d: number, p: number, p2: number, unit: AllocationUnit, state: SchedulerState, data: AppData): string | undefined {
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  const classGroup = data.classes.find((c) => c.id === unit.classIds[0]);

  if (!subject || !classGroup) return undefined;

  const subjectRequiredRoomId = subject.requiredRoomId;
  if (subjectRequiredRoomId) {
    // Check occupied via new nullability check
    const isOccupied = state.roomOccupancy[subjectRequiredRoomId]?.[d]?.[p] !== null ||
                      (unit.duration === 2 && state.roomOccupancy[subjectRequiredRoomId]?.[d]?.[p2] !== null);
    if (isOccupied) return undefined; 
    return subjectRequiredRoomId;
  }

  const homeRoomId = classGroup.defaultRoomId;
  if (homeRoomId) {
    const isOccupied = state.roomOccupancy[homeRoomId]?.[d]?.[p] !== null ||
                      (unit.duration === 2 && state.roomOccupancy[homeRoomId]?.[d]?.[p2] !== null);
    if (isOccupied) return undefined; 
    return homeRoomId;
  }
  return undefined;
}

export function forceDetermineRoom(d: number, p: number, p2: number, unit: AllocationUnit, state: SchedulerState, data: AppData): string | undefined {
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  const classGroup = data.classes.find((c) => c.id === unit.classIds[0]);
  if (!subject || !classGroup) return undefined;
  if (subject.requiredRoomId) return subject.requiredRoomId;
  if (classGroup.defaultRoomId) return classGroup.defaultRoomId;
  return undefined;
}