import React, { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { AppData } from "../../types";
import { Room } from "./types";
import { Button, Modal, quietButtonClass } from "../../components/ui";
import { useProfile } from "../../contexts/ProfileContext";
import { useRoomUsage } from "./hooks/useRoomUsage";
import { RoomEditorModal } from "./components/RoomEditorModal";
import { RoomTable } from "./components/RoomTable";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const SectionHeading: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
    <div>
      <h3 className="text-sm font-semibold text-content">{title}</h3>
      <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-content-muted">{description}</p>
    </div>
    {action}
  </div>
);

export const RoomsView: React.FC<ViewProps> = ({ data, onUpdate: _onUpdate }) => {
  const { addActivity } = useProfile();
  const getUsage = useRoomUsage(data);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomToDelete, setRoomToDelete] = useState<Room | null>(null);

  const byName = (a: Room, b: Room) => a.name.localeCompare(b.name, undefined, { numeric: true });

  /**
   * Home rooms are generated one per class and outnumber real facilities several
   * times over, so listing all of them together buried the handful of spaces the
   * school actually manages.
   */
  const { facilities, homeRooms } = useMemo(() => {
    const sorted = [...data.rooms].sort(byName);
    return {
      facilities: sorted.filter((r) => !r.isHomeRoom),
      homeRooms: sorted.filter((r) => r.isHomeRoom),
    };
  }, [data.rooms]);

  const openEditor = (room: Room | null) => {
    setEditingRoom(room);
    setEditorOpen(true);
  };

  const saveRoom = (room: Room) => {
    const exists = data.rooms.some((r) => r.id === room.id);
    const newRooms = exists
      ? data.rooms.map((r) => (r.id === room.id ? room : r))
      : [...data.rooms, room];
    addActivity("ACADEMIC", `${exists ? "Updated" : "Added"} Room: ${room.name}`, {
      ...data,
      rooms: newRooms,
    });
  };

  const confirmDelete = () => {
    if (!roomToDelete) return;
    const id = roomToDelete.id;
    addActivity("ACADEMIC", `Deleted Room: ${roomToDelete.name}`, {
      ...data,
      rooms: data.rooms.filter((r) => r.id !== id),
      // A subject pinned to a deleted room would keep pointing at nothing, and
      // the scheduler would find no room to satisfy it.
      subjects: data.subjects.map((s) =>
        s.requiredRoomId === id ? { ...s, requiredRoomId: undefined } : s,
      ),
    });
    setRoomToDelete(null);
  };

  const pinnedSubjects = roomToDelete ? getUsage(roomToDelete.id).requiredBySubjects : [];

  return (
    <div data-testid="rooms-view" className="mx-auto max-w-7xl space-y-6 p-6 pb-16 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content">Rooms</h2>
          <p className="mt-1 text-xs text-content-muted">
            <span className="tabular-nums">{facilities.length}</span> shared facilities ·{" "}
            <span className="tabular-nums">{homeRooms.length}</span> home rooms
          </p>
        </div>
        <Button onClick={() => openEditor(null)} icon={<Plus size={16} />}>
          Add Room
        </Button>
      </header>

      <section className="space-y-3">
        <SectionHeading
          title="Shared facilities"
          description="Spaces used across classes — labs, studios, halls. A subject can be pinned to one so every lesson of it is scheduled there."
          action={
            <button type="button" onClick={() => openEditor(null)} className={quietButtonClass}>
              Add room
            </button>
          }
        />
        <RoomTable
          caption="Shared facilities with their type, capacity and the subjects pinned to them"
          rooms={facilities}
          getUsage={getUsage}
          usageHeader="Reserved for"
          onEdit={openEditor}
          onDelete={setRoomToDelete}
          empty={
            <div className="rounded-lg border border-dashed border-edge px-5 py-10 text-center">
              <p className="text-sm text-content">No shared facilities yet.</p>
              <p className="mt-1 text-xs text-content-muted">
                Add one for any space a subject has to be taught in.
              </p>
            </div>
          }
        />
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Home rooms"
          description="One per class, created and named automatically. They are renamed with their class and removed when it is deleted, so only capacity and type are editable here."
        />
        <RoomTable
          caption="Home rooms with the class each belongs to"
          rooms={homeRooms}
          getUsage={getUsage}
          usageHeader="Class"
          onEdit={openEditor}
          empty={
            <div className="rounded-lg border border-dashed border-edge px-5 py-10 text-center">
              <p className="text-sm text-content">No home rooms yet.</p>
              <p className="mt-1 text-xs text-content-muted">
                One is created automatically for each class you add.
              </p>
            </div>
          }
        />
      </section>

      <RoomEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        editingRoom={editingRoom}
        onSave={saveRoom}
      />

      <Modal
        isOpen={roomToDelete !== null}
        onClose={() => setRoomToDelete(null)}
        title="Delete room"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoomToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete Room
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-danger-ink" size={18} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-content">
              Delete <span className="font-medium">{roomToDelete?.name}</span>?
            </p>
            {pinnedSubjects.length > 0 ? (
              <p className="mt-1 text-xs text-content-muted">
                <span className="font-medium text-content-secondary">
                  {pinnedSubjects.map((s) => s.name).join(", ")}
                </span>{" "}
                {pinnedSubjects.length === 1
                  ? "is pinned to this room and will fall back to the class home room."
                  : "are pinned to this room and will fall back to their class home rooms."}
              </p>
            ) : (
              <p className="mt-1 text-xs text-content-muted">
                No subject is pinned to it, so nothing else changes.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
