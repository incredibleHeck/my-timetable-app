import React from "react";
import { Plus } from "lucide-react";
import { AppData, Subject } from "../../../types";
import { Teacher } from "../types";
import { Panel, PanelRegion } from "../../../components/ui";

interface FacultyListProps {
  data: AppData;
  subjects: Subject[];
  onEditTeacher: (teacher: Teacher) => void;
  onQuickAdd: (subjectId: string) => void;
}

/**
 * Faculties are derived, not authored — a teacher appears here because a subject
 * is on their record. One row per subject keeps that relationship legible; the
 * previous two-column card grid gave a faculty of one the same weight as a
 * faculty of twelve.
 */
export const FacultyList: React.FC<FacultyListProps> = ({
  data,
  subjects,
  onEditTeacher,
  onQuickAdd,
}) => (
  <Panel
    title="Faculties"
    description="Grouped automatically from each teacher's subjects. Edit a teacher's subjects to move them between faculties."
    action={
      <span className="text-xs tabular-nums text-content-muted">{subjects.length} subjects</span>
    }
  >
    <PanelRegion className="divide-y divide-edge-subtle">
      {subjects.map((subject) => {
        const members = data.teachers
          .filter((t) => t.specialtyIds.includes(subject.id))
          .sort((a, b) => a.name.localeCompare(b.name));

        return (
          <div
            key={subject.id}
            className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:gap-6"
          >
            <div className="flex w-full shrink-0 items-center gap-2 sm:w-48">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: subject.color }}
              />
              <span className="truncate text-sm font-medium text-content">{subject.name}</span>
              <span className="ml-auto text-2xs tabular-nums text-content-muted">
                {members.length}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {members.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onEditTeacher(t)}
                  aria-label={`Edit ${t.name}`}
                  className="rounded-full border border-edge px-2.5 py-1 text-xs text-content-secondary
                             transition-colors hover:border-edge-strong hover:text-content
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                             focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  {t.name}
                </button>
              ))}
              {members.length === 0 && (
                <span className="text-xs text-content-muted">No teachers yet</span>
              )}
              <button
                type="button"
                onClick={() => onQuickAdd(subject.id)}
                aria-label={`Add a teacher to ${subject.name}`}
                title={`Add a teacher to ${subject.name}`}
                className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-edge-strong
                           text-content-muted transition-colors hover:border-accent hover:text-accent-ink
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                           focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <Plus size={13} aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
      {subjects.length === 0 && (
        <p className="px-5 py-8 text-center text-xs text-content-muted">
          No subjects defined yet — add them in the Subjects library and faculties will appear here.
        </p>
      )}
    </PanelRegion>
  </Panel>
);
