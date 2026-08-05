import React, { useState, useMemo } from "react";
import { X } from "lucide-react";
import { AppData } from "../../../types";
import { Button, Panel, PanelRegion, controlClass, quietButtonClass } from "../../../components/ui";
import { useHistory } from "../../../contexts/HistoryContext";

interface Props {
  data: AppData;
  onUpdate: (d: AppData) => void;
}

type Notice = { text: string; tone: "done" | "blocked" };

export const ClassAssignmentsPanel: React.FC<Props> = ({ data, onUpdate }) => {
  const { pushToHistory } = useHistory();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);

  const sortedClasses = useMemo(
    () =>
      [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [data.classes],
  );

  const sortedTeachers = useMemo(
    () => [...data.teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [data.teachers],
  );

  const selectedClass = data.classes.find((c) => c.id === selectedClassId);

  const commit = (nextClasses: AppData["classes"], text: string) => {
    pushToHistory(data);
    onUpdate({ ...data, classes: nextClasses });
    setNotice({ text, tone: "done" });
  };

  const handleAssign = () => {
    setNotice(null);
    const cls = selectedClass;
    const teacher = data.teachers.find((t) => t.id === selectedTeacherId);
    if (!cls || !teacher) return;

    const classSubjects = cls.curriculum.map((c) => c.subjectId);
    const matching = teacher.specialtyIds.filter((sid) => classSubjects.includes(sid));

    if (matching.length === 0) {
      setNotice({
        text: `${teacher.name} teaches none of the subjects on ${cls.name}'s curriculum.`,
        tone: "blocked",
      });
      return;
    }

    let assignedCount = 0;
    const newCurriculum = cls.curriculum.map((c) => {
      if (matching.includes(c.subjectId) && c.periodsPerWeek > 0) {
        assignedCount++;
        return { ...c, assignedTeacherId: teacher.id };
      }
      return c;
    });

    if (assignedCount === 0) {
      setNotice({
        text: `${teacher.name}'s subjects appear on ${cls.name}'s curriculum but have no periods allocated.`,
        tone: "blocked",
      });
      return;
    }

    const subjNames = matching
      .map((sid) => data.subjects.find((s) => s.id === sid)?.name)
      .filter(Boolean)
      .join(", ");

    commit(
      data.classes.map((c) => (c.id === cls.id ? { ...cls, curriculum: newCurriculum } : c)),
      `${teacher.name} now teaches ${subjNames} in ${cls.name}.`,
    );
    setSelectedTeacherId("");
  };

  const handleClearTeachers = () => {
    setNotice(null);
    const cls = selectedClass;
    if (!cls) return;

    const assignedCount = cls.curriculum.filter((c) => c.assignedTeacherId).length;
    if (assignedCount === 0) {
      setNotice({ text: `${cls.name} has no teachers assigned.`, tone: "blocked" });
      return;
    }

    const newCurriculum = cls.curriculum.map((c) =>
      c.assignedTeacherId ? { ...c, assignedTeacherId: undefined } : c,
    );

    commit(
      data.classes.map((c) => (c.id === cls.id ? { ...cls, curriculum: newCurriculum } : c)),
      `Cleared ${assignedCount} teacher ${assignedCount === 1 ? "assignment" : "assignments"} from ${cls.name}.`,
    );
    setSelectedTeacherId("");
  };

  return (
    <div className="space-y-4">
      <Panel
        title="Assign a teacher across a curriculum"
        description="Links the teacher to every subject on the class's curriculum they are qualified for. Existing assignments for those subjects are replaced."
      >
        <PanelRegion className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label
                htmlFor="assign-class"
                className="mb-1.5 block text-sm font-medium text-content"
              >
                Class
              </label>
              <select
                id="assign-class"
                className={`${controlClass} w-full cursor-pointer`}
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setNotice(null);
                }}
              >
                <option value="">Choose a class</option>
                {sortedClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[12rem] flex-1">
              <label
                htmlFor="assign-teacher"
                className="mb-1.5 block text-sm font-medium text-content"
              >
                Teacher
              </label>
              <select
                id="assign-teacher"
                className={`${controlClass} w-full cursor-pointer`}
                value={selectedTeacherId}
                onChange={(e) => {
                  setSelectedTeacherId(e.target.value);
                  setNotice(null);
                }}
              >
                <option value="">Choose a teacher</option>
                {sortedTeachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleAssign} disabled={!selectedClassId || !selectedTeacherId}>
              Assign to Class
            </Button>
            {/* Unassigning is a different operation, not a teacher you can pick.
                It used to hide inside the teacher dropdown as "⚠️ Unassign All". */}
            <button
              type="button"
              onClick={handleClearTeachers}
              disabled={!selectedClassId}
              className={quietButtonClass}
            >
              Clear all teachers
            </button>
          </div>

          {notice && (
            <div
              role="status"
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${
                notice.tone === "done"
                  ? "border-edge bg-surface-muted text-content-secondary"
                  : "border-l-2 border-edge border-l-accent bg-surface text-content-secondary"
              }`}
            >
              <span className="flex-1">{notice.text}</span>
              <button
                type="button"
                onClick={() => setNotice(null)}
                aria-label="Dismiss message"
                className="shrink-0 rounded text-content-muted transition-colors hover:text-content
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          )}
        </PanelRegion>
      </Panel>

      <Panel
        title="Who teaches what"
        description="Every staffed subject on each class's curriculum, with its weekly period count."
        action={
          <span className="text-xs tabular-nums text-content-muted">
            {data.classes.length} classes
          </span>
        }
      >
        <PanelRegion className="divide-y divide-edge-subtle">
          {sortedClasses.map((cls) => {
            const assignments = cls.curriculum
              .filter((c) => c.assignedTeacherId && c.periodsPerWeek > 0)
              .map((c) => ({
                teacher: data.teachers.find((t) => t.id === c.assignedTeacherId),
                subject: data.subjects.find((s) => s.id === c.subjectId),
                periods: c.periodsPerWeek,
              }))
              .filter((x) => x.teacher && x.subject)
              .sort((a, b) => (a.subject?.name || "").localeCompare(b.subject?.name || ""));

            const unstaffed = cls.curriculum.filter(
              (c) => c.periodsPerWeek > 0 && !c.assignedTeacherId,
            ).length;

            return (
              <div
                key={cls.id}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-start sm:gap-6"
              >
                <div className="flex w-full shrink-0 items-baseline justify-between gap-2 sm:w-40 sm:justify-start">
                  <span className="truncate text-sm font-medium text-content">{cls.name}</span>
                  <span className="ml-auto shrink-0 text-2xs tabular-nums text-content-muted">
                    {assignments.length}
                  </span>
                </div>

                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                  {assignments.map((item, idx) => (
                    <span
                      key={idx}
                      title={`${item.teacher?.name} — ${item.subject?.name}, ${item.periods} periods per week`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-edge
                                 bg-surface-muted py-0.5 pl-1.5 pr-2 text-2xs text-content-secondary"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                        style={{ backgroundColor: item.subject?.color }}
                      />
                      <span className="truncate">
                        {item.subject?.name}
                        <span className="text-content-muted"> · {item.teacher?.name}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-content-muted">
                        {item.periods}
                      </span>
                    </span>
                  ))}
                  {unstaffed > 0 && (
                    <span className="text-2xs text-accent-ink">{unstaffed} without a teacher</span>
                  )}
                  {assignments.length === 0 && unstaffed === 0 && (
                    <span className="text-xs text-content-muted">
                      Nothing on the curriculum yet
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </PanelRegion>
      </Panel>
    </div>
  );
};
