import React from "react";
import { Copy, Trash2, Pencil } from "lucide-react";
import { AppData } from "../../../types";
import { ClassGroup } from "../types";
import { DataTable } from "../../../components/ui";
import { useClassMetrics } from "../hooks/useClassMetrics";

interface ClassListProps {
  data: AppData;
  onEdit: (cls: ClassGroup) => void;
  onDuplicate: (cls: ClassGroup) => void;
  onDelete: (cls: ClassGroup) => void;
  onAdd: () => void;
}

const iconButton =
  "grid h-7 w-7 place-items-center rounded text-content-muted transition-colors " +
  "hover:bg-surface-inset hover:text-content focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

export const ClassList: React.FC<ClassListProps> = ({
  data,
  onEdit,
  onDuplicate,
  onDelete,
  onAdd,
}) => {
  const { getLoadMetrics } = useClassMetrics(data);

  const sorted = [...data.classes].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );

  const roomName = (cls: ClassGroup) =>
    data.rooms.find((r) => r.id === cls.defaultRoomId)?.name || "Unassigned";

  return (
    <DataTable
      caption="Classes with their home room, period count, curriculum size and weekly load"
      rows={sorted}
      rowKey={(cls) => cls.id}
      empty={
        <div className="rounded-lg border border-dashed border-edge px-5 py-12 text-center">
          <p className="text-sm text-content">No classes yet.</p>
          <p className="mt-1 text-xs text-content-muted">
            A class group holds a curriculum and a home room — add one to start scheduling.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="mt-3 rounded text-xs font-medium text-accent-ink underline-offset-4
                       hover:underline focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-accent"
          >
            Add the first class
          </button>
        </div>
      }
      columns={[
        {
          header: "Class",
          className: "w-[24%]",
          cell: (cls) => (
            <button
              type="button"
              onClick={() => onEdit(cls)}
              className="max-w-full truncate rounded text-left text-sm font-medium text-content
                         underline-offset-4 hover:underline focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                         focus-visible:ring-offset-surface"
            >
              {cls.name}
            </button>
          ),
        },
        {
          header: "Home room",
          cell: (cls) => (
            <span className="truncate text-xs text-content-muted" title={roomName(cls)}>
              {roomName(cls)}
            </span>
          ),
        },
        {
          header: "Day",
          className: "w-[8rem] whitespace-nowrap",
          cell: (cls) => (
            <span className="text-xs text-content-muted">
              <span className="tabular-nums text-content-secondary">{cls.periodCount}</span> ×{" "}
              <span className="tabular-nums text-content-secondary">{cls.duration}</span> min
            </span>
          ),
        },
        {
          header: "Curriculum",
          className: "w-[9rem]",
          cell: (cls) => {
            const active = cls.curriculum.filter((c) => c.periodsPerWeek > 0);
            const unstaffed = active.filter((c) => !c.assignedTeacherId).length;
            return (
              <div className="text-xs">
                <span className="tabular-nums text-content-secondary">{active.length}</span>{" "}
                <span className="text-content-muted">subjects</span>
                {unstaffed > 0 && (
                  <div className="text-2xs text-accent-ink">
                    <span className="tabular-nums">{unstaffed}</span> without a teacher
                  </div>
                )}
              </div>
            );
          },
        },
        {
          header: "Weekly load",
          className: "w-[9rem] text-right",
          cell: (cls) => {
            const { assigned, capacity } = getLoadMetrics(cls);
            const pct = capacity > 0 ? (assigned / capacity) * 100 : 0;
            const isOverloaded = assigned > capacity;
            const isFull = assigned === capacity;
            return (
              <div className="ml-auto w-24">
                <div className="flex items-baseline justify-end gap-1 tabular-nums">
                  <span className="text-sm text-content">{assigned}</span>
                  <span className="text-2xs text-content-muted">/ {capacity}</span>
                </div>
                <div
                  className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-surface-inset"
                  role="img"
                  aria-label={`${assigned} of ${capacity} periods assigned`}
                >
                  <div
                    className={`h-full ${
                      isOverloaded ? "bg-danger" : isFull ? "bg-accent" : "bg-success"
                    }`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          },
        },
        {
          header: "Actions",
          className: "w-[7rem] text-right",
          cell: (cls) => (
            <div className="flex items-center justify-end gap-0.5">
              <button
                type="button"
                onClick={() => onEdit(cls)}
                title={`Edit ${cls.name}`}
                aria-label={`Edit ${cls.name}`}
                className={iconButton}
              >
                <Pencil size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(cls)}
                title={`Duplicate ${cls.name}`}
                aria-label={`Duplicate ${cls.name}`}
                className={iconButton}
              >
                <Copy size={14} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => onDelete(cls)}
                title={`Delete ${cls.name}`}
                aria-label={`Delete ${cls.name}`}
                className={`${iconButton} hover:text-danger-ink`}
              >
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ),
        },
      ]}
    />
  );
};
