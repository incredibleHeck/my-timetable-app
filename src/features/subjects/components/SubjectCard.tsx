import React from "react";
import { BookOpen, DoorClosed, FileX, Gem, Pencil, Trash2, Users } from "lucide-react";
import { Subject } from "../types";
import { resolveSubjectIsCore } from "../../generator/scheduler/logic/subject-core";

interface SubjectCardProps {
  subject: Subject;
  classCount: number;
  teacherCount: number;
  /** Resolved name of `requiredRoomId`, when the subject is pinned to a room. */
  requiredRoomName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onShowTeachers: () => void;
}

const Attribute: React.FC<{
  icon: React.ReactNode;
  label: string;
  title: string;
}> = ({ icon, label, title }) => (
  <span
    title={title}
    className="inline-flex max-w-full items-center gap-1 rounded-full border border-edge bg-surface-muted
               px-2 py-0.5 text-2xs text-content-secondary"
  >
    {icon}
    <span className="truncate">{label}</span>
  </span>
);

const footerButtonClass =
  "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

/**
 * One subject, as a card. The colour band is the identity: the previous card
 * encoded it three times over — band, ringed initials and corner dots — and the
 * initials themselves were a fake avatar ("BI" for Biology) borrowed from a
 * person card.
 *
 * Attributes are shown only when they are true and only when they are the
 * exception. Examinable is the default for every subject, so a badge saying so
 * on nineteen of twenty cards tells you nothing; the card flags the one that
 * is not.
 */
export const SubjectCard: React.FC<SubjectCardProps> = ({
  subject: subj,
  classCount,
  teacherCount,
  requiredRoomName,
  onEdit,
  onDelete,
  onShowTeachers,
}) => {
  const isCore = resolveSubjectIsCore(subj);
  const hasAttributes =
    isCore || subj.isSingleResource || subj.isExaminable === false || Boolean(requiredRoomName);

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-edge bg-surface transition-colors hover:border-edge-strong">
      <div
        className="h-1 w-full shrink-0"
        style={{ backgroundColor: subj.color }}
        aria-hidden="true"
      />

      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <h3 className="truncate text-sm font-semibold text-content" title={subj.name}>
          {subj.name}
        </h3>

        {hasAttributes && (
          <div className="flex flex-wrap gap-1">
            {isCore && (
              <Attribute
                icon={<BookOpen size={10} aria-hidden />}
                label="Core"
                title="Core subject — scheduled earlier in the day"
              />
            )}
            {subj.isSingleResource && (
              <Attribute
                icon={<Gem size={10} aria-hidden />}
                label="Single resource"
                title="Only one class in the school may take this subject at a time"
              />
            )}
            {requiredRoomName && (
              <Attribute
                icon={<DoorClosed size={10} aria-hidden />}
                label={requiredRoomName}
                title={`Always scheduled in ${requiredRoomName}`}
              />
            )}
            {subj.isExaminable === false && (
              <Attribute
                icon={<FileX size={10} aria-hidden />}
                label="Not examinable"
                title="Left out when auto-generating the exam timetable"
              />
            )}
          </div>
        )}

        <dl className="mt-auto space-y-1 text-xs">
          <div className="flex items-center gap-1.5">
            <BookOpen size={11} className="shrink-0 text-content-muted" aria-hidden />
            <dt className="sr-only">Classes</dt>
            <dd className={classCount > 0 ? "text-content-secondary" : "text-content-muted"}>
              {classCount > 0 ? `${classCount} classes` : "Not on any curriculum"}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={11} className="shrink-0 text-content-muted" aria-hidden />
            <dt className="sr-only">Teachers</dt>
            <dd>
              {teacherCount > 0 ? (
                <button
                  type="button"
                  onClick={onShowTeachers}
                  className="rounded text-content-secondary underline-offset-4 hover:underline
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                             focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  {teacherCount} {teacherCount === 1 ? "teacher" : "teachers"}
                </button>
              ) : (
                <span className="text-content-muted">No specialists</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex divide-x divide-edge-subtle border-t border-edge-subtle">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${subj.name}`}
          className={`${footerButtonClass} text-content-secondary hover:bg-surface-muted hover:text-content`}
        >
          <Pencil size={13} aria-hidden /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${subj.name}`}
          className={`${footerButtonClass} text-content-muted hover:bg-danger/10 hover:text-danger-ink`}
        >
          <Trash2 size={13} aria-hidden /> Delete
        </button>
      </div>
    </div>
  );
};
