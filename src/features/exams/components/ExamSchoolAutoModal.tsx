import React, { useState, useEffect } from "react";
import { AppData, ExamSession, Subject } from "../../../types";
import { Modal, Button, Input } from "../../../components/ui";
import {
  Plus,
  Minus,
  Check,
  Users,
  Shuffle,
  Link as LinkIcon,
} from "lucide-react";

// Import the Logic Engine
import { generateExams, ScheduleMode } from "../logic/examGeneratorAlgorithms";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  onSave: (sessions: ExamSession[]) => void;
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
}) => {
  // --- STATE ---
  const [selectedConfigs, setSelectedConfigs] = useState<
    Record<string, SubjectConfig>
  >({});
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [mode, setMode] = useState<ScheduleMode>("UNIFORM");

  // Auto-populate examinable subjects and classes
  useEffect(() => {
    if (isOpen) {
      const initialConfigs: Record<string, SubjectConfig> = {};
      data.subjects.forEach(s => {
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
      setSelectedClassIds(data.classes.map(c => c.id));
    }
  }, [isOpen, data.subjects, data.classes]);

  // Settings
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("09:00");
  const [maxPerDay, setMaxPerDay] = useState("2");
  const [gapMinutes, setGapMinutes] = useState("30");
  const [syncStreams, setSyncStreams] = useState(true); // Default to TRUE for Random mode

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
    setSelectedClassIds(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId) 
        : [...prev, classId]
    );
  };

  const updatePaper = (id: string, delta: number) => {
    setSelectedConfigs((prev) => ({
      ...prev,
      [id]: { ...prev[id], papers: Math.max(1, prev[id].papers + delta) },
    }));
  };

  const handleGenerate = () => {
    const sessions = generateExams(data, {
      subjects: Object.values(selectedConfigs),
      selectedClassIds,
      mode,
      startDate,
      startTime,
      maxPerDay: parseInt(maxPerDay),
      gapMinutes: parseInt(gapMinutes),
      syncStreams,
    });

    onSave(sessions);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Auto-Generate Timetable">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
        {/* 1. STRATEGY SELECTOR */}
        <div className="grid grid-cols-2 gap-4 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setMode("UNIFORM")}
            className={`flex flex-col items-center p-3 rounded-md transition-all ${
              mode === "UNIFORM"
                ? "bg-white text-amber-600 shadow-sm ring-1 ring-amber-200"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            <Users size={20} className="mb-2" />
            <span className="text-xs font-bold">Uniform (Cohorts)</span>
            <span className="text-[10px] opacity-70">
              All classes write together
            </span>
          </button>

          <button
            onClick={() => setMode("RANDOM")}
            className={`flex flex-col items-center p-3 rounded-md transition-all ${
              mode === "RANDOM"
                ? "bg-white text-amber-600 shadow-sm ring-1 ring-amber-200"
                : "text-slate-500 hover:bg-slate-200"
            }`}
          >
            <Shuffle size={20} className="mb-2" />
            <span className="text-xs font-bold">Random / Staggered</span>
            <span className="text-[10px] opacity-70">
              Optimized slot filling
            </span>
          </button>
        </div>

        {/* 2. DOUBLE STREAM OPTION (Only for Random) */}
        {mode === "RANDOM" && (
          <div
            onClick={() => setSyncStreams(!syncStreams)}
            className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
              syncStreams
                ? "bg-amber-50 border-amber-200"
                : "bg-white border-slate-200"
            }`}
          >
            <div
              className={`p-1.5 rounded-full ${
                syncStreams
                  ? "bg-amber-500 text-white"
                  : "bg-slate-200 text-slate-400"
              }`}
            >
              <LinkIcon size={14} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800">
                Sync Parallel Streams
              </p>
              <p className="text-xs text-slate-500">
                Ensure classes in the same level (e.g. 10A & 10B) always write
                the same exam at the same time.
              </p>
            </div>
            {syncStreams && <Check size={16} className="text-amber-600" />}
          </div>
        )}

        {/* 3. SETTINGS GRID */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
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
            <h4 className="text-xs font-bold text-slate-400 uppercase">
              Select Classes
            </h4>
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedClassIds(data.classes.map(c => c.id))}
                className="text-[10px] font-bold text-amber-600 hover:underline"
              >
                Select All
              </button>
              <span className="text-slate-300">|</span>
              <button 
                onClick={() => setSelectedClassIds([])}
                className="text-[10px] font-bold text-slate-400 hover:underline"
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
                    ? "bg-amber-50 border-amber-300 text-amber-700 shadow-sm"
                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* 5. SUBJECT SELECTION */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">
            Select Subjects
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {data.subjects.map((s) => {
              const config = selectedConfigs[s.id];
              return (
                <div
                  key={s.id}
                  className={`flex justify-between items-center p-2 rounded border ${
                    config
                      ? "bg-amber-50 border-amber-300"
                      : "bg-white border-slate-100"
                  }`}
                >
                  <button
                    onClick={() => toggleSubject(s)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        config
                          ? "bg-amber-500 border-amber-500"
                          : "border-slate-300"
                      }`}
                    >
                      {config && <Check size={10} className="text-white" />}
                    </div>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-sm text-slate-700">{s.name}</span>
                  </button>
                  {config && (
                    <div className="flex items-center border rounded bg-white h-7">
                      <button
                        onClick={() => updatePaper(s.id, -1)}
                        className="px-2 border-r hover:bg-slate-50"
                      >
                        <Minus size={10} />
                      </button>
                      <span className="px-2 text-xs font-mono">
                        {config.papers} Papers
                      </span>
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
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
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
