import React, { useState, useMemo, useEffect } from "react";
import {
  Plus,
  Search,
  FileText,
  LayoutGrid,
  List,
  Wand2,
  Users,
  Eraser,
  Lock,
  Unlock,
  Move,
  Repeat,
  ArrowLeft,
  BookOpen,
  Printer,
  FileSpreadsheet,
  Table,
  History,
  Trash2,
  Pencil,
} from "lucide-react";
import { AppData } from "../../types";
import { ExamSession, ExamRoster } from "./types";
import { Button } from "../../components/ui";
import { useToast } from "../../components/ui/Toast";
import { generateId } from "../../utils/utils";

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
import { 
  exportExamsToExcel, 
  exportExamsToPDF,
  exportInvigilatorsToExcel,
  exportInvigilatorsToPDF
} from "../../services/export/exams";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: any) => void;
}

export const ExamsView: React.FC<ViewProps> = ({
  data,
  onUpdate,
  onNavigate,
}) => {
  const { showToast } = useToast();
  const {
    activeRosterId,
    setActiveRosterId,
    activeRoster,
    activeData,
    handleUpdateActiveRoster,
    createNewRoster,
    deleteRoster,
    renameRoster
  } = useExamRosters(data, onUpdate);

  // --- LOGIC HOOK ---
  const {
    exams,
    addExam,
    updateExam,
    deleteExam,
    upsertExams,
    clearAllExams,
    validateExam,
    checkMoveConflicts,
    swapExams,
    moveExamToDate,
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

  // Invigilator Allocation State
  const [minInv, setMinInv] = useState(2);
  const [maxInv, setMaxInv] = useState(3);

  // 3. Helper: Regenerate/Overwrite Logic
  const handleRegenerateExams = (newSessions: ExamSession[]) => {
    if (
      exams.length > 0 &&
      !confirm(
        "Auto-schedule will replace all exams in this timetable. Continue?"
      )
    ) {
      return;
    }
    handleUpdateActiveRoster({
      ...activeData,
      exams: newSessions,
    });
  };

  // 4. Sorting & Memoization
  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
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
      const subjectsMap = new Map(
        data.subjects.map((s) => [s.id, s.name.toLowerCase()])
      );
      const teachersMap = new Map(
        data.teachers.map((t) => [t.id, t.name.toLowerCase()])
      );

      list = list.filter((e) => {
        const subjectName = subjectsMap.get(e.subjectId) || "";
        const paperLabel = e.paperLabel?.toLowerCase() || "";

        // Check if ANY assigned invigilator matches
        const hasMatchingTeacher = e.invigilatorIds?.some((id) => {
          const tName = teachersMap.get(id);
          return tName && tName.includes(q);
        });

        return (
          subjectName.includes(q) ||
          paperLabel.includes(q) ||
          hasMatchingTeacher
        );
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
    const skeleton: any = {
      id: "", // Empty ID signals "New"
      date,
      startTime: time,
      classIds: activeId !== "ALL" ? [activeId] : [],
      subjectId: data.subjects[0]?.id || "",
      duration: 120,
      paperNumber: 1,
      status: "DRAFT"
    };
    setEditingExam(skeleton);
    setManualModalOpen(true);
  };

  const handleClearAll = () => {
    if (
      confirm(
        "Delete ALL exams in this timetable? You can undo with Ctrl+Z."
      )
    ) {
      clearAllExams();
    }
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
        "error"
      );
      return;
    }

    try {
      const { exams: updatedExams, warnings } = allocateInvigilators(
        activeData,
        {
          minInvigilators: minInv,
          maxInvigilators: maxInv,
          excludedTeacherIds: excludedIds,
        }
      );

      handleUpdateActiveRoster({ ...activeData, exams: updatedExams });
      setExclusionModalOpen(false);

      showToast(
        `Staff assigned. ${updatedExams.length} sessions (expanded per class for invigilation roster).`,
        "success"
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

  if (!activeRoster) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* HEADER TOOLBAR */}
      <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between gap-4 z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-2 flex-1">
          {/* Back Button */}
          <button
            onClick={() => onNavigate && onNavigate("DASHBOARD")}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 mr-2"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="flex flex-col mr-4">
            <div className="flex items-center group/title relative">
              <input 
                value={activeRoster.name}
                onChange={(e) => renameRoster(e.target.value)}
                className="text-xl font-bold text-slate-800 bg-transparent border-none p-0 focus:ring-0 w-auto hover:bg-slate-50 rounded px-1 transition-colors"
              />
              <Pencil size={12} className="text-slate-300 ml-1 opacity-0 group-hover/title:opacity-100 transition-opacity pointer-events-none" />
            </div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">
              Exam Management History
            </p>
          </div>

          {/* View Toggles */}
          <div className="flex bg-slate-100 p-1 rounded-lg ml-2">
            <button
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded ${
                viewMode === "GRID"
                  ? "bg-white shadow-sm text-amber-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Master Table View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("ROSTER")}
              className={`p-1.5 rounded ${
                viewMode === "ROSTER"
                  ? "bg-white shadow-sm text-amber-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Invigilator Roster"
            >
              <Table size={16} />
            </button>
            <button
              onClick={() => setViewMode("CARDS")}
              className={`p-1.5 rounded ${
                viewMode === "CARDS"
                  ? "bg-white shadow-sm text-amber-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Card List View"
            >
              <List size={16} />
            </button>
          </div>

          {/* Edit Mode Toggles */}
          <div className="flex items-center gap-2 pl-4 border-l border-slate-200 ml-4">
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                isEditMode
                  ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
              }`}
              title={isEditMode ? "Disable Drag & Drop" : "Enable Drag & Drop"}
            >
              {isEditMode ? <Unlock size={14} /> : <Lock size={14} />}
              {isEditMode ? "Disable Edit" : "Enable Edit"}
            </button>
          </div>

          {/* Search */}
          <div className="relative w-48 ml-auto">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={14}
            />
            <input
              placeholder="Search exams..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Allocation Controls */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border mr-2">
            <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase">
              Invig Range
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minInv}
                onChange={(e) =>
                  setMinInv(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-10 h-7 text-center text-xs font-bold rounded border border-slate-200"
                min="1"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="number"
                value={maxInv}
                onChange={(e) =>
                  setMaxInv(Math.max(minInv, parseInt(e.target.value) || minInv))
                }
                className="w-10 h-7 text-center text-xs font-bold rounded border border-slate-200"
                min={minInv}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[10px] px-2 bg-white hover:bg-amber-50 text-amber-700 font-bold"
              onClick={handleAutoAssignInvigilators}
            >
              Assign Staff
            </Button>
          </div>

          <Button
            onClick={() => setAutoModalOpen(true)}
            size="md"
            icon={<Wand2 size={16} />}
          >
            Auto Schedule
          </Button>
          <Button
            onClick={handleExcelExport}
            icon={<FileSpreadsheet size={16} />}
            title="Export to Excel"
          />
          <Button 
            onClick={handlePrint} 
            icon={<Printer size={16} />} 
            title="Print PDF"
          />
        </div>
      </div>

      {/* WORKSPACE AREA */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR 1: HISTORY (Timetables) */}
        <div className="w-48 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0 shadow-[inset_-1px_0_0_rgba(0,0,0,0.05)]">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100/50">
            <div className="flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Timetables
              </span>
            </div>
            <button 
              onClick={createNewRoster}
              className="p-1 bg-white text-amber-600 rounded border border-slate-200 hover:bg-amber-50 transition-all shadow-sm"
              title="New Timetable"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {data.examRosters?.map(r => (
              <div 
                key={r.id}
                onClick={() => setActiveRosterId(r.id)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  activeRosterId === r.id 
                    ? "bg-white border-amber-200 shadow-md ring-1 ring-amber-100" 
                    : "bg-transparent border-transparent hover:bg-white hover:border-slate-200"
                }`}
              >
                <div className="flex flex-col gap-0.5 pr-6">
                  <span className={`text-[11px] font-black truncate ${activeRosterId === r.id ? "text-amber-700" : "text-slate-600"}`}>
                    {r.name}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">
                    {r.exams.length} Sessions
                  </span>
                </div>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteRoster(r.id); }}
                  className="absolute top-3 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SIDEBAR 2: CLASS FILTERS */}
        <div className="w-48 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 z-10">
          <div className="p-4 border-b border-slate-100 bg-white sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Class Filter
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            <button
              onClick={() => setActiveId("ALL")}
              className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-black transition-all flex items-center gap-2 border ${
                activeId === "ALL"
                  ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm"
                  : "bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-100"
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${activeId === "ALL" ? "bg-amber-500" : "bg-slate-300"}`} />
              Show All Classes
            </button>
            <div className="h-px bg-slate-100 my-2 mx-2" />
            {sortedClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() =>
                  setActiveId(cls.id === activeId ? "ALL" : cls.id)
                }
                className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-bold transition-all flex items-center gap-2 border ${
                  activeId === cls.id
                    ? "bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-200"
                    : "bg-white border-transparent text-slate-600 hover:bg-slate-50 hover:border-slate-100"
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeId === cls.id ? "bg-amber-400" : "bg-slate-300"
                  }`}
                />
                <span className="truncate">{cls.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-auto bg-white relative custom-scrollbar shadow-inner">
          {/* GRID VIEW */}
          {viewMode === "GRID" && (
            <div className="p-6 h-full min-w-full inline-block">
              <ExamGrid
                data={activeData}
                exams={filteredExams}
                activeId={activeId}
                onEdit={handleEditClick}
                onAddCell={handleCellClick}
                checkConflicts={(exam) => validateExam(exam)}
                checkMoveConflicts={checkMoveConflicts}
                onSwap={swapExams}
                onMoveToSlot={moveExamToSlot}
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
                  onToggleLock={() =>
                    updateExam({ ...exam, locked: !exam.locked })
                  }
                />
              ))}
            </div>
          )}

          {/* EMPTY STATE */}
          {filteredExams.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <div className="bg-slate-50 p-6 rounded-full mb-4 shadow-inner border border-slate-100">
                <FileText size={64} className="text-slate-200" />
              </div>
              <p className="font-bold text-xl text-slate-600">No exams found</p>
              <p className="text-sm">
                Modify your filters or add a new exam to get started.
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
