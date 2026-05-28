import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Lock } from "lucide-react";
import { AppData, ViewState, Conflict } from "../../types";
import { ScheduleGrid } from "./components/ScheduleGrid";
import { ConflictPanel } from "./components/ConflictPanel";
import { SolverProgressOverlay, SolverLiveProgress } from "./components/SolverProgressOverlay";
import { GeneratorToolbar, GeneratorStats } from "./components/GeneratorToolbar";
import { exportScheduleToExcel } from "../../services/export/excel";
import { printAllSchedules } from "../../services/export/print";
import { useToast } from "../../components/ui/Toast";
import { auditFinalSchedule, runPreflightCheck } from "./scheduler/validation";
import { SOLVER_TARGET_MS } from "./scheduler/constants";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: ViewState) => void;
}

export const GeneratorView: React.FC<ViewProps> = ({ data, onUpdate, onNavigate }) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<"CLASS" | "TEACHER">("CLASS");
  const [activeId, setActiveId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isManualPlacementMode, setIsManualPlacementMode] = useState(false);
  const [hoverConflict, setHoverConflict] = useState<Conflict | null>(null);
  const [highlightedConflict, setHighlightedConflict] = useState<Conflict | null>(null);
  const [stats, setStats] = useState<GeneratorStats | null>(null);
  const [liveProgress, setLiveProgress] = useState<SolverLiveProgress | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const generationStartRef = useRef<number | null>(null);
  const generationBaseDataRef = useRef<AppData | null>(null);
  const lastPerfectScheduleRef = useRef<AppData["schedule"] | null>(null);
  const generationSessionRef = useRef(0);

  // Auto-hide conflict message after 6 seconds
  useEffect(() => {
    if (hoverConflict) {
      const timer = setTimeout(() => {
        setHoverConflict(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [hoverConflict]);

  // Clear highlighted conflict after 3 seconds
  useEffect(() => {
    if (highlightedConflict) {
      // Switch view to the relevant class/teacher
      if (mode === "CLASS" && highlightedConflict.classId !== activeId) {
        setActiveId(highlightedConflict.classId);
      } else if (
        mode === "TEACHER" &&
        highlightedConflict.teacherId &&
        highlightedConflict.teacherId !== activeId
      ) {
        setActiveId(highlightedConflict.teacherId);
      }

      const timer = setTimeout(() => {
        setHighlightedConflict(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedConflict, mode, activeId]);

  useEffect(() => {
    if (!isEditMode) {
      setIsManualPlacementMode(false);
    }
  }, [isEditMode]);

  // WORKER REF
  // We keep a reference to the active worker so we can terminate it if needed
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!isGenerating || generationStartRef.current === null) {
      return;
    }

    const tick = () => {
      setElapsedMs(Date.now() - generationStartRef.current!);
    };

    tick();
    const interval = window.setInterval(tick, 200);
    return () => window.clearInterval(interval);
  }, [isGenerating]);

  const applyGeneratedSchedule = useCallback(
    (baseData: AppData, schedule: AppData["schedule"], toastMessage?: string) => {
      const settledData: AppData = {
        ...baseData,
        schedule,
        conflicts: [],
        lastGenerated: new Date().toISOString(),
      };
      const auditedConflicts = auditFinalSchedule(settledData, {
        mode: "generated",
      });
      onUpdate({ ...settledData, conflicts: auditedConflicts });
      if (toastMessage) {
        showToast(toastMessage, "success");
      }
    },
    [onUpdate, showToast],
  );

  const terminateWorker = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    generationStartRef.current = null;
    generationBaseDataRef.current = null;
    lastPerfectScheduleRef.current = null;
    setLiveProgress(null);
    setElapsedMs(0);
    setIsGenerating(false);
  }, []);

  // --- SORTING HELPERS ---
  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  }, [data.classes]);

  const sortedTeachers = useMemo(() => {
    return [...data.teachers].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.teachers]);

  // Initial Selection Logic
  useEffect(() => {
    if (mode === "CLASS") {
      if (!sortedClasses.some((c) => c.id === activeId) && sortedClasses.length > 0) {
        setActiveId(sortedClasses[0].id);
      }
    } else {
      if (!sortedTeachers.some((t) => t.id === activeId) && sortedTeachers.length > 0) {
        setActiveId(sortedTeachers[0].id);
      }
    }
  }, [mode, sortedClasses, sortedTeachers, activeId]);

  // --- WORKER CLEANUP ---
  useEffect(() => {
    return () => {
      // If the user leaves the page while generating, kill the worker
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // --- SOLVER LOGIC (ASYNC WORKER) ---
  const handleGenerate = () => {
    const preflight = runPreflightCheck(data);
    if (!preflight.ok) {
      showToast(preflight.errors[0]?.message || "Cannot generate timetable.", "error");
      return;
    }
    if (preflight.warnings.length > 0) {
      showToast(preflight.warnings[0].message, "info");
    }

    // 0. Deep Clean up existing timetable
    const clearedData = {
      ...data,
      schedule: {},
      conflicts: [],
      lastGenerated: null,
    };

    // Update parent state immediately so UI shows "Empty" during generation
    onUpdate(clearedData);

    generationBaseDataRef.current = clearedData;
    lastPerfectScheduleRef.current = null;
    const sessionId = ++generationSessionRef.current;
    setIsGenerating(true);
    setStats(null);
    setLiveProgress(null);
    generationStartRef.current = Date.now();
    setElapsedMs(0);

    // 1. Initialize Worker
    workerRef.current = new Worker(new URL("./scheduler/core/worker.ts", import.meta.url), {
      type: "module",
    });

    // 2. Send Cleared Data (ensures no legacy burn-in)
    workerRef.current.postMessage(clearedData);

    // 3. Listen for Results
    workerRef.current.onmessage = (e) => {
      if (generationSessionRef.current !== sessionId) {
        return;
      }

      const { type, payload } = e.data;

      if (type === "progress") {
        if (payload.schedule) {
          lastPerfectScheduleRef.current = payload.schedule;
        }
        setLiveProgress({
          phase: payload.phase,
          iteration: payload.iteration,
          total: payload.total,
          conflicts: payload.conflicts,
          runIndex: payload.runIndex ?? 1,
          bestUnplaced: payload.bestUnplaced,
          perfectRuns: payload.perfectRuns ?? 0,
          elapsedMs: payload.elapsedMs ?? 0,
          timeBudgetMs: payload.timeBudgetMs ?? SOLVER_TARGET_MS,
        });
      } else if (type === "success") {
        setStats({
          iterations: payload.iterations,
          duration: payload.duration,
          runIndex: payload.runIndex ?? 1,
          totalRuns: payload.totalRuns ?? 1,
          unplaced: payload.unplaced ?? 0,
          perfectRuns: payload.perfectRuns ?? 0,
        });

        const baseData = generationBaseDataRef.current ?? clearedData;
        applyGeneratedSchedule(baseData, payload.schedule);
        terminateWorker();
      } else if (type === "error") {
        console.error("Worker error:", payload.message);
        if (payload.stack) {
          console.error("Worker stack trace:", payload.stack);
        }
        terminateWorker();
        showToast("An error occurred during generation.", "error");
      }
    };

    workerRef.current.onerror = (e) => {
      console.error("Worker connection error:", e);
      terminateWorker();
    };
  };

  const handleStop = () => {
    const baseData = generationBaseDataRef.current;
    const perfectSchedule = lastPerfectScheduleRef.current;
    const elapsed =
      generationStartRef.current !== null ? Date.now() - generationStartRef.current : 0;
    const progressSnapshot = liveProgress;

    // Invalidate session and tear down worker/UI immediately (stops timer + overlay).
    generationSessionRef.current++;
    terminateWorker();

    if (baseData && perfectSchedule) {
      setStats({
        iterations: progressSnapshot?.iteration ?? 0,
        duration: elapsed,
        runIndex: progressSnapshot?.runIndex ?? 1,
        totalRuns: progressSnapshot?.runIndex ?? 1,
        unplaced: 0,
        perfectRuns: progressSnapshot?.perfectRuns ?? 1,
      });
      applyGeneratedSchedule(baseData, perfectSchedule, "Perfect timetable applied.");
    } else {
      showToast("Stopped — no perfect timetable was saved yet.", "info");
    }
  };

  const handleExcelExport = async () => {
    try {
      // One .xlsx file: every class or every teacher as its own sheet tab
      await exportScheduleToExcel(data, mode);
    } catch (err) {
      console.error("Excel export failed:", err);
      showToast("Excel export failed. Check the console for details.", "error");
    }
  };

  const handlePrint = () => {
    printAllSchedules(data, mode);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-6">
      <GeneratorToolbar
        data={data}
        mode={mode}
        isGenerating={isGenerating}
        isEditMode={isEditMode}
        isManualPlacementMode={isManualPlacementMode}
        stats={stats}
        onNavigate={onNavigate}
        onModeChange={setMode}
        onToggleEditMode={() => setIsEditMode(!isEditMode)}
        onToggleManualPlacement={() => setIsManualPlacementMode(!isManualPlacementMode)}
        onGenerate={handleGenerate}
        onStop={handleStop}
        onExcelExport={handleExcelExport}
        onPrint={handlePrint}
      />

      {/* --- MAIN INTERACTIVE GRID --- */}
      <div className="flex flex-1 overflow-hidden gap-4">
        <div
          className={`flex flex-1 overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm relative transition-opacity ${
            isGenerating ? "opacity-60 pointer-events-none" : ""
          }`}
        >
          {isGenerating && <SolverProgressOverlay progress={liveProgress} elapsedMs={elapsedMs} />}

          {/* Sidebar */}
          <div className="w-44 border-r border-slate-200 bg-slate-50 overflow-y-auto shrink-0">
            <div className="p-4 border-b border-slate-100 sticky top-0 bg-slate-50 z-10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Select {mode === "CLASS" ? "Group" : "Teacher"}
              </span>
            </div>
            {mode === "CLASS"
              ? sortedClasses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 text-xs font-medium truncate flex items-center gap-3 ${
                      activeId === c.id
                        ? "bg-white border-l-4 border-l-amber-500"
                        : "text-slate-500"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activeId === c.id ? "bg-amber-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))
              : sortedTeachers.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveId(t.id)}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 text-xs font-medium truncate flex items-center gap-3 ${
                      activeId === t.id
                        ? "bg-white border-l-4 border-l-amber-500"
                        : "text-slate-500"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        activeId === t.id ? "bg-amber-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
          </div>

          {/* Grid Area */}
          <div className="flex-1 overflow-auto p-6 bg-slate-50/30 custom-scrollbar">
            <ScheduleGrid
              data={data}
              activeId={activeId}
              mode={mode}
              onUpdate={onUpdate}
              editMode={isEditMode}
              manualPlacementMode={isManualPlacementMode}
              setHoverConflict={setHoverConflict}
              highlightedConflict={highlightedConflict}
            />
          </div>
        </div>

        {/* Conflict Panel */}
        {(hoverConflict ||
          (!isGenerating && (data.lastGenerated || data.conflicts.length > 0))) && (
          <div>
            {/* LIVE VALIDATION ERROR */}
            {hoverConflict && (
              <div
                className="w-64 mb-4 border border-red-200 bg-red-50 rounded-xl shadow-sm p-4 animate-pulse cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => setHighlightedConflict(hoverConflict)}
              >
                <h4 className="font-bold text-red-800 mb-1 text-sm flex items-center gap-2">
                  <Lock size={14} /> Invalid Move
                </h4>
                <p className="text-xs text-red-600 font-medium leading-relaxed">
                  {hoverConflict.reason}
                </p>
                <div className="mt-2 pt-2 border-t border-red-100 flex flex-col gap-1">
                  <span className="text-[10px] text-red-400">
                    Target: {hoverConflict.className || "Unknown"}
                  </span>
                </div>
              </div>
            )}

            {!isGenerating && (data.lastGenerated || data.conflicts.length > 0) && (
              <ConflictPanel
                conflicts={data.conflicts}
                selectedConflict={highlightedConflict}
                onConflictSelect={setHighlightedConflict}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};
