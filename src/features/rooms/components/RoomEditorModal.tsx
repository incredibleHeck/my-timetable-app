import React, { useEffect, useState } from "react";
import { Room } from "../types";
import { Button, Modal, controlClass } from "../../../components/ui";
import { ROOM_TYPES } from "../constants";
import { generateId } from "../../../utils/utils";

interface RoomEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingRoom: Room | null;
  onSave: (room: Room) => void;
}

export const RoomEditorModal: React.FC<RoomEditorModalProps> = ({
  isOpen,
  onClose,
  editingRoom,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [type, setType] = useState("Classroom");

  useEffect(() => {
    if (!isOpen) return;
    setName(editingRoom?.name ?? "");
    setCapacity(editingRoom ? String(editingRoom.capacity) : "30");
    setType(editingRoom?.type ?? "Classroom");
  }, [isOpen, editingRoom]);

  const isHomeRoom = Boolean(editingRoom?.isHomeRoom);
  const parsedCapacity = parseInt(capacity, 10);
  const capacityIsValid = !Number.isNaN(parsedCapacity) && parsedCapacity > 0;
  const canSave = name.trim().length > 0 && capacityIsValid;

  const handleSave = () => {
    if (!canSave) return;
    // Spread the existing room first. `isHomeRoom` is set by the class sync and
    // is editable nowhere here, but rebuilding the record dropped it — and an
    // unflagged home room stops being renamed with its class, stops being
    // removed with it, and becomes deletable out from under it.
    onSave({
      ...editingRoom,
      id: editingRoom ? editingRoom.id : generateId(),
      name: name.trim(),
      capacity: parsedCapacity,
      type,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingRoom ? "Edit Room" : "New Room"}
      maxWidth="max-w-md"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            Save Room
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="room-name" className="mb-1.5 block text-sm font-medium text-content">
            Name
          </label>
          <input
            id="room-name"
            className={`${controlClass} w-full`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={isHomeRoom}
            autoFocus={!isHomeRoom}
            placeholder="Science Lab A"
          />
          {isHomeRoom && (
            <p className="mt-1 text-xs text-content-muted">
              Home room names follow their class. Rename the class to rename this room.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="room-type" className="mb-1.5 block text-sm font-medium text-content">
            Type
          </label>
          <select
            id="room-type"
            className={`${controlClass} w-full cursor-pointer`}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {ROOM_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-content-muted">
            Subjects that need a particular kind of space are matched on this.
          </p>
        </div>

        <div>
          <label htmlFor="room-capacity" className="mb-1.5 block text-sm font-medium text-content">
            Capacity
          </label>
          <input
            id="room-capacity"
            type="number"
            min={1}
            className={`${controlClass} w-28`}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
          <p className="mt-1 text-xs text-content-muted">
            Students the room seats. The generator flags a class larger than this.
          </p>
        </div>
      </div>
    </Modal>
  );
};
