import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, AlertTriangle, Building2 } from "lucide-react";
import { AppData } from "../../types";
import { Room } from "./types";
import { Button, Modal, Input, Select, DataTable } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { useProfile } from "../../contexts/ProfileContext";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const ROOM_TYPES = [
  { value: "Classroom", label: "Standard Classroom" },
  { value: "Lab", label: "Laboratory" },
  { value: "Library", label: "Library" },
  { value: "Gym", label: "Gymnasium" },
  { value: "Art Studio", label: "Art Studio" },
  { value: "Music Room", label: "Music Room" },
  { value: "Hall", label: "Assembly Hall" },
  { value: "Computer Lab", label: "Computer Lab" },
  { value: "Workshop", label: "Workshop" },
];

export const RoomsView: React.FC<ViewProps> = ({ data, onUpdate: _onUpdate }) => {
  const { addActivity } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("30");
  const [roomType, setRoomType] = useState("Classroom");

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  // Smart Sort
  const sortedRooms = useMemo(() => {
    return [...data.rooms].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  }, [data.rooms]);

  const saveRoom = () => {
    if (!roomName) return;
    const newRoom: Room = {
      id: editingRoom ? editingRoom.id : generateId(),
      name: roomName,
      capacity: parseInt(roomCapacity) || 0,
      type: roomType,
    };

    let newRooms = [...data.rooms];
    const msg = editingRoom ? `Updated Room: ${newRoom.name}` : `Added Room: ${newRoom.name}`;
    if (editingRoom) {
      newRooms = newRooms.map((r) => (r.id === editingRoom.id ? newRoom : r));
    } else {
      newRooms.push(newRoom);
    }
    const nextData = { ...data, rooms: newRooms };
    addActivity("ACADEMIC", msg, nextData);

    setModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setRoomName("");
    setRoomCapacity("30");
    setRoomType("Classroom");
    setEditingRoom(null);
  };

  const initiateDelete = (room: Room) => {
    setRoomToDelete(room);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!roomToDelete) return;
    const id = roomToDelete.id;

    try {
      const updatedRooms = data.rooms.filter((r) => r.id !== id);
      const nextData = { ...data, rooms: updatedRooms };
      addActivity("ACADEMIC", `Deleted Room: ${roomToDelete.name}`, nextData);
    } catch (e) {
      console.error(e);
    }

    setDeleteModalOpen(false);
    setRoomToDelete(null);
  };

  const openModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      setRoomName(room.name);
      setRoomCapacity(room.capacity.toString());
      setRoomType(room.type);
    } else {
      resetForm();
    }
    setModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Room Management</h2>
          <p className="text-xs text-content-muted">Define physical spaces and their capacities.</p>
        </div>
        <Button onClick={() => openModal()} icon={<Plus size={16} />}>
          Add Room
        </Button>
      </div>

      {/* Rooms are a uniform record set (name/type/capacity), so a table reads
          faster and denser than a card grid of near-identical badges. */}
      <DataTable
        caption="Rooms with their type and capacity"
        rows={sortedRooms}
        rowKey={(room) => room.id}
        empty={
          <div className="rounded-xl border border-dashed border-edge-strong bg-surface-muted p-12 text-center">
            <Building2 size={24} className="mx-auto mb-2 text-content-muted" />
            <p className="text-sm font-semibold text-content">No rooms yet</p>
            <p className="mt-1 text-xs text-content-muted">
              Add a room to assign lessons to physical spaces.
            </p>
          </div>
        }
        columns={[
          {
            header: "Room",
            className: "w-[40%]",
            cell: (room) => (
              <div className="flex items-center gap-2 min-w-0">
                <Building2 size={14} className="shrink-0 text-content-muted" aria-hidden="true" />
                <span className="font-semibold truncate" title={room.name}>
                  {room.name}
                </span>
                {room.isHomeRoom && (
                  <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-2xs font-bold text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    Home
                  </span>
                )}
              </div>
            ),
          },
          {
            header: "Type",
            cell: (room) => <span className="text-content-muted">{room.type}</span>,
          },
          {
            header: "Capacity",
            numeric: true,
            cell: (room) => room.capacity,
          },
          {
            header: "Actions",
            className: "w-[1%] whitespace-nowrap",
            cell: (room) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => openModal(room)}
                  aria-label={`Edit ${room.name}`}
                  className="rounded-md p-2 text-content-muted transition-colors hover:bg-surface-muted hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  onClick={() => initiateDelete(room)}
                  disabled={room.isHomeRoom}
                  aria-label={
                    room.isHomeRoom
                      ? `${room.name} is a home room and cannot be deleted`
                      : `Delete ${room.name}`
                  }
                  className="rounded-md p-2 text-content-muted transition-colors hover:bg-red-50 hover:text-danger-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-content-muted dark:hover:bg-red-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRoom ? "Edit Room" : "New Room"}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRoom}>Save Room</Button>
          </div>
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <Input
            label="Room Name/Number"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            autoFocus
            placeholder="e.g. Room 101, Science Lab A"
          />

          <Select
            label="Room Type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            options={ROOM_TYPES}
          />

          <Input
            label="Capacity (Students)"
            type="number"
            value={roomCapacity}
            onChange={(e) => setRoomCapacity(e.target.value)}
            placeholder="e.g. 30"
          />
        </div>
      </Modal>

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Room?"
        aria-label="Delete Room?"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Keep It
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Yes, Delete Room
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-danger-ink shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">
              Delete "{roomToDelete?.name}"?
            </p>
            <p className="text-sm text-content-muted mt-2">
              This will remove the room from your facility list.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
