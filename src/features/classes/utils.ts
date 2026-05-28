import { ClassGroup } from "./types";
import { Room } from "../rooms/types";
import { generateId } from "../../utils/utils";

/**
 * Ensures every class has a unique system-generated Home Room.
 * Returns updated classes and any newly created rooms.
 */
export function syncHomeRooms(
  classes: ClassGroup[],
  rooms: Room[],
): { updatedClasses: ClassGroup[]; updatedRooms: Room[] } {
  const currentRooms = [...rooms];
  const updatedClasses = classes.map((cls) => {
    // 1. Find room by ID if class already has a defaultRoomId
    let homeRoom = cls.defaultRoomId ? currentRooms.find((r) => r.id === cls.defaultRoomId) : null;

    // 2. If no room found by ID, try to find a matching home room by name (for stability/migration)
    if (!homeRoom) {
      const targetName = `${cls.name} Classroom`;
      homeRoom = currentRooms.find((r) => r.name === targetName && r.isHomeRoom);
    }

    if (!homeRoom) {
      // 3. Create new Home Room if none exists for this class
      const newRoom: Room = {
        id: generateId(),
        name: `${cls.name} Classroom`,
        capacity: 30,
        type: "Classroom",
        isHomeRoom: true,
      };
      currentRooms.push(newRoom);
      homeRoom = newRoom;
    } else if (homeRoom.isHomeRoom && homeRoom.name !== `${cls.name} Classroom`) {
      // 4. Update the name of the EXISTING room if class name changed
      // This preserves the Room ID for that specific class
      homeRoom.name = `${cls.name} Classroom`;
    }

    return { ...cls, defaultRoomId: homeRoom.id };
  });

  return { updatedClasses, updatedRooms: currentRooms };
}
