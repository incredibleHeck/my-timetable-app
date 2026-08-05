import React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Room } from "../types";
import { DataTable, DataTableColumn, EntityChip } from "../../../components/ui";
import { roomTypeLabel } from "../constants";
import { RoomUsage } from "../hooks/useRoomUsage";

const iconButton =
  "grid h-7 w-7 place-items-center rounded text-content-muted transition-colors " +
  "hover:bg-surface-inset hover:text-content focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface " +
  "disabled:pointer-events-none disabled:opacity-30";

interface RoomTableProps {
  caption: string;
  rooms: Room[];
  getUsage: (roomId: string) => RoomUsage;
  onEdit: (room: Room) => void;
  /** Omitted for home rooms, which are removed with their class. */
  onDelete?: (room: Room) => void;
  empty: React.ReactNode;
  /** Home rooms show the class they belong to instead of subject pins. */
  usageHeader: string;
}

export const RoomTable: React.FC<RoomTableProps> = ({
  caption,
  rooms,
  getUsage,
  onEdit,
  onDelete,
  empty,
  usageHeader,
}) => {
  const columns: DataTableColumn<Room>[] = [
    {
      header: "Room",
      className: "w-[26%]",
      cell: (room) => (
        <button
          type="button"
          onClick={() => onEdit(room)}
          className="max-w-full truncate rounded text-left text-sm font-medium text-content
                     underline-offset-4 hover:underline focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                     focus-visible:ring-offset-surface"
        >
          {room.name}
        </button>
      ),
    },
    {
      header: "Type",
      className: "w-[11rem]",
      cell: (room) => (
        <span className="text-xs text-content-muted">{roomTypeLabel(room.type)}</span>
      ),
    },
    {
      header: "Seats",
      className: "w-[5rem] text-right",
      cell: (room) => (
        <span className="text-sm tabular-nums text-content-secondary">{room.capacity}</span>
      ),
    },
    {
      header: usageHeader,
      cell: (room) => {
        const usage = getUsage(room.id);
        if (usage.homeOf) {
          return <span className="text-xs text-content-secondary">{usage.homeOf}</span>;
        }
        if (usage.requiredBySubjects.length === 0) {
          return <span className="text-xs text-content-muted">Any subject</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1">
            {usage.requiredBySubjects.map((s) => (
              <EntityChip key={s.id} color={s.color} label={s.name} className="min-w-0" />
            ))}
          </div>
        );
      },
    },
    {
      header: "Actions",
      className: "w-[5rem] text-right",
      cell: (room) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(room)}
            title={`Edit ${room.name}`}
            aria-label={`Edit ${room.name}`}
            className={iconButton}
          >
            <Pencil size={14} aria-hidden />
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(room)}
              title={`Delete ${room.name}`}
              aria-label={`Delete ${room.name}`}
              className={`${iconButton} hover:text-danger-ink`}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      caption={caption}
      rows={rooms}
      rowKey={(room) => room.id}
      columns={columns}
      empty={empty}
    />
  );
};
