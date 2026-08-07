import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Wand2,
  Lock,
  Unlock,
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  Table,
  Trash2,
} from "lucide-react";
import { AppData, ViewState } from "../../types";
import { ExamSession } from "./types";
import { Button, controlClass, quietButtonClass } from "../../components/ui";
import { useToast } from "../../components/ui/Toast";

// Hooks
import { useExamSchedule } from "./hooks/useExamSchedule";
import { useExamRosters } from "./hooks/useExamRosters";

// Components
import { ExamCard } from "./components/ExamCard";
import { ExamGrid } from "./components/ExamGrid";
import { ExamManualModal } from "./components/ExamManualModal";
import { ExamSchoolAutoModal } from "./components/ExamSchoolAutoModal";
import { InvigilatorRoster } from "./components/InvigilatorRoster";
import { InvigilatorExclusionModal } from "./components/InvigilatorExclusionModal";

// Logic
import { allocateInvigilators } from "./logic/invigilatorAllocator";
import { getNextExamDay, toLocalDateString } from "./logic/examUtils";
import {
  exportExamsToExcel,
  exportExamsToPDF,
  exportInvigilatorsToExcel,
  exportInvigilatorsToPDF,
} from "../../services/export/exams";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: ViewState) => void;
}

export const ExamsView: React.FC<ViewProps> = ({ data, onUpdate, onNavigate }) => {
  const { showToast } = useToast();
  const {
    activeRosterId,
    setActiveRosterId,
    activeRoster,
    activeData,
    handleUpdateActiveRoster,
    createNewRoster,
    deleteRoster,
    renameRoster,
  } = useExamRosters(data, onUpdate);

  // --- LOGIC HOOK ---
  const {
    exams,
    addExam,
    updateExam,
    deleteExam,
    upsertExams,
    validateExam,
    checkMoveConflicts,
    swapExams,
    moveExamToSlot,
  } = useExamSchedule(activeData, handleUpdateActiveRoster);

  // 2. UI State
  const [viewMode, setViewMode] = useState<"GRID" | "CARDS" | "ROSTER">("GRID");
  const [activeId, setActiveId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);

  // Modal States
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [exclusionModalOpen, setExclusionModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);

  const [minInv, setMinInv] = useState(2);
  const [maxInv, setMaxInv] = useState(4);

  // 3. Helper: Regenerate/Overwrite Logic
  const handleRegenerateExams = (newSessions: ExamSession[]) => {
    if (
      exams.length > 0 &&
      !confirm("Auto-schedule will replace all exams in this timetable. Continue?")
    ) {
      return;
    }
    handleUpdateActiveRoster({
      ...activeData,
      exams: newSessions,
    });
  };

  // Empty days the user has appended to drop exams into. Kept in view state:
  // once an exam lands on one it becomes a real exam date and persists on its
  // own, so this only needs to survive until then.
  const [extraDates, setExtraDates] = useState<string[]>([]);

  const displayDates = useMemo(() => {
    const set = new Set<string>(exams.map((e) => e.date));
    extraDates.forEach((d) => set.add(d));
    return Array.from(set).sort();
  }, [exams, extraDates]);

  const handleAddDay = () => {
    const last = displayDates[displayDates.length - 1];
    const from = last ?? toLocalDateString(new Date(Date.now() - 86_400_000));
    setExtraDates((prev) => [...new Set([...prev, getNextExamDay(from)])]);
  };

  // 4. Sorting & Memoization
  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  }, [data.classes]);

  // Optimized Filter Logic
  const filteredExams = useMemo(() => {
    let list = [...exams];

    // Filter by Class (Only applies to GRID and CARDS)
    if (viewMode !== "ROSTER" && activeId !== "ALL") {
      list = list.filter((e) => e.classIds.includes(activeId));
    }

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();

      // Pre-calculate lookups for performance inside the loop
      const subjectsMap = new Map(data.subjects.map((s) => [s.id, s.name.toLowerCase()]));
      const teachersMap = new Map(data.teachers.map((t) => [t.id, t.name.toLowerCase()]));

      list = list.filter((e) => {
        const subjectName = subjectsMap.get(e.subjectId) || "";
        const paperLabel = e.paperLabel?.toLowerCase() || "";

        // Check if ANY assigned invigilator matches
        const hasMatchingTeacher = e.invigilatorIds?.some((id) => {
          const tName = teachersMap.get(id);
          return tName && tName.includes(q);
        });

        return subjectName.includes(q) || paperLabel.includes(q) || hasMatchingTeacher;
      });
    }

    return list;
  }, [exams, activeId, viewMode, searchQuery, data.subjects, data.teachers]);

  // 5. Handlers
  const handleSaveManual = (result: ExamSession | ExamSession[]) => {
    if (Array.isArray(result)) {
      // Handle Split Papers (Update P1, Insert P2) or Multi-Class splits
      upsertExams(result);
    } else {
      if (editingExam) {
        updateExam(result);
      } else {
        addExam(result);
      }
    }
    setEditingExam(null);
  };

  const handleEditClick = (exam: ExamSession) => {
    setEditingExam(exam);
    setManualModalOpen(true);
  };

  const handleCellClick = (date: string, time: string) => {
    // Create a skeleton exam session to pre-populate the modal
    const skeleton: ExamSession = {
      id: "", // Empty ID signals "New"
      date,
      startTime: time,
      classIds: activeId !== "ALL" ? [activeId] : [],
      subjectId: data.subjects[0]?.id || "",
      duration: 120,
      paperNumber: 1,
      status: "DRAFT",
    };
    setEditingExam(skeleton);
    setManualModalOpen(true);
  };

  const handleAutoAssignInvigilators = () => {
    if (exams.length === 0) {
      showToast("No exams to assign staff to. Please schedule exams first.", "error");
      return;
    }
    setExclusionModalOpen(true);
  };

  const handleConfirmAllocation = (excludedIds: string[]) => {
    if (minInv > maxInv) {
      showToast(
        "Minimum invigilators cannot exceed maximum. Adjust the range and try again.",
        "error",
      );
      return;
    }

    try {
      const { exams: updatedExams, warnings } = allocateInvigilators(activeData, {
        minInvigilators: minInv,
        maxInvigilators: maxInv,
        excludedTeacherIds: excludedIds,
      });

      handleUpdateActiveRoster({ ...activeData, exams: updatedExams });
      setExclusionModalOpen(false);

      showToast(
        `Staff assigned: ${minInv}${minInv !== maxInv ? `–${maxInv}` : ""} invigilator(s) per stream per exam day (all sessions).`,
        "success",
      );

      warnings.slice(0, 3).forEach((w) => showToast(w, "error"));
      if (warnings.length > 3) {
        showToast(`+${warnings.length - 3} more staffing warnings.`, "error");
      }
    } catch (error) {
      console.error("Allocation failed", error);
      showToast("An error occurred during allocation. Please check console.", "error");
    }
  };

  // Handlers
  const handleExcelExport = () => {
    if (viewMode === "ROSTER") {
      exportInvigilatorsToExcel(activeData, exams);
    } else {
      exportExamsToExcel(activeData);
    }
  };

  const handlePrint = () => {
    if (viewMode === "ROSTER") {
      exportInvigilatorsToPDF(activeData, exams);
    } else {
      exportExamsToPDF(activeData);
    }
  };

  // No timetables left — e.g. the last one was just deleted. Offer a way back
  // in rather than blanking the screen (which is how it read before, since a
  // deleted last roster used to be silently regenerated).
  if (!activeRoster) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center">
        <div>
          <p className="text-sm font-medium text-content">No exam timetables</p>
          <p className="mt-1 text-xs text-content-muted">
            Create one to schedule exams and assign invigilators.
          </p>
        </div>
        <Button onClick={createNewRoster} icon={<Plus size={16} />}>
          New Timetable
        </Button>
        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate("DASHBOARD")}
            className="text-xs text-accent-ink underline-offset-4 hover:underline
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Back to Dashboard
          </button>
        )}
      </div>
    );
  }

  const viewTabs = [
    { id: "GRID" as const, label: "Grid", icon: LayoutGrid },
    { id: "ROSTER" as const, label: "Roster", icon: Table },
    { id: "CARDS" as const, label: "Cards", icon: List },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* HEADER TOOLBAR */}
      <div className="z-10 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-edge bg-surface px-4 py-3">
        <button
          type="button"
          onClick={() => onNavigate && onNavigate("DASHBOARD")}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-edge bg-surface
                     text-content-muted transition-colors hover:border-edge-strong hover:text-content
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          title="Back to Dashboard"
          aria-label="Back to Dashboard"
        >
          <ArrowLeft size={16} aria-hidden />
        </button>

        <input
          value={activeRoster.name}
          onChange={(e) => renameRoster(e.target.value)}
          aria-label="Exam roster name"
          className="min-w-0 max-w-[16rem] rounded-md border border-transparent bg-transparent px-2 py-1
                     text-base font-semibold text-content transition-colors hover:border-edge
                     focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
        />

        <div
          role="tablist"
          aria-label="Exam view"
          className="inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
        >
          {viewTabs.map((t) => {
            const Icon = t.icon;
            const isActive = viewMode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setViewMode(t.id)}
                title={t.label}
                className={`inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm transition-colors
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                              isActive
                                ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                : "text-content-muted hover:text-content"
                            }`}
              >
                <Icon size={14} aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>

        {viewMode === "GRID" && (
          <button
            type="button"
            onClick={() => setIsEditMode(!isEditMode)}
            aria-pressed={isEditMode}
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          isEditMode
                            ? "border-accent bg-accent/15 font-medium text-content"
                            : "border-edge bg-surface text-content-secondary hover:border-edge-strong hover:text-content"
                        }`}
          >
            {isEditMode ? <Unlock size={14} aria-hidden /> : <Lock size={14} aria-hidden />}
            {isEditMode ? "Editing" : "Edit"}
          </button>
        )}

        <div className="relative ml-auto w-48">
          <Search
            size={14}
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
          />
          <input
            placeholder="Search exams"
            aria-label="Search exams"
            className={`${controlClass} w-full pl-8`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 border-l border-edge pl-4">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs text-content-muted">Staff/stream</span>
            <input
              type="number"
              value={minInv}
              onChange={(e) => setMinInv(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
              className={`${controlClass} h-8 w-12 px-1 text-center`}
              min={1}
              max={8}
              aria-label="Minimum invigilators per stream per exam day"
            />
            <span className="text-content-muted">–</span>
            <input
              type="number"
              value={maxInv}
              onChange={(e) =>
                setMaxInv(Math.max(minInv, Math.min(8, parseInt(e.target.value) || minInv)))
              }
              className={`${controlClass} h-8 w-12 px-1 text-center`}
              min={minInv}
              max={8}
              aria-label="Maximum invigilators per stream per exam day"
            />
          </div>
          <button
            type="button"
            onClick={handleAutoAssignInvigilators}
            className={quietButtonClass}
            title="Assign staff per stream; the same team covers all sessions that day"
          >
            Assign staff
          </button>
        </div>

        <Button onClick={() => setAutoModalOpen(true)} icon={<Wand2 size={16} />}>
          Auto Schedule
        </Button>
        <button
          type="button"
          onClick={handleExcelExport}
          className={`${quietButtonClass} w-9 justify-center px-0`}
          title="Export to Excel"
          aria-label="Export to Excel"
        >
          <FileSpreadsheet size={15} aria-hidden />
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className={`${quietButtonClass} w-9 justify-center px-0`}
          title="Print PDF"
          aria-label="Print PDF"
        >
          <Printer size={15} aria-hidden />
        </button>
      </div>

      {/* WORKSPACE AREA */}
      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR 1: ROSTERS */}
        <div className="flex h-full w-48 shrink-0 flex-col border-r border-edge bg-canvas">
          <div className="flex items-center justify-between border-b border-edge px-3 py-2.5">
            <span className="text-2xs uppercase tracking-wide text-content-muted">Timetables</span>
            <button
              type="button"
              onClick={createNewRoster}
              className="grid h-6 w-6 place-items-center rounded text-content-muted transition-colors
                         hover:bg-surface-inset hover:text-content focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-accent"
              title="New timetable"
              aria-label="New timetable"
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>
          <div className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2">
            {data.examRosters?.map((r) => {
              const isActive = activeRosterId === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => setActiveRosterId(r.id)}
                  className={`group relative cursor-pointer rounded-md border-l-2 px-2.5 py-2 transition-colors ${
                    isActive
                      ? "border-l-accent bg-surface"
                      : "border-l-transparent hover:bg-surface/60"
                  }`}
                >
                  <div className="pr-5">
                    <div
                      className={`truncate text-xs ${isActive ? "font-medium text-content" : "text-content-secondary"}`}
                    >
                      {r.name}
                    </div>
                    <div className="text-2xs tabular-nums text-content-muted">
                      {r.exams.length} {r.exams.length === 1 ? "session" : "sessions"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoster(r.id);
                    }}
                    aria-label={`Delete ${r.name}`}
                    className="absolute right-1.5 top-2 grid h-5 w-5 place-items-center rounded text-content-muted
                               opacity-0 transition-colors hover:text-danger-ink group-hover:opacity-100
                               focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2
                               focus-visible:ring-accent"
                  >
                    <Trash2 size={12} aria-hidden />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* SIDEBAR 2: CLASS FILTER */}
        <div className="flex h-full w-44 shrink-0 flex-col border-r border-edge bg-surface">
          <div className="border-b border-edge px-3 py-2.5">
            <span className="text-2xs uppercase tracking-wide text-content-muted">
              Class filter
            </span>
          </div>
          <div className="custom-scrollbar flex-1 space-y-0.5 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => setActiveId("ALL")}
              className={`flex w-full items-center rounded-md border-l-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                activeId === "ALL"
                  ? "border-l-accent bg-surface-muted font-medium text-content"
                  : "border-l-transparent text-content-muted hover:text-content"
              }`}
            >
              All classes
            </button>
            {sortedClasses.map((cls) => {
              const isActive = activeId === cls.id;
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setActiveId(cls.id === activeId ? "ALL" : cls.id)}
                  className={`flex w-full items-center rounded-md border-l-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                    isActive
                      ? "border-l-accent bg-surface-muted font-medium text-content"
                      : "border-l-transparent text-content-secondary hover:text-content"
                  }`}
                >
                  <span className="truncate">{cls.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="custom-scrollbar relative flex-1 overflow-auto bg-canvas">
          {/* GRID VIEW */}
          {viewMode === "GRID" && (
            <div className="inline-block min-w-full p-6">
              <ExamGrid
                data={activeData}
                exams={filteredExams}
                dates={displayDates}
                activeId={activeId}
                onEdit={handleEditClick}
                onAddCell={handleCellClick}
                onAddDay={handleAddDay}
                checkConflicts={(exam) => validateExam(exam)}
                checkMoveConflicts={checkMoveConflicts}
                onSwap={swapExams}
                onMoveToSlot={moveExamToSlot}
                onToggleLock={(exam) => updateExam({ ...exam, locked: !exam.locked })}
                isEditMode={isEditMode}
              />
            </div>
          )}

          {/* ROSTER VIEW */}
          {viewMode === "ROSTER" && (
            <div className="p-6 h-full">
              <InvigilatorRoster data={activeData} exams={filteredExams} />
            </div>
          )}

          {/* CARD VIEW */}
          {viewMode === "CARDS" && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  data={activeData}
                  allExams={exams}
                  onEdit={() => handleEditClick(exam)}
                  onDelete={() => deleteExam(exam.id)}
                  onToggleLock={() => updateExam({ ...exam, locked: !exam.locked })}
                />
              ))}
            </div>
          )}

          {/* EMPTY STATE — grid stays visible so days and cells can still be
              added; only the list views have nothing to show. */}
          {filteredExams.length === 0 && viewMode !== "GRID" && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium text-content">No exams found</p>
              <p className="mt-1 text-xs text-content-muted">
                Auto Schedule to build a timetable, or switch to the grid to add exams by hand.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <ExamManualModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        data={activeData}
        activeId={activeId}
        editingExam={editingExam}
        onSave={handleSaveManual}
      />

      <ExamSchoolAutoModal
        isOpen={autoModalOpen}
        onClose={() => setAutoModalOpen(false)}
        data={activeData}
        onSave={handleRegenerateExams}
        onSessionsPerDayChange={(sessionsPerDay) => {
          onUpdate({
            ...data,
            settings: {
              ...data.settings,
              examGrid: {
                ...data.settings.examGrid,
                sessionsPerDay,
              },
            },
          });
        }}
      />

      <InvigilatorExclusionModal
        isOpen={exclusionModalOpen}
        onClose={() => setExclusionModalOpen(false)}
        data={activeData}
        onConfirm={handleConfirmAllocation}
      />
    </div>
  );
};
