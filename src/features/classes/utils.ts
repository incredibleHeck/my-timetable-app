import { ClassGroup } from './types';
import { Room } from '../rooms/types';

/**
 * Automatically assigns unique default rooms to classes that don't have one.
 * Ensures a 1-to-1 mapping where possible.
 */
export function assignDefaultRooms(classes: ClassGroup[], rooms: Room[]): ClassGroup[] {
  const assignedRoomIds = new Set(
    classes
      .map(c => c.defaultRoomId)
      .filter((id): id is string => !!id)
  );

  const availableRooms = rooms.filter(r => !assignedRoomIds.has(r.id));
  let roomIndex = 0;

  return classes.map(cls => {
    if (cls.defaultRoomId) return cls;

    const nextRoom = availableRooms[roomIndex];
    if (nextRoom) {
      roomIndex++;
      return { ...cls, defaultRoomId: nextRoom.id };
    }

    return cls;
  });
}
