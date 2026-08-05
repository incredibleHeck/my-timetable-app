import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Lock, ChevronLeft, ChevronRight, Play, Search } from "lucide-react";
import { AppData, ViewState, Conflict } from "../../types";
import { ScheduleGrid } from "./components/ScheduleGrid";
import { ConflictPanel } from "./components/ConflictPanel";
import { SolverProgressOverlay, SolverLiveProgress } from "./components/SolverProgressOverlay";
import { GeneratorToolbar, GeneratorStats } from "./components/GeneratorToolbar";
import { exportScheduleToExcel } from "../../services/export/excel";
import { printAllSchedules, PrintMode } from "../../services/export/print";
import { exportClassICal, exportTeacherICal } from "../../services/export/ical";
import { Button, controlClass } from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import { auditFinalSchedule, runPreflightCheck } from "./scheduler/validation";
import { SOLVER_TARGET_MS } from "./scheduler/constants";
import { getSpecialistRooms, countRoomPeriods } from "./utils/roomSchedule";
import {
  applyTeacherReassignments,
  describeReassignments,
  TeacherReassignment,
} from "./utils/applyReassignments";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: ViewState) => void;
}

export const GeneratorView: React.FC<ViewProps> = ({ data, onUpdate, onNavigate }) => {
  const { showToast } = useToast();
  const [mode, setMode] = useState<"CLASS" | "TEACHER" | "ROOM">("CLASS");
  const [activeId, setActiveId] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoverConflict, setHoverConflict] = useState<Conflict | null>(null);
  const [highlightedConflict, setHighlightedConflict] = useState<Conflict | null>(null);
  const [stats, setStats] = useState<GeneratorStats | null>(null);
  const [liveProgress, setLiveProgress] = useState<SolverLiveProgress | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isConflictPanelOpen, setIsConflictPanelOpen] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [canRestore, setCanRestore] = useState(false);

  const generationStartRef = useRef<number | null>(null);
  const generationBaseDataRef = useRef<AppData | null>(null);
  const lastPerfectScheduleRef = useRef<AppData["schedule"] | null>(null);
  const generationSessionRef = useRef(0);
  const previousScheduleRef = useRef<AppData["schedule"] | null>(null);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide conflict message after 6 seconds
  useEffect(() => {
    if (hoverConflict) {
      const timer = setTimeout(() => {
        setHoverConflict(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [hoverConflict]);

  // Auto-hide conflict panel on successful generation
  useEffect(() => {
    if (!isGenerating && data.lastGenerated) {
      if (data.conflicts.length === 0) {
        setIsConflictPanelOpen(false);
      } else {
        setIsConflictPanelOpen(true);
      }
    }
  }, [isGenerating, data.lastGenerated, data.conflicts.length]);

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
    (
      baseData: AppData,
      schedule: AppData["schedule"],
      toastMessage?: string,
      reassignedTeachers?: TeacherReassignment[],
    ) => {
      // The optimiser may have handed a class's subject to a different qualified
      // teacher to even out workloads. The grid already says so; the curriculum
      // does not, and the Workload screen reads the curriculum. Write the change
      // through so the two cannot disagree about who teaches what.
      const { data: rebased, applied } = applyTeacherReassignments(baseData, reassignedTeachers);

      const settledData: AppData = {
        ...rebased,
        schedule,
        conflicts: [],
        lastGenerated: new Date().toISOString(),
      };
      const auditedConflicts = auditFinalSchedule(settledData, {
        mode: "generated",
      });
      onUpdate({ ...settledData, conflicts: auditedConflicts });

      if (applied.length > 0) {
        const lines = describeReassignments(settledData, applied);
        console.info(["Teacher reassignments applied:", ...lines].join("\n"));
        showToast(
          `${applied.length} subject${applied.length === 1 ? "" : "s"} moved to another qualified teacher to balance workloads.`,
          "info",
        );
      }

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

  // Filtered lists for sidebar
  const filteredClasses = useMemo(() => {
    if (!sidebarFilter.trim()) return sortedClasses;
    const q = sidebarFilter.toLowerCase();
    return sortedClasses.filter((c) => c.name.toLowerCase().includes(q));
  }, [sortedClasses, sidebarFilter]);

  const filteredTeachers = useMemo(() => {
    if (!sidebarFilter.trim()) return sortedTeachers;
    const q = sidebarFilter.toLowerCase();
    return sortedTeachers.filter((t) => t.name.toLowerCase().includes(q));
  }, [sortedTeachers, sidebarFilter]);

  /**
   * Rooms worth having a timetable for.
   *
   * A home classroom's schedule is its class's schedule under another name, so
   * shared facilities — the ICT lab, music room, arts studio, library — lead the
   * list; they are the ones with no other view showing who is in them and when.
   * Home rooms follow rather than disappear, so nothing becomes unreachable.
   */
  const sortedRooms = useMemo(() => {
    const specialistIds = new Set(getSpecialistRooms(data).map((r) => r.id));
    const byName = (a: { name: string }, b: { name: string }) =>
      a.name.localeCompare(b.name, undefined, { numeric: true });
    return [
      ...data.rooms.filter((r) => specialistIds.has(r.id)).sort(byName),
      ...data.rooms.filter((r) => !specialistIds.has(r.id)).sort(byName),
    ];
  }, [data]);

  const filteredRooms = useMemo(() => {
    if (!sidebarFilter.trim()) return sortedRooms;
    const q = sidebarFilter.toLowerCase();
    return sortedRooms.filter((r) => r.name.toLowerCase().includes(q));
  }, [sortedRooms, sidebarFilter]);

  // Initial Selection Logic
  useEffect(() => {
    if (mode === "CLASS") {
      if (!sortedClasses.some((c) => c.id === activeId) && sortedClasses.length > 0) {
        setActiveId(sortedClasses[0].id);
      }
    } else if (mode === "TEACHER") {
      if (!sortedTeachers.some((t) => t.id === activeId) && sortedTeachers.length > 0) {
        setActiveId(sortedTeachers[0].id);
      }
    } else {
      if (!sortedRooms.some((r) => r.id === activeId) && sortedRooms.length > 0) {
        setActiveId(sortedRooms[0].id);
      }
    }
    setSidebarFilter(""); // Clear filter on mode switch
  }, [mode, sortedClasses, sortedTeachers, sortedRooms, activeId]);

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

    // Save previous schedule snapshot for restore
    if (Object.keys(data.schedule).length > 0) {
      previousScheduleRef.current = data.schedule;
      if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    }

    // The solver starts from an empty grid, but only the worker sees that. The
    // view used to commit the cleared data first "so the UI shows Empty during
    // generation" — which destroyed the current timetable before knowing whether
    // a replacement existed. A worker error, or stopping before the first clean
    // result, then left nothing behind and no way back. The overlay covers the
    // grid anyway, so there is nothing to gain by emptying it.
    const clearedData = {
      ...data,
      schedule: {},
      conflicts: [],
      lastGenerated: null,
    };

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
        applyGeneratedSchedule(baseData, payload.schedule, undefined, payload.reassignedTeachers);
        terminateWorker();

        // Start 60-second restore window
        setCanRestore(true);
        if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = setTimeout(() => setCanRestore(false), 60_000);
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
      showToast("Background worker failed to initialize or execute.", "error");
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

  const handleRestore = () => {
    if (!previousScheduleRef.current) return;
    onUpdate({ ...data, schedule: previousScheduleRef.current });
    previousScheduleRef.current = null;
    setCanRestore(false);
    if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    showToast("Previous schedule restored.", "success");
  };

  const handleExcelExport = async () => {
    // The workbook builder lays out one sheet per class or per teacher; it has
    // no room layout yet. Say so rather than quietly exporting a different view
    // than the one on screen. Printing does cover rooms.
    if (mode === "ROOM") {
      showToast("Excel export covers classes and teachers. Use Print for room timetables.", "info");
      return;
    }
    try {
      // One .xlsx file: every class or every teacher as its own sheet tab
      await exportScheduleToExcel(data, mode);
    } catch (err) {
      console.error("Excel export failed:", err);
      showToast("Excel export failed. Check the console for details.", "error");
    }
  };

  const handlePrint = (target: PrintMode, entityId?: string) => {
    printAllSchedules(data, target, entityId);
  };

  const handleExportICal = async (target: "CLASS" | "TEACHER", entityId: string) => {
    try {
      if (target === "CLASS") {
        await exportClassICal(data, entityId);
      } else {
        await exportTeacherICal(data, entityId);
      }
    } catch (err) {
      console.error("iCal export failed:", err);
      showToast("Calendar export failed. Check the console for details.", "error");
    }
  };

  /** Classes, teachers and rooms rendered the same list markup three times over. */
  const entityList: { id: string; name: string; meta?: number }[] =
    mode === "CLASS"
      ? filteredClasses.map((c) => ({ id: c.id, name: c.name }))
      : mode === "ROOM"
        ? filteredRooms.map((r) => ({
            id: r.id,
            name: r.name,
            meta: countRoomPeriods(data, r.id) || undefined,
          }))
        : filteredTeachers.map((t) => ({ id: t.id, name: t.name }));

  const entityNoun = mode === "CLASS" ? "Group" : mode === "TEACHER" ? "Teacher" : "Room";
  const hasSchedule = Object.keys(data.schedule).length > 0;

  return (
    <div className="flex h-full min-h-0 flex-col p-6">
      <GeneratorToolbar
        data={data}
        mode={mode}
        isGenerating={isGenerating}
        stats={stats}
        onNavigate={onNavigate}
        onModeChange={setMode}
        onGenerate={handleGenerate}
        onStop={handleStop}
        onExcelExport={handleExcelExport}
        onPrint={handlePrint}
        onExportICal={handleExportICal}
        canRestore={canRestore && !!previousScheduleRef.current}
        onRestore={handleRestore}
      />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        <div
          className={`relative flex flex-1 overflow-hidden rounded-lg border border-edge bg-surface transition-opacity ${
            isGenerating ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {isGenerating && <SolverProgressOverlay progress={liveProgress} elapsedMs={elapsedMs} />}

          <div className="flex w-48 shrink-0 flex-col overflow-y-auto border-r border-edge bg-canvas">
            <div className="sticky top-0 z-10 space-y-2 border-b border-edge bg-canvas p-3">
              <span className="block text-2xs text-content-muted">Select {entityNoun}</span>
              <div className="relative">
                <Search
                  size={12}
                  aria-hidden
                  className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-content-muted"
                />
                <input
                  type="text"
                  value={sidebarFilter}
                  onChange={(e) => setSidebarFilter(e.target.value)}
                  placeholder="Filter"
                  aria-label={`Filter ${entityNoun.toLowerCase()} list`}
                  className={`${controlClass} h-8 w-full pl-7 text-xs`}
                />
              </div>
            </div>

            {!hasSchedule && !isGenerating && (
              <p className="flex flex-1 items-center justify-center p-4 text-center text-2xs text-content-muted">
                No schedule yet
              </p>
            )}

            {entityList.map((entity) => {
              const isActive = activeId === entity.id;
              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => setActiveId(entity.id)}
                  aria-current={isActive}
                  className={`flex w-full items-center gap-2 border-b border-edge-subtle border-l-2 px-3 py-2.5
                              text-left text-xs transition-colors focus-visible:outline-none
                              focus-visible:ring-2 focus-visible:ring-accent ${
                                isActive
                                  ? "border-l-accent bg-surface font-medium text-content"
                                  : "border-l-transparent text-content-muted hover:text-content-secondary"
                              }`}
                >
                  <span className="min-w-0 flex-1 truncate">{entity.name}</span>
                  {mode === "ROOM" && (
                    <span className="shrink-0 text-2xs tabular-nums text-content-muted">
                      {entity.meta ?? "—"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="custom-scrollbar relative flex-1 overflow-auto bg-canvas/40 p-6">
            {!hasSchedule && !isGenerating && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas">
                <div className="max-w-sm text-center">
                  <h3 className="text-sm font-semibold text-content">No timetable yet</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-content-muted">
                    The auto-generator builds a full week for every class from your curriculum,
                    teacher availability and scheduling limits.
                  </p>
                  <Button onClick={handleGenerate} className="mt-4" icon={<Play size={15} />}>
                    Generate Schedule
                  </Button>
                </div>
              </div>
            )}
            <ScheduleGrid
              data={data}
              activeId={activeId}
              mode={mode}
              onUpdate={onUpdate}
              setHoverConflict={setHoverConflict}
              highlightedConflict={highlightedConflict}
            />
          </div>
        </div>

        {(hoverConflict ||
          (!isGenerating && (data.lastGenerated || data.conflicts.length > 0))) && (
          <div className="relative flex">
            {!isGenerating && data.lastGenerated && (
              <button
                type="button"
                onClick={() => setIsConflictPanelOpen(!isConflictPanelOpen)}
                className="absolute -left-7 top-1/2 flex h-14 w-7 -translate-y-1/2 items-center
                           justify-center rounded-l-md border border-r-0 border-edge bg-surface
                           text-content-muted transition-colors hover:text-content
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label={isConflictPanelOpen ? "Hide validation panel" : "Show validation panel"}
                title={isConflictPanelOpen ? "Hide validation panel" : "Show validation panel"}
              >
                {isConflictPanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            )}

            <div
              className={`origin-right transition-all duration-200 ease-in-out ${
                isConflictPanelOpen ? "ml-4 w-96 opacity-100" : "ml-0 w-0 overflow-hidden opacity-0"
              }`}
            >
              <div className="w-96 space-y-3">
                {hoverConflict && (
                  <button
                    type="button"
                    onClick={() => setHighlightedConflict(hoverConflict)}
                    className="w-full rounded-md border border-l-2 border-edge border-l-danger
                               bg-surface px-4 py-3 text-left transition-colors hover:border-edge-strong
                               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <h4 className="flex items-center gap-2 text-sm font-medium text-content">
                      <Lock size={13} className="text-danger-ink" aria-hidden />
                      Move not allowed
                    </h4>
                    <p className="mt-1 text-xs leading-relaxed text-content-muted">
                      {hoverConflict.reason}
                    </p>
                    {hoverConflict.className && (
                      <p className="mt-1.5 text-2xs text-content-muted">
                        Target: {hoverConflict.className}
                      </p>
                    )}
                  </button>
                )}

                {!isGenerating && (data.lastGenerated || data.conflicts.length > 0) && (
                  <ConflictPanel
                    conflicts={data.conflicts}
                    selectedConflict={highlightedConflict}
                    onConflictSelect={setHighlightedConflict}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
