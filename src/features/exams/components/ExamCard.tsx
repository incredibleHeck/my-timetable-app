import React from "react";
import { Calendar, Clock, Users, Trash2, Edit2, Lock, FileText, AlertTriangle } from "lucide-react";
import { ExamSession, AppData } from "../../../types";
import { Card } from "../../../components/ui";
import { validateExamMove } from "../logic/examValidation";

interface Props {
  exam: ExamSession;
  data: AppData;
  allExams: ExamSession[];
  onEdit: () => void;
  onDelete: () => void;
  onToggleLock?: () => void;
}

export const ExamCard: React.FC<Props> = ({
  exam,
  data,
  allExams,
  onEdit,
  onDelete,
  onToggleLock,
}) => {
  const subject = data.subjects.find((s) => s.id === exam.subjectId);
  const teachers = data.teachers;
  const classes = data.classes;

  const conflicts = validateExamMove(exam, allExams, data);
  const hasCritical = conflicts.some((c) => c.severity === "CRITICAL");
  const hasWarning = conflicts.some((c) => c.severity === "WARNING");

  // Format class names for display (e.g. "10A, 10B")
  const classNames = classes
    .filter((c) => exam.classIds.includes(c.id))
    .map((c) => c.name)
    .join(", ");

  const isLocked = exam.locked;

  // Resolve invigilator names
  const invigilatorNames = (exam.invigilatorIds || [])
    .map((id) => teachers.find((t) => t.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      className={`p-4 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden group border-l-4 ${
        hasCritical
          ? "border-l-red-500 bg-red-50/10"
          : hasWarning
            ? "border-l-amber-500 bg-amber-50/10"
            : "border-l-transparent"
      }`}
    >
      {/* Subject Color Strip (if no critical conflict) */}
      {!hasCritical && (
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: subject?.color || "#cbd5e1" }}
        />
      )}

      {/* Header: Subject Name & Paper Label */}
      <div className="flex justify-between items-start pl-2">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">
            {subject?.name || "Unknown Subject"}
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-2xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {exam.paperLabel || `Paper ${exam.paperNumber}`}
            </span>
            {isLocked && <Lock size={12} className="text-content-muted" />}
            {exam.status && exam.status !== "DRAFT" && (
              <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded bg-slate-700 text-white">
                {exam.status}
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons (Visible on Hover) */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggleLock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleLock();
              }}
              className={`p-1.5 rounded transition-colors ${
                isLocked
                  ? "bg-amber-50 dark:bg-amber-900/30 text-accent-ink hover:bg-amber-100 dark:hover:bg-amber-900/40"
                  : "hover:bg-slate-100 text-content-muted hover:text-slate-600"
              }`}
              title={isLocked ? "Unlock invigilator assignments" : "Lock invigilator assignments"}
            >
              <Lock size={14} />
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-slate-100 text-content-muted hover:text-accent-ink rounded transition-colors"
            title="Edit Exam"
            aria-label="Edit Exam"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-content-muted hover:text-danger-ink rounded transition-colors"
            title="Delete Exam"
            aria-label="Delete Exam"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Meta Information Grid */}
      <div className="grid grid-cols-2 gap-y-2 text-xs pl-2">
        {/* Date */}
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Calendar size={14} className="text-content-muted" />
          <span className="font-medium">{new Date(exam.date).toLocaleDateString()}</span>
        </div>

        {/* Time & Duration */}
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Clock size={14} className="text-content-muted" />
          <span className="font-medium">
            {exam.startTime} <span className="text-content-muted">({exam.duration}m)</span>
          </span>
        </div>

        {/* Invigilator Assignment */}
        <div className="flex items-start gap-2 col-span-2">
          <Users
            size={14}
            className={invigilatorNames ? "text-content-muted mt-0.5" : "text-amber-400 mt-0.5"}
          />
          <span
            className={`text-[11px] leading-tight ${
              !invigilatorNames
                ? "text-accent-ink italic"
                : "text-slate-600 dark:text-slate-300 font-medium"
            }`}
          >
            {invigilatorNames || "Unassigned Invigilators"}
          </span>
        </div>

        {/* Participating Classes */}
        {classNames && (
          <div className="col-span-2 mt-1 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-start gap-2">
            <FileText size={14} className="text-slate-300 mt-0.5 shrink-0" />
            <span className="text-content-muted leading-tight line-clamp-1" title={classNames}>
              {classNames}
            </span>
          </div>
        )}
      </div>

      {/* Conflict Display */}
      {conflicts.length > 0 && (
        <div
          className={`mt-1 p-2 rounded flex flex-col gap-1 text-2xs ml-2 border ${
            hasCritical
              ? "bg-red-50 dark:bg-red-900/30 border-red-100 text-red-800 dark:text-red-200"
              : "bg-amber-50 dark:bg-amber-900/30 border-amber-100 text-amber-800 dark:text-amber-200"
          }`}
        >
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-start gap-1">
              <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              <span className="leading-tight font-bold">{c.message}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
