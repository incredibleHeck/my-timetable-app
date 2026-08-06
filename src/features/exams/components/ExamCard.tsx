import React from "react";
import { AlertTriangle, Lock, Pencil, Trash2, Users } from "lucide-react";
import { ExamSession, AppData } from "../../../types";
import { validateExamMove } from "../logic/examValidation";

interface Props {
  exam: ExamSession;
  data: AppData;
  allExams: ExamSession[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleLock?: () => void;
}

const iconButton =
  "grid h-7 w-7 place-items-center rounded text-content-muted transition-colors " +
  "hover:bg-surface-inset hover:text-content focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface";

export const ExamCard: React.FC<Props> = ({
  exam,
  data,
  allExams,
  onEdit,
  onDelete,
  onToggleLock,
}) => {
  const subject = data.subjects.find((s) => s.id === exam.subjectId);
  const conflicts = validateExamMove(exam, allExams, data);
  const hasCritical = conflicts.some((c) => c.severity === "CRITICAL");

  const classNames = data.classes
    .filter((c) => exam.classIds.includes(c.id))
    .map((c) => c.name)
    .join(", ");

  const invigilatorNames = (exam.invigilatorIds || [])
    .map((id) => data.teachers.find((t) => t.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="group flex flex-col gap-2.5 rounded-lg border border-edge border-l-2 bg-surface p-3"
      style={{ borderLeftColor: hasCritical ? undefined : subject?.color || undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-content">
            {subject?.name || "Unknown subject"}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-content-muted">
            <span className="rounded bg-surface-inset px-1.5 py-0.5 text-content-secondary">
              {exam.paperLabel || `Paper ${exam.paperNumber}`}
            </span>
            {exam.status && exam.status !== "DRAFT" && <span>{exam.status}</span>}
            {exam.locked && <Lock size={11} className="text-accent-ink" aria-hidden />}
          </div>
        </div>

        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {onToggleLock && (
            <button
              type="button"
              onClick={onToggleLock}
              className={`${iconButton} ${exam.locked ? "text-accent-ink" : ""}`}
              title={
                exam.locked ? "Unlock invigilator assignments" : "Lock invigilator assignments"
              }
              aria-label={
                exam.locked ? "Unlock invigilator assignments" : "Lock invigilator assignments"
              }
            >
              <Lock size={13} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className={iconButton}
            title="Edit exam"
            aria-label="Edit exam"
          >
            <Pencil size={13} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className={`${iconButton} hover:text-danger-ink`}
            title="Delete exam"
            aria-label="Delete exam"
          >
            <Trash2 size={13} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums text-content-secondary">
        <span>{new Date(exam.date + "T12:00:00").toLocaleDateString("en-GB")}</span>
        <span>
          {exam.startTime} <span className="text-content-muted">· {exam.duration} min</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5 text-xs">
        <Users size={12} className="shrink-0 text-content-muted" aria-hidden />
        <span className={invigilatorNames ? "text-content-secondary" : "text-accent-ink"}>
          {invigilatorNames || "No invigilators assigned"}
        </span>
      </div>

      {classNames && (
        <div
          className="border-t border-edge-subtle pt-2 text-2xs text-content-muted"
          title={classNames}
        >
          <span className="line-clamp-1">{classNames}</span>
        </div>
      )}

      {conflicts.length > 0 && (
        <ul className="space-y-1 border-t border-edge-subtle pt-2">
          {conflicts.map((c, i) => (
            <li
              key={i}
              className={`flex items-start gap-1.5 text-2xs ${
                c.severity === "CRITICAL" ? "text-danger-ink" : "text-accent-ink"
              }`}
            >
              <AlertTriangle size={11} className="mt-px shrink-0" aria-hidden />
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
