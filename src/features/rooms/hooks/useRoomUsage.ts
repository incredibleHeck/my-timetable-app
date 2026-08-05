import { useMemo } from "react";
import { AppData } from "../../../types";

export interface RoomUsage {
  /** Subjects pinned to this room via `requiredRoomId`. */
  requiredBySubjects: { id: string; name: string; color: string }[];
  /** The class this room belongs to, when it is a home room. */
  homeOf?: string;
}

/**
 * Which records point at each room. Nothing in the UI surfaced this, so deleting
 * a facility silently left every subject pinned to it referencing a room that no
 * longer exists.
 */
export const useRoomUsage = (data: AppData) =>
  useMemo(() => {
    const usage = new Map<string, RoomUsage>();
    const forRoom = (id: string) => {
      let entry = usage.get(id);
      if (!entry) {
        entry = { requiredBySubjects: [] };
        usage.set(id, entry);
      }
      return entry;
    };

    for (const subject of data.subjects) {
      if (subject.requiredRoomId) {
        forRoom(subject.requiredRoomId).requiredBySubjects.push({
          id: subject.id,
          name: subject.name,
          color: subject.color,
        });
      }
    }

    for (const cls of data.classes) {
      if (cls.defaultRoomId) forRoom(cls.defaultRoomId).homeOf = cls.name;
    }

    return (roomId: string): RoomUsage => usage.get(roomId) ?? { requiredBySubjects: [] };
  }, [data.subjects, data.classes]);
