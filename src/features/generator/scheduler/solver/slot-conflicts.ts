import { AppData, Conflict, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { getRoomCandidates } from "../logic/rooms";

function resolvePrimaryRoomId(
  unit: AllocationUnit,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
): string | undefined {
  const subject = subjectMap.get(unit.subjectId);
  const classGroup = classMap.get(unit.classIds[0]);
  const candidates = getRoomCandidates(unit, subject, classGroup, roomMap);
  if (candidates.length > 0) return candidates[0];
  return subject?.requiredRoomId || unit.defaultRoomId || undefined;
}

export function countPotentialConflicts(
  unit: AllocationUnit,
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
): number {
  let count = 0;

  for (const tid of unit.teacherIds) {
    if (state.teacherOccupancy[tid]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.teacherOccupancy[tid]?.[d]?.[p2]) count++;

    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = teacherMap.get(tid);
    const max = teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
    if (currentLoad + unit.duration > max) count += 2;
  }

  const roomId = resolvePrimaryRoomId(unit, subjectMap, classMap, roomMap);
  if (roomId) {
    if (state.roomOccupancy[roomId]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.roomOccupancy[roomId]?.[d]?.[p2]) count++;
  }

  for (const cid of unit.classIds) {
    if (state.classOccupancy[cid]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.classOccupancy[cid]?.[d]?.[p2]) count++;
  }

  if (state.singleResourceUsage[unit.subjectId]) {
    if (state.singleResourceUsage[unit.subjectId][d][p]) count++;
    if (p2 !== -1 && state.singleResourceUsage[unit.subjectId][d][p2]) count++;
  }

  return count;
}

export function findUnitsInSlot(
  state: SchedulerState,
  unit: AllocationUnit,
  d: number,
  p: number,
  p2: number,
  subjectMap?: Map<string, Subject>,
  classMap?: Map<string, ClassGroup>,
  roomMap?: Map<string, Room>,
): Set<string> {
  const victimIds = new Set<string>();

  unit.teacherIds.forEach((tid) => collectEvictions(state, d, p, p2, tid, "TEACHER", victimIds));

  unit.classIds.forEach((cid) => collectEvictions(state, d, p, p2, cid, "CLASS", victimIds));

  const roomIds =
    subjectMap && classMap && roomMap
      ? getRoomCandidates(
          unit,
          subjectMap.get(unit.subjectId),
          classMap.get(unit.classIds[0]),
          roomMap,
        )
      : unit.defaultRoomId
        ? [unit.defaultRoomId]
        : [];

  for (const roomId of roomIds) {
    collectEvictions(state, d, p, p2, roomId, "ROOM", victimIds);
  }

  if (state.singleResourceUsage[unit.subjectId]) {
    collectEvictions(state, d, p, p2, unit.subjectId, "SUBJECT", victimIds);
  }

  for (const cid of unit.classIds) {
    const daySched = state.schedule[cid]?.[d];
    if (!daySched) continue;

    const subjectsToday = new Set<string>();
    Object.values(daySched).forEach((s) => {
      if (s && s.subjectId && s.subjectId !== unit.subjectId) {
        subjectsToday.add(s.subjectId);
      }
    });

    for (const sId of subjectsToday) {
      const indices: number[] = [];
      Object.keys(daySched).forEach((pStr) => {
        const pIdx = parseInt(pStr);
        const s = daySched[pIdx];
        const isOverwritten = pIdx === p || (p2 !== -1 && pIdx === p2);
        if (s && s.subjectId === sId && !isOverwritten) indices.push(pIdx);
      });

      if (indices.length < 2) continue;
      indices.sort((a, b) => a - b);

      for (let i = indices[0]; i <= indices[indices.length - 1]; i++) {
        if (i === p || (p2 !== -1 && i === p2)) {
          Object.values(daySched).forEach((s) => {
            if (s && s.subjectId === sId && s.unitId && s.unitId !== "BLOCK") {
              victimIds.add(s.unitId);
            }
          });
          break;
        }
      }
    }
  }

  victimIds.delete("BLOCK");
  return victimIds;
}

export function collectEvictions(
  state: SchedulerState,
  d: number,
  p: number,
  p2: number,
  id: string,
  type: "TEACHER" | "CLASS" | "ROOM" | "SUBJECT",
  out: Set<string>,
) {
  let u1: string | null = null;
  let u2: string | null = null;

  if (type === "TEACHER") {
    u1 = state.teacherOccupancy[id]?.[d]?.[p];
    if (p2 !== -1) u2 = state.teacherOccupancy[id]?.[d]?.[p2];
  } else if (type === "CLASS") {
    u1 = state.classOccupancy[id]?.[d]?.[p];
    if (p2 !== -1) u2 = state.classOccupancy[id]?.[d]?.[p2];
  } else if (type === "ROOM") {
    u1 = state.roomOccupancy[id]?.[d]?.[p];
    if (p2 !== -1) u2 = state.roomOccupancy[id]?.[d]?.[p2];
  } else if (type === "SUBJECT") {
    u1 = state.singleResourceUsage[id]?.[d]?.[p];
    if (p2 !== -1) u2 = state.singleResourceUsage[id]?.[d]?.[p2];
  }

  if (u1 && u1 !== "BLOCK") out.add(u1);
  if (u2 && u2 !== "BLOCK") out.add(u2);
}

export function findUnitFromConflict(
  conflict: Conflict,
  unitMap: Map<string, AllocationUnit>,
): AllocationUnit | undefined {
  for (const unit of unitMap.values()) {
    if (unit.subjectId === conflict.subjectId && unit.classIds.includes(conflict.classId)) {
      return unit;
    }
  }
  return undefined;
}
