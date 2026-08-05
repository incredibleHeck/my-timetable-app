import React, { useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { AppData } from "../../../types";
import { CurriculumItem } from "../types";
import { controlClass } from "../../../components/ui";

interface ClassCurriculumSectionProps {
  data: AppData;
  cCurriculum: CurriculumItem[];
  setCCurriculum: (curr: CurriculumItem[] | ((prev: CurriculumItem[]) => CurriculumItem[])) => void;
}

interface CountStepperProps {
  label: string;
  hint: string;
  value: number;
  onChange: (val: number) => void;
}

const CountStepper: React.FC<CountStepperProps> = ({ label, hint, value, onChange }) => {
  const buttonClass =
    "grid h-7 w-6 place-items-center text-content-muted transition-colors hover:bg-surface-inset " +
    "hover:text-content disabled:pointer-events-none disabled:opacity-40";
  return (
    <div className="inline-flex items-center gap-1.5">
      <div className="inline-flex h-7 items-center overflow-hidden rounded border border-edge bg-surface">
        <button
          type="button"
          aria-label={`One fewer ${hint}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          className={buttonClass}
        >
          <Minus size={11} aria-hidden />
        </button>
        <span className="w-6 border-x border-edge text-center text-xs tabular-nums text-content">
          {value}
        </span>
        <button
          type="button"
          aria-label={`One more ${hint}`}
          onClick={() => onChange(value + 1)}
          className={buttonClass}
        >
          <Plus size={11} aria-hidden />
        </button>
      </div>
      <span className="text-2xs text-content-muted">{label}</span>
    </div>
  );
};

/**
 * Curriculum editor. Every subject in the library gets a row, so a school with
 * twenty subjects scrolled past fifteen empty ones to reach the taught few —
 * the filter and the "on the curriculum" toggle exist to skip that.
 */
export const ClassCurriculumSection: React.FC<ClassCurriculumSectionProps> = ({
  data,
  cCurriculum,
  setCCurriculum,
}) => {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const subjectById = new Map(data.subjects.map((s) => [s.id, s]));
  const activeCount = cCurriculum.filter((c) => c.periodsPerWeek > 0).length;
  const totalPeriods = cCurriculum.reduce((sum, c) => sum + c.periodsPerWeek, 0);

  const visible = cCurriculum.filter((item) => {
    const subject = subjectById.get(item.subjectId);
    if (!subject) return false;
    if (!showAll && item.periodsPerWeek === 0) return false;
    if (query && !subject.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const updateItem = (
    subjectId: string,
    field: keyof CurriculumItem,
    value: string | number | boolean | null | undefined,
  ) => {
    setCCurriculum((prev) =>
      prev.map((p) =>
        p.subjectId === subjectId
          ? {
              ...p,
              [field]: value,
              periodsPerWeek:
                field === "doubles"
                  ? (value as number) * 2 + p.singles
                  : field === "singles"
                    ? p.doubles * 2 + (value as number)
                    : p.periodsPerWeek,
            }
          : p,
      ),
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-medium text-content">Curriculum</h4>
          <p className="mt-0.5 text-2xs text-content-muted">
            <span className="tabular-nums">{activeCount}</span> subjects ·{" "}
            <span className="tabular-nums">{totalPeriods}</span> periods per week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-content-muted"
            />
            <input
              aria-label="Filter subjects"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter"
              className={`${controlClass} h-8 w-32 pl-7`}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-2xs text-content-muted">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-edge-strong text-accent focus:ring-accent"
            />
            Show all subjects
          </label>
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {visible.map((item) => {
          const subject = subjectById.get(item.subjectId)!;
          const eligibleTeachers = data.teachers.filter((t) => t.specialtyIds.includes(subject.id));
          const isActive = item.periodsPerWeek > 0;

          return (
            <div
              key={item.subjectId}
              className={`rounded-md border p-2.5 ${
                isActive ? "border-edge bg-surface" : "border-edge-subtle bg-canvas"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="truncate text-sm font-medium text-content">{subject.name}</span>
                </div>
                <span className="shrink-0 text-2xs tabular-nums text-content-muted">
                  {item.periodsPerWeek}/wk
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <CountStepper
                  label="doubles"
                  hint={`double period of ${subject.name}`}
                  value={item.doubles}
                  onChange={(v) => updateItem(item.subjectId, "doubles", v)}
                />
                <CountStepper
                  label="singles"
                  hint={`single period of ${subject.name}`}
                  value={item.singles}
                  onChange={(v) => updateItem(item.subjectId, "singles", v)}
                />
              </div>

              {isActive && (
                <div className="mt-2 flex items-center gap-2 border-t border-edge-subtle pt-2">
                  <select
                    aria-label={`Teacher for ${subject.name}`}
                    value={item.assignedTeacherId || ""}
                    onChange={(e) =>
                      updateItem(item.subjectId, "assignedTeacherId", e.target.value || null)
                    }
                    className={`${controlClass} h-8 min-w-0 flex-1 cursor-pointer text-xs`}
                  >
                    <option value="">No teacher assigned</option>
                    {eligibleTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {/* Was a lightning-bolt icon button; nothing on screen said what
                      it did or whether it was on. */}
                  <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-2xs text-content-muted">
                    <input
                      type="checkbox"
                      checked={Boolean(item.isWorkloadExempt)}
                      onChange={(e) =>
                        updateItem(item.subjectId, "isWorkloadExempt", e.target.checked)
                      }
                      className="h-3.5 w-3.5 rounded border-edge-strong text-accent focus:ring-accent"
                    />
                    <span title="Excluded from the teacher's weekly workload percentage">
                      Off workload
                    </span>
                  </label>
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <p className="rounded-md border border-dashed border-edge px-4 py-8 text-center text-xs text-content-muted">
            {query
              ? "No subject matches that filter."
              : "Nothing on the curriculum yet — tick “Show all subjects” to add one."}
          </p>
        )}
      </div>
    </div>
  );
};
