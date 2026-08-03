import React from "react";
import { Copy, Trash2, Pencil, BookOpen } from "lucide-react";
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
  "rounded-md p-2 text-content-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

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
    // Each card was four label/value rows — i.e. a table row per class. Columns
    // make classes comparable at a glance instead of forcing a card-by-card scan.
    <div className="space-y-4 animate-in slide-in-from-bottom-2">
      <DataTable
        caption="Classes with their home room, period count, subject count and weekly load"
        rows={sorted}
        rowKey={(cls) => cls.id}
        empty={
          <div className="rounded-xl border border-dashed border-edge-strong bg-surface-muted p-12 text-center">
            <BookOpen size={24} className="mx-auto mb-2 text-content-muted" />
            <p className="text-sm font-semibold text-content">No classes yet</p>
            <p className="mt-1 text-xs text-content-muted">
              Add a class group to start building its curriculum.
            </p>
          </div>
        }
        columns={[
          {
            header: "Class",
            className: "w-[26%]",
            cell: (cls) => (
              <div className="min-w-0">
                <div className="font-semibold truncate">{cls.name}</div>
                <div className="text-2xs text-content-muted">{cls.duration} min periods</div>
              </div>
            ),
          },
          {
            header: "Home room",
            cell: (cls) => (
              <span className="truncate text-content-muted" title={roomName(cls)}>
                {roomName(cls)}
              </span>
            ),
          },
          { header: "Periods/day", numeric: true, cell: (cls) => cls.periodCount },
          { header: "Subjects", numeric: true, cell: (cls) => cls.curriculum.length },
          {
            header: "Weekly load",
            className: "w-[18%]",
            cell: (cls) => {
              const { assigned, capacity } = getLoadMetrics(cls);
              const pct = capacity > 0 ? (assigned / capacity) * 100 : 0;
              const isOverloaded = assigned > capacity;
              const isFull = assigned === capacity;
              return (
                <div className="flex items-center gap-2">
                  <div
                    className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-inset"
                    role="img"
                    aria-label={`${assigned} of ${capacity} periods assigned`}
                  >
                    <div
                      className={`h-full rounded-full ${
                        isOverloaded ? "bg-danger" : isFull ? "bg-accent" : "bg-success"
                      }`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span
                    className={`tabular-nums font-semibold ${
                      isOverloaded
                        ? "text-danger-ink"
                        : isFull
                          ? "text-accent-ink"
                          : "text-content-muted"
                    }`}
                  >
                    {assigned}/{capacity}
                  </span>
                </div>
              );
            },
          },
          {
            header: "Actions",
            className: "w-[1%] whitespace-nowrap",
            cell: (cls) => (
              <div className="flex items-center justify-end gap-1">
                <button
                  onClick={() => onEdit(cls)}
                  aria-label={`Edit ${cls.name}`}
                  className={`${iconButton} hover:bg-surface-muted hover:text-accent-ink`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => onDuplicate(cls)}
                  aria-label={`Duplicate ${cls.name}`}
                  className={`${iconButton} hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-200`}
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={() => onDelete(cls)}
                  aria-label={`Delete ${cls.name}`}
                  className={`${iconButton} hover:bg-red-50 hover:text-danger-ink dark:hover:bg-red-900/30`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ),
          },
        ]}
      />

      <button
        onClick={onAdd}
        className="w-full rounded-xl border-2 border-dashed border-edge-strong px-4 py-3 text-sm font-bold text-content-muted transition-all hover:border-accent hover:bg-amber-50 hover:text-accent-ink dark:hover:bg-amber-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        + Add Class
      </button>
    </div>
  );
};
