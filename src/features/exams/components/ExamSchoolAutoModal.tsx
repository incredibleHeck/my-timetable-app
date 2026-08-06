import React, { useState, useEffect } from "react";
import { AppData, ExamSession, Subject } from "../../../types";
import { Modal, Button, controlClass } from "../../../components/ui";
import { Check, Minus, Plus } from "lucide-react";
import { generateExams, ScheduleMode } from "../logic/examGeneratorAlgorithms";
import { useToast } from "../../../components/ui/Toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onSave: (sessions: ExamSession[]) => void;
  onSessionsPerDayChange?: (sessionsPerDay: number) => void;
}

interface SubjectConfig {
  id: string;
  papers: number;
  duration: number;
}

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({
  id,
  label,
  children,
}) => (
  <div className="min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-content">
      {label}
    </label>
    {children}
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode; action?: React.ReactNode }> = ({
  children,
  action,
}) => (
  <div className="mb-2 flex items-center justify-between">
    <h4 className="text-sm font-medium text-content">{children}</h4>
    {action}
  </div>
);

export const ExamSchoolAutoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onSave,
  onSessionsPerDayChange,
}) => {
  const { showToast } = useToast();
  const [selectedConfigs, setSelectedConfigs] = useState<Record<string, SubjectConfig>>({});
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ScheduleMode>("UNIFORM");

  useEffect(() => {
    if (isOpen) {
      const initialConfigs: Record<string, SubjectConfig> = {};
      data.subjects.forEach((s) => {
        if (s.isExaminable !== false) {
          initialConfigs[s.id] = { id: s.id, papers: s.examPaperCount || 1, duration: 120 };
        }
      });
      setSelectedConfigs(initialConfigs);
      setSelectedClassIds(data.classes.map((c) => c.id));
    }
  }, [isOpen, data.subjects, data.classes]);

  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [maxPerDay, setMaxPerDay] = useState("2");
  const [gapMinutes, setGapMinutes] = useState("30");
  const [syncStreams, setSyncStreams] = useState(true);
  const [deterministic, setDeterministic] = useState(false);
  const [sessionsPerDay, setSessionsPerDay] = useState(
    () => data.settings.examGrid?.sessionsPerDay ?? 2,
  );

  useEffect(() => {
    if (isOpen) setSessionsPerDay(data.settings.examGrid?.sessionsPerDay ?? 2);
  }, [isOpen, data.settings.examGrid?.sessionsPerDay]);

  const toggleSubject = (subject: Subject) => {
    setSelectedConfigs((prev) => {
      if (prev[subject.id]) {
        const copy = { ...prev };
        delete copy[subject.id];
        return copy;
      }
      return {
        ...prev,
        [subject.id]: { id: subject.id, papers: subject.examPaperCount || 1, duration: 120 },
      };
    });
  };

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };

  const updatePaper = (id: string, delta: number) => {
    setSelectedConfigs((prev) => ({
      ...prev,
      [id]: { ...prev[id], papers: Math.max(1, prev[id].papers + delta) },
    }));
  };

  const handleGenerate = () => {
    const { sessions, unscheduled } = generateExams(data, {
      subjects: Object.values(selectedConfigs),
      selectedClassIds,
      mode,
      startDate,
      startTime,
      maxPerDay: parseInt(maxPerDay),
      gapMinutes: parseInt(gapMinutes),
      syncStreams,
      deterministic,
      sessionsPerDay,
    });

    onSessionsPerDayChange?.(sessionsPerDay);

    if (unscheduled.length > 0) {
      const names = unscheduled
        .map((u) => {
          const sub = data.subjects.find((s) => s.id === u.subjectId);
          return `${sub?.name || "Subject"} Paper ${u.paperNumber}`;
        })
        .slice(0, 5)
        .join(", ");
      const more = unscheduled.length > 5 ? ` (+${unscheduled.length - 5} more)` : "";
      showToast(
        `${unscheduled.length} exam unit(s) could not be scheduled within 60 days: ${names}${more}.`,
        "error",
      );
    }

    onSave(sessions);
    onClose();
  };

  const modeButton = (id: ScheduleMode, title: string, hint: string) => {
    const isActive = mode === id;
    return (
      <button
        type="button"
        onClick={() => setMode(id)}
        aria-pressed={isActive}
        className={`flex-1 rounded-md border px-3 py-2.5 text-left transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                      isActive
                        ? "border-accent bg-accent/15"
                        : "border-edge bg-surface hover:border-edge-strong"
                    }`}
      >
        <div className="text-sm font-medium text-content">{title}</div>
        <div className="mt-0.5 text-2xs text-content-muted">{hint}</div>
      </button>
    );
  };

  const toggleRow = (checked: boolean, onToggle: () => void, title: string, hint: string) => (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-edge bg-surface px-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 rounded border-edge-strong text-accent focus:ring-accent"
      />
      <span>
        <span className="block text-sm text-content">{title}</span>
        <span className="block text-xs leading-relaxed text-content-muted">{hint}</span>
      </span>
    </label>
  );

  const canGenerate = Object.keys(selectedConfigs).length > 0 && selectedClassIds.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Auto-Generate Timetable"
      maxWidth="max-w-3xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate}>
            Generate Schedule
          </Button>
        </div>
      }
    >
      <div className="custom-scrollbar max-h-[75vh] space-y-5 overflow-y-auto pr-1">
        <div>
          <SectionTitle>Strategy</SectionTitle>
          <div className="flex gap-2">
            {modeButton("UNIFORM", "Uniform (Cohorts)", "All classes write together")}
            {modeButton("RANDOM", "Random / Staggered", "Fill sessions to spread exams out")}
          </div>
        </div>

        <div className="space-y-2">
          {mode === "RANDOM" &&
            toggleRow(
              syncStreams,
              () => setSyncStreams(!syncStreams),
              "Keep parallel streams together",
              "Classes in the same level (e.g. 10A and 10B) always sit the same paper at the same time.",
            )}
          {toggleRow(
            deterministic,
            () => setDeterministic(!deterministic),
            "Fixed generation order",
            "The same inputs produce the same timetable every run.",
          )}
        </div>

        <div>
          <SectionTitle>Sessions per day</SectionTitle>
          <p className="mb-2 text-xs text-content-muted">
            How many session columns the grid uses. Exams land in the matching column.
          </p>
          <div
            role="group"
            aria-label="Sessions per day"
            className="inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
          >
            {[1, 2].map((n) => {
              const isActive = sessionsPerDay === n;
              return (
                <button
                  key={n}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setSessionsPerDay(n);
                    if (parseInt(maxPerDay, 10) < n) setMaxPerDay(String(n));
                  }}
                  className={`h-8 rounded px-3 text-sm transition-colors focus-visible:outline-none
                              focus-visible:ring-2 focus-visible:ring-accent ${
                                isActive
                                  ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                  : "text-content-muted hover:text-content"
                              }`}
                >
                  {n} session{n > 1 ? "s" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field id="gen-start-date" label="Start date">
            <input
              id="gen-start-date"
              type="date"
              className={`${controlClass} w-full`}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field id="gen-start-time" label="Start time">
            <input
              id="gen-start-time"
              type="time"
              className={`${controlClass} w-full`}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field id="gen-max-day" label="Max exams/day">
            <input
              id="gen-max-day"
              type="number"
              className={`${controlClass} w-full`}
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value)}
            />
          </Field>
          <Field id="gen-gap" label="Gap (min)">
            <input
              id="gen-gap"
              type="number"
              className={`${controlClass} w-full`}
              value={gapMinutes}
              onChange={(e) => setGapMinutes(e.target.value)}
            />
          </Field>
        </div>

        <div>
          <SectionTitle
            action={
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedClassIds(data.classes.map((c) => c.id))}
                  className="text-accent-ink underline-offset-4 hover:underline"
                >
                  Select All
                </button>
                <span className="text-edge-strong">·</span>
                <button
                  type="button"
                  onClick={() => setSelectedClassIds([])}
                  className="text-content-muted underline-offset-4 hover:underline"
                >
                  Clear
                </button>
              </div>
            }
          >
            Classes
          </SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {data.classes.map((c) => {
              const isOn = selectedClassIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => toggleClass(c.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    isOn
                      ? "border-accent bg-accent/15 font-medium text-content"
                      : "border-edge text-content-secondary hover:border-edge-strong"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
            {data.classes.length === 0 && (
              <span className="text-xs text-content-muted">No classes defined.</span>
            )}
          </div>
        </div>

        <div>
          <SectionTitle>Subjects</SectionTitle>
          <ul className="space-y-1.5">
            {data.subjects.map((s) => {
              const config = selectedConfigs[s.id];
              return (
                <li
                  key={s.id}
                  className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 ${
                    config ? "border-edge bg-surface" : "border-edge-subtle bg-canvas"
                  }`}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(config)}
                      onChange={() => toggleSubject(s)}
                      className="h-4 w-4 rounded border-edge-strong text-accent focus:ring-accent"
                    />
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate text-sm text-content">{s.name}</span>
                  </label>
                  {config && (
                    <div className="inline-flex h-7 shrink-0 items-center overflow-hidden rounded border border-edge bg-surface">
                      <button
                        type="button"
                        onClick={() => updatePaper(s.id, -1)}
                        disabled={config.papers <= 1}
                        aria-label={`One fewer paper of ${s.name}`}
                        className="grid h-full w-7 place-items-center text-content-muted hover:bg-surface-inset hover:text-content disabled:opacity-40"
                      >
                        <Minus size={11} aria-hidden />
                      </button>
                      <span className="w-16 border-x border-edge text-center text-2xs tabular-nums text-content">
                        {config.papers} {config.papers === 1 ? "paper" : "papers"}
                      </span>
                      <button
                        type="button"
                        onClick={() => updatePaper(s.id, 1)}
                        aria-label={`One more paper of ${s.name}`}
                        className="grid h-full w-7 place-items-center text-content-muted hover:bg-surface-inset hover:text-content"
                      >
                        <Plus size={11} aria-hidden />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
            {data.subjects.length === 0 && (
              <li className="rounded-md border border-dashed border-edge px-3 py-6 text-center text-xs text-content-muted">
                No subjects defined yet.
              </li>
            )}
          </ul>
        </div>

        {canGenerate && (
          <p className="flex items-center gap-1.5 text-2xs text-content-muted">
            <Check size={12} className="text-success-ink" aria-hidden />
            {Object.keys(selectedConfigs).length} subjects across {selectedClassIds.length} classes.
          </p>
        )}
      </div>
    </Modal>
  );
};
