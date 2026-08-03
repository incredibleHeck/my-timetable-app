import React, { useState, useEffect } from "react";
import { AppData, ExamSession, Subject } from "../../../types";
import { Modal, Button, Input } from "../../../components/ui";
import { Plus, Minus, Check, Users, Shuffle, Link as LinkIcon } from "lucide-react";

// Import the Logic Engine
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

export const ExamSchoolAutoModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  onSave,
  onSessionsPerDayChange,
}) => {
  const { showToast } = useToast();
  // --- STATE ---
  const [selectedConfigs, setSelectedConfigs] = useState<Record<string, SubjectConfig>>({});
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ScheduleMode>("UNIFORM");

  // Auto-populate examinable subjects and classes
  useEffect(() => {
    if (isOpen) {
      const initialConfigs: Record<string, SubjectConfig> = {};
      data.subjects.forEach((s) => {
        // Default to examinable if not explicitly false
        if (s.isExaminable !== false) {
          initialConfigs[s.id] = {
            id: s.id,
            papers: s.examPaperCount || 1,
            duration: 120,
          };
        }
      });
      setSelectedConfigs(initialConfigs);
      // Default to all classes selected
      setSelectedClassIds(data.classes.map((c) => c.id));
    }
  }, [isOpen, data.subjects, data.classes]);

  // Settings
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
    if (isOpen) {
      setSessionsPerDay(data.settings.examGrid?.sessionsPerDay ?? 2);
    }
  }, [isOpen, data.settings.examGrid?.sessionsPerDay]);

  // --- HANDLERS ---
  const toggleSubject = (subject: Subject) => {
    setSelectedConfigs((prev) => {
      if (prev[subject.id]) {
        const copy = { ...prev };
        delete copy[subject.id];
        return copy;
      }
      return {
        ...prev,
        [subject.id]: {
          id: subject.id,
          papers: subject.examPaperCount || 1,
          duration: 120,
        },
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
        `Warning: ${unscheduled.length} exam unit(s) could not be scheduled within 60 days: ${names}${more}.`,
        "error",
      );
    }

    onSave(sessions);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Auto-Generate Timetable"
      aria-label="Auto-Generate Timetable"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
        {/* 1. STRATEGY SELECTOR */}
        <div className="grid grid-cols-2 gap-4 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <button
            onClick={() => setMode("UNIFORM")}
            className={`flex flex-col items-center p-3 rounded-md transition-all ${
              mode === "UNIFORM"
                ? "bg-white dark:bg-slate-800 text-accent-ink shadow-sm ring-1 ring-amber-200"
                : "text-content-muted hover:bg-slate-200"
            }`}
          >
            <Users size={20} className="mb-2" />
            <span className="text-xs font-bold">Uniform (Cohorts)</span>
            <span className="text-2xs opacity-70">All classes write together</span>
          </button>

          <button
            onClick={() => setMode("RANDOM")}
            className={`flex flex-col items-center p-3 rounded-md transition-all ${
              mode === "RANDOM"
                ? "bg-white dark:bg-slate-800 text-accent-ink shadow-sm ring-1 ring-amber-200"
                : "text-content-muted hover:bg-slate-200"
            }`}
          >
            <Shuffle size={20} className="mb-2" />
            <span className="text-xs font-bold">Random / Staggered</span>
            <span className="text-2xs opacity-70">Optimized slot filling</span>
          </button>
        </div>

        {/* 2. DOUBLE STREAM OPTION (Only for Random) */}
        {mode === "RANDOM" && (
          <div
            onClick={() => setSyncStreams(!syncStreams)}
            className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
              syncStreams
                ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
          >
            <div
              className={`p-1.5 rounded-full ${
                syncStreams
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-content-muted"
              }`}
            >
              <LinkIcon size={14} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Sync Parallel Streams
              </p>
              <p className="text-xs text-content-muted">
                Ensure classes in the same level (e.g. 10A & 10B) always write the same exam at the
                same time.
              </p>
            </div>
            {syncStreams && <Check size={16} className="text-accent-ink" />}
          </div>
        )}

        <div
          onClick={() => setDeterministic(!deterministic)}
          className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
            deterministic
              ? "bg-amber-50 dark:bg-amber-900/30 border-amber-200"
              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          }`}
        >
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Fixed generation order
            </p>
            <p className="text-xs text-content-muted">
              Use a deterministic shuffle so the same inputs produce the same timetable.
            </p>
          </div>
          {deterministic && <Check size={16} className="text-accent-ink" />}
        </div>

        {/* Sessions per day (grid columns) */}
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
          <h4 className="text-xs font-bold text-content-muted uppercase mb-3">
            Exam sessions per day
          </h4>
          <p className="text-xs text-content-muted mb-3">
            Choose how many session columns the timetable uses. Exams are placed into the matching
            session column (Session 1 or Session 2).
          </p>
          <div className="flex gap-2">
            {[1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setSessionsPerDay(n);
                  if (parseInt(maxPerDay, 10) < n) {
                    setMaxPerDay(String(n));
                  }
                }}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition-all ${
                  sessionsPerDay === n
                    ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 text-amber-800 dark:text-amber-200 shadow-sm"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-content-muted hover:border-slate-300"
                }`}
              >
                {n} session{n > 1 ? "s" : ""}
              </button>
            ))}
          </div>
        </div>

        {/* 3. SETTINGS GRID */}
        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="Start Time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max Exams/Day"
              type="number"
              value={maxPerDay}
              onChange={(e) => setMaxPerDay(e.target.value)}
            />
            <Input
              label="Gap (Mins)"
              type="number"
              value={gapMinutes}
              onChange={(e) => setGapMinutes(e.target.value)}
            />
          </div>
        </div>

        {/* 4. CLASS SELECTION */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-bold text-content-muted uppercase">Select Classes</h4>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedClassIds(data.classes.map((c) => c.id))}
                className="text-2xs font-bold text-accent-ink hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={() => setSelectedClassIds([])}
                className="text-2xs font-bold text-content-muted hover:underline"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {data.classes.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleClass(c.id)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold border transition-all ${
                  selectedClassIds.includes(c.id)
                    ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300 text-amber-800 dark:text-amber-200 shadow-sm"
                    : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-content-muted hover:border-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 5. SUBJECT SELECTION */}
        <div>
          <h4 className="text-xs font-bold text-content-muted uppercase mb-2">Select Subjects</h4>
          <div className="grid grid-cols-1 gap-2">
            {data.subjects.map((s) => {
              const config = selectedConfigs[s.id];
              return (
                <div
                  key={s.id}
                  className={`flex justify-between items-center p-2 rounded border ${
                    config
                      ? "bg-amber-50 dark:bg-amber-900/30 border-amber-300"
                      : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                  }`}
                >
                  <button
                    onClick={() => toggleSubject(s)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config ? "bg-amber-500 border-amber-500" : "border-slate-300"
                      }`}
                    >
                      {config && <Check size={10} className="text-white" />}
                    </div>
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{s.name}</span>
                  </button>
                  {config && (
                    <div className="flex items-center border rounded bg-white dark:bg-slate-800 h-7">
                      <button
                        onClick={() => updatePaper(s.id, -1)}
                        className="px-2 border-r hover:bg-slate-50"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="px-2 text-xs font-mono">{config.papers} Papers</span>
                      <button
                        onClick={() => updatePaper(s.id, 1)}
                        className="px-2 border-l hover:bg-slate-50"
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={Object.keys(selectedConfigs).length === 0 || selectedClassIds.length === 0}
            className="bg-amber-500 hover:bg-amber-600 text-white"
          >
            Generate Schedule
          </Button>
        </div>
      </div>
    </Modal>
  );
};
