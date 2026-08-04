import { AppData, ScheduleSlot } from "../../../types";

/** What a room is being used for in one (day, period) cell. */
export interface RoomOccupant {
  slot: ScheduleSlot;
  /** Classes present. More than one means a joint lesson. */
  classIds: string[];
  classNames: string[];
  /** Set when the cell holds genuinely different lessons rather than one joint one. */
  isContested: boolean;
}

/**
 * Who is in this room, at this day and period index.
 *
 * A room cell is not like a class cell. Several classes can appear in one room
 * at the same index, and that is usually correct rather than a clash: on the
 * demo school every such case is one of Aunty Ruth's joint PE lessons, where two
 * year groups are taught together in one hall by one teacher. Reading only the
 * first match would hide the second class from the room's own timetable.
 *
 * So the occupants are grouped: one lesson with several classes collapses into a
 * single entry listing them all, while genuinely different lessons sharing the
 * cell are returned separately and flagged, because that is a clash worth
 * seeing rather than smoothing over.
 *
 * Note this indexes by period *number*. Where classes run staggered days the
 * same index is a different time of day for each, which is why the caller shows
 * each occupant's own clock time alongside it.
 */
export function getRoomOccupants(
  data: AppData,
  roomId: string,
  day: number,
  period: number,
): RoomOccupant[] {
  if (!roomId) return [];

  const byLesson = new Map<string, { slot: ScheduleSlot; classIds: string[] }>();

  for (const classId of Object.keys(data.schedule ?? {})) {
    const slot = data.schedule[classId]?.[day]?.[period];
    if (!slot || slot.roomId !== roomId) continue;

    // One lesson taught to several classes shares a subject and a teacher.
    const key = `${slot.subjectId ?? "?"}|${slot.teacherId ?? "?"}`;
    const existing = byLesson.get(key);
    if (existing) {
      existing.classIds.push(classId);
    } else {
      byLesson.set(key, { slot, classIds: [classId] });
    }
  }

  const nameOf = new Map(data.classes.map((c) => [c.id, c.name]));
  const contested = byLesson.size > 1;

  return [...byLesson.values()].map(({ slot, classIds }) => ({
    slot,
    classIds,
    classNames: classIds.map((id) => nameOf.get(id) ?? id),
    isContested: contested,
  }));
}

/**
 * Rooms that are not any class's home base — labs, studios, halls, the library.
 *
 * These are the ones whose timetable a school actually needs to read: a home
 * classroom's schedule is just its class's schedule under another name, whereas
 * a shared facility has no other view that shows who is in it and when.
 */
export function getSpecialistRooms(data: AppData): AppData["rooms"] {
  const homeRoomIds = new Set(
    data.classes.flatMap((c) =>
      [c.defaultRoomId, (c as { classroomId?: string }).classroomId].filter(Boolean),
    ) as string[],
  );
  return data.rooms.filter((r) => !homeRoomIds.has(r.id));
}

/** Teaching periods this room is used for across the week. */
export function countRoomPeriods(data: AppData, roomId: string): number {
  let used = 0;
  const seen = new Set<string>();
  for (const classId of Object.keys(data.schedule ?? {})) {
    for (const dayKey of Object.keys(data.schedule[classId] ?? {})) {
      const day = Number(dayKey);
      for (const periodKey of Object.keys(data.schedule[classId][day] ?? {})) {
        const slot = data.schedule[classId][day][Number(periodKey)];
        if (!slot || slot.roomId !== roomId) continue;
        // A joint lesson occupies the room once, however many classes attend.
        const key = `${day}|${periodKey}|${slot.subjectId ?? ""}|${slot.teacherId ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        used++;
      }
    }
  }
  return used;
}
