import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit2, AlertTriangle, Building2, Users } from "lucide-react";
import { AppData } from "../../types";
import { Room } from "./types";
import { Button, Modal, Input, Select } from "../../components/ui";
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

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedRooms.map((room) => {
          return (
            <div
              key={room.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col"
            >
              <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700"></div>

              <div className="p-4 flex-1 flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full mb-3 flex items-center justify-center text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <Building2 size={24} />
                </div>
                <h3
                  className="font-bold text-slate-800 dark:text-slate-100 mb-1 truncate w-full px-2"
                  title={room.name}
                >
                  {room.name}
                </h3>

                <div className="flex gap-1 mb-3">
                  <span className="text-2xs font-bold text-content-muted bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                    {room.type}
                  </span>
                  {room.isHomeRoom && (
                    <span className="text-2xs font-bold text-accent-ink bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-200">
                      Home Room
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1 w-full mt-auto">
                  <div className="text-2xs py-1 px-2 rounded flex items-center justify-center gap-1 bg-slate-50 dark:bg-slate-900 text-content-muted">
                    <Users size={12} />
                    Capacity: <b>{room.capacity}</b>
                  </div>
                </div>
              </div>

              <div className="flex border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => openModal(room)}
                  className="flex-1 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center transition-colors"
                >
                  <Edit2 size={14} className="mr-1" /> Edit
                </button>
                <div className="w-px bg-slate-100 dark:bg-slate-800"></div>
                <button
                  onClick={() => initiateDelete(room)}
                  disabled={room.isHomeRoom}
                  className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center transition-colors ${
                    room.isHomeRoom
                      ? "text-slate-300 cursor-not-allowed opacity-50"
                      : "text-content-muted hover:text-danger-ink hover:bg-red-50 dark:hover:bg-red-900/30"
                  }`}
                >
                  <Trash2 size={14} className="mr-1" /> Del
                </button>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => openModal()}
          className="bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all flex flex-col items-center justify-center p-6 group h-full min-h-[200px]"
        >
          <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 text-content-muted group-hover:text-accent-ink flex items-center justify-center mb-3 transition-colors shadow-inner">
            <Plus size={28} />
          </div>
          <span className="font-bold text-content-muted group-hover:text-accent-ink">Add Room</span>
        </button>
      </div>

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
