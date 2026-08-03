import { AppData } from "../../../types";
import { ClassGroup, JointClass, ElectiveBlock } from "../types";
import { generateId, deepClone } from "../../../utils/utils";
import { syncHomeRooms } from "../utils";
import { useProfile } from "../../../contexts/ProfileContext";

export const useClassActions = (data: AppData, onUpdate: (newData: AppData) => void) => {
  const { addActivity } = useProfile();

  const handleDuplicate = (cls: ClassGroup) => {
    const newClass: ClassGroup = deepClone(cls);
    newClass.id = generateId();
    newClass.name = `${cls.name} (Copy)`;
    newClass.defaultRoomId = ""; // Force new room creation in syncHomeRooms
    newClass.curriculum.forEach((c) => (c.id = generateId()));

    const newClasses = [...data.classes, newClass];
    const { updatedClasses, updatedRooms } = syncHomeRooms(newClasses, data.rooms);

    const nextData = { ...data, classes: updatedClasses, rooms: updatedRooms };
    addActivity("ACADEMIC", `Duplicated Class: ${cls.name}`, nextData);
    onUpdate(nextData);
  };

  const handleSaveClass = (newClass: ClassGroup, editingClass: ClassGroup | null) => {
    let newClasses = [...data.classes];
    const msg = editingClass ? `Updated Class: ${newClass.name}` : `Added Class: ${newClass.name}`;
    if (editingClass) {
      newClasses = newClasses.map((c) => (c.id === editingClass.id ? newClass : c));
    } else {
      newClasses.push(newClass);
    }

    // syncHomeRooms handles creation and renaming
    const { updatedClasses, updatedRooms } = syncHomeRooms(newClasses, data.rooms);

    const nextData = { ...data, classes: updatedClasses, rooms: updatedRooms };
    addActivity("ACADEMIC", msg, nextData);
    onUpdate(nextData);
  };

  const confirmDelete = (classToDelete: ClassGroup) => {
    // 1. Find the associated home room
    const homeRoomId = classToDelete.defaultRoomId;
    const isHomeRoom = data.rooms.find((r) => r.id === homeRoomId)?.isHomeRoom;

    // 2. Remove class and room
    const newClasses = data.classes.filter((c) => c.id !== classToDelete.id);
    const newRooms = isHomeRoom ? data.rooms.filter((r) => r.id !== homeRoomId) : data.rooms;

    // 3. Cleanup Joint Classes and Electives
    const newJoints = data.jointClasses
      .map((j) => ({
        ...j,
        classIds: j.classIds.filter((id) => id !== classToDelete.id),
      }))
      .filter((j) => j.classIds.length >= 2);

    const newElectives = (data.electives || [])
      .map((e) => ({
        ...e,
        classIds: e.classIds.filter((id) => id !== classToDelete.id),
      }))
      .filter((e) => e.classIds.length > 0);

    const nextData = {
      ...data,
      classes: newClasses,
      rooms: newRooms,
      jointClasses: newJoints,
      electives: newElectives,
    };

    addActivity("ACADEMIC", `Deleted Class: ${classToDelete.name}`, nextData);
    onUpdate(nextData);
  };

  // --- GROUP (JOINT CLASS) HANDLERS ---
  const handleSaveGroup = (newJoint: JointClass) => {
    const nextData = { ...data, jointClasses: [...data.jointClasses, newJoint] };
    addActivity("ACADEMIC", `Created Class Group: ${newJoint.name}`, nextData);
    onUpdate(nextData);
  };

  const handleRemoveGroup = (id: string) => {
    const joint = data.jointClasses.find((j) => j.id === id);
    const nextData = {
      ...data,
      jointClasses: data.jointClasses.filter((j) => j.id !== id),
    };
    addActivity("ACADEMIC", `Deleted Class Group: ${joint?.name}`, nextData);
    onUpdate(nextData);
  };

  // --- BLOCK (ELECTIVE) HANDLERS ---
  const handleSaveBlock = (newElec: ElectiveBlock) => {
    const safeElectives = data.electives || [];
    const nextData = { ...data, electives: [...safeElectives, newElec] };
    addActivity("ACADEMIC", `Created Elective Block: ${newElec.name}`, nextData);
    onUpdate(nextData);
  };

  const handleRemoveBlock = (id: string) => {
    const elec = (data.electives || []).find((e) => e.id === id);
    const nextData = {
      ...data,
      electives: (data.electives || []).filter((e) => e.id !== id),
    };
    addActivity("ACADEMIC", `Deleted Elective Block: ${elec?.name}`, nextData);
    onUpdate(nextData);
  };

  return {
    handleDuplicate,
    handleSaveClass,
    confirmDelete,
    handleSaveGroup,
    handleRemoveGroup,
    handleSaveBlock,
    handleRemoveBlock,
  };
};
