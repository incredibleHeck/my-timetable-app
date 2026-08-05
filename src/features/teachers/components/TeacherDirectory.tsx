import React from "react";
import { Ban, Copy, Pencil, Trash2 } from "lucide-react";
import { AppData } from "../../../types";
import { Teacher } from "../types";
import { DataTable, DataTableColumn, EntityChip } from "../../../components/ui";
import { WorkloadStat } from "../../workload/hooks/useWorkloadStats";
import { LoadMeter } from "./LoadMeter";

/** Two keeps every row one line tall; the rest are named in the overflow tooltip. */
const MAX_VISIBLE_SUBJECTS = 2;

const rowActionClass =
  "grid h-7 w-7 place-items-center rounded text-content-muted transition-colors " +
  "hover:bg-surface-inset hover:text-content focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

interface TeacherDirectoryProps {
  data: AppData;
  teachers: Teacher[];
  workloadByTeacherId: Map<string, WorkloadStat>;
  onEdit: (teacher: Teacher) => void;
  onDuplicate: (teacher: Teacher) => void;
  onDelete: (teacher: Teacher) => void;
  emptyMessage: React.ReactNode;
}

/**
 * Forty teachers as rows, not cards. The previous card grid gave every record a
 * portrait avatar and a ragged height, so a uniform list of names and numbers
 * took ten screens to read; the project's own DataTable exists for exactly this.
 */
export const TeacherDirectory: React.FC<TeacherDirectoryProps> = ({
  data,
  teachers,
  workloadByTeacherId,
  onEdit,
  onDuplicate,
  onDelete,
  emptyMessage,
}) => {
  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const weeklyCapacity = data.settings.maxTeachingPeriodsPerWeek ?? 24;

  const columns: DataTableColumn<Teacher>[] = [
    {
      header: "Teacher",
      className: "w-[22%] min-w-[10rem]",
      cell: (t) => (
        <button
          type="button"
          onClick={() => onEdit(t)}
          className="max-w-full truncate rounded text-left text-sm font-medium text-content
                     underline-offset-4 hover:underline focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2
                     focus-visible:ring-offset-surface"
        >
          {t.name}
        </button>
      ),
    },
    {
      header: "Subjects",
      cell: (t) => {
        if (t.specialtyIds.length === 0) {
          return <span className="text-xs text-content-muted">None</span>;
        }
        const hidden = t.specialtyIds.length - MAX_VISIBLE_SUBJECTS;
        return (
          <div className="flex items-center gap-1 overflow-hidden">
            {t.specialtyIds.slice(0, MAX_VISIBLE_SUBJECTS).map((sid) => {
              const s = subjectById.get(sid);
              return s ? (
                <EntityChip key={sid} color={s.color} label={s.name} className="min-w-0" />
              ) : null;
            })}
            {hidden > 0 && (
              <span
                className="shrink-0 whitespace-nowrap text-2xs text-content-muted"
                title={t.specialtyIds
                  .slice(MAX_VISIBLE_SUBJECTS)
                  .map((sid) => subjectById.get(sid)?.name)
                  .filter(Boolean)
                  .join(", ")}
              >
                +{hidden}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Weekly load",
      className: "w-[9rem]",
      cell: (t) => {
        const stat = workloadByTeacherId.get(t.id);
        if (!stat) return <span className="block text-right text-xs text-content-muted">—</span>;
        return (
          <LoadMeter
            assignedPeriods={stat.assignedPeriods}
            capacity={t.targetLoad || weeklyCapacity}
            utilizationPct={stat.utilizationPct}
          />
        );
      },
    },
    {
      header: "Availability",
      className: "w-[8rem]",
      cell: (t) => {
        const blocked = (t.constraints || []).flat().filter(Boolean).length;
        if (blocked === 0) {
          return <span className="text-xs text-content-muted">Full week</span>;
        }
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-accent-ink">
            <Ban size={12} aria-hidden />
            {blocked} blocked
          </span>
        );
      },
    },
    {
      header: "Actions",
      className: "w-[7rem] text-right",
      cell: (t) => (
        <div className="flex items-center justify-end gap-0.5">
          <button
            type="button"
            onClick={() => onEdit(t)}
            className={rowActionClass}
            title={`Edit ${t.name}`}
            aria-label={`Edit ${t.name}`}
          >
            <Pencil size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(t)}
            className={rowActionClass}
            title={`Duplicate ${t.name}`}
            aria-label={`Duplicate ${t.name}`}
          >
            <Copy size={14} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onDelete(t)}
            className={`${rowActionClass} hover:text-danger-ink`}
            title={`Delete ${t.name}`}
            aria-label={`Delete ${t.name}`}
          >
            <Trash2 size={14} aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      caption="Teachers with their subjects, weekly load and availability"
      columns={columns}
      rows={teachers}
      rowKey={(t) => t.id}
      empty={emptyMessage}
    />
  );
};
