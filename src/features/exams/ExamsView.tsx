import React, { useState, useMemo } from "react";
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
} from "lucide-react";
import { AppData, ExamSession } from "../../types";
import { Button } from "../../components/ui";

// Hooks
import { useExamSchedule } from "./hooks/useExamSchedule";

// Components
import { ExamCard } from "./components/ExamCard";
import { ExamGrid } from "./components/ExamGrid";
import { ExamManualModal } from "./components/ExamManualModal";
import { ExamSchoolAutoModal } from "./components/ExamSchoolAutoModal";
import { InvigilatorRoster } from "./components/InvigilatorRoster";

// Logic
import { allocateInvigilators } from "./logic/invigilatorAllocator";

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
  // 1. Logic Hook
  const {
    exams,
    addExam,
    updateExam,
    deleteExam,
    upsertExams,
    clearAllExams,
    validateExam,
    swapExams,
    moveExamToDate,
    moveExamToSlot,
  } = useExamSchedule(data, onUpdate);

  // 2. UI State
  const [viewMode, setViewMode] = useState<"GRID" | "CARDS" | "ROSTER">("GRID");
  const [activeId, setActiveId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Edit Mode States
  const [isEditMode, setIsEditMode] = useState(false);

  // Modal States
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);

  // Invigilator Allocation State
  const [minInv, setMinInv] = useState(2);
  const [maxInv, setMaxInv] = useState(3);

  // 3. Helper: Regenerate/Overwrite Logic
  const handleRegenerateExams = (newSessions: ExamSession[]) => {
    // Overwrite global state. This effectively "clears" old exams and sets new ones.
    onUpdate({
      ...data,
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

  const handleClearAll = () => {
    if (
      confirm(
        "Are you sure you want to delete ALL exams? This cannot be undone."
      )
    ) {
      clearAllExams();
    }
  };

  const handleAutoAssignInvigilators = () => {
    if (exams.length === 0) {
      alert("No exams to assign staff to. Please schedule exams first.");
      return;
    }

    if (
      !confirm(
        `This will assign staff (Min: ${minInv}, Max: ${maxInv}) to all exams. \n\nNote: Combined classes may be split into individual sessions to ensure correct staff allocation.\n\nContinue?`
      )
    ) {
      return;
    }

    try {
      const updatedExams = allocateInvigilators(data, {
        minInvigilators: minInv,
        maxInvigilators: maxInv,
      });

      onUpdate({ ...data, exams: updatedExams });
      alert(
        `Success! Staff assigned. Exam count is now: ${updatedExams.length}`
      );
    } catch (error) {
      console.error("Allocation failed", error);
      alert("An error occurred during allocation. Please check console.");
    }
  };

  // Placeholders
  const handleExcelExport = () =>
    alert("Excel export for exams not yet implemented.");
  const handlePrint = () =>
    alert("Print function for exams not yet implemented.");

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden p-6">
      {/* HEADER TOOLBAR */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          {/* Back Button */}
          <button
            onClick={() => onNavigate && onNavigate("DASHBOARD")}
            className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 mr-2"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </button>

          <div>
            <h2 className="text-xl font-bold text-slate-800">
              Exam Management
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Coordinate and track school-wide assessments.
            </p>
          </div>

          {/* Edit Mode Toggles */}
          <div className="flex items-center gap-2 pl-6 border-l border-slate-200 ml-6">
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
              {isEditMode ? "Editing Enabled" : "Read Only"}
            </button>

            {isEditMode && (
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  className="p-1.5 rounded-md transition-all bg-white text-emerald-600 shadow-sm"
                  title="Swap Mode: Drag onto another exam to swap"
                >
                  <Repeat size={16} />
                </button>
              </div>
            )}
          </div>

          {/* View Toggles & Search */}
          <div className="flex items-center gap-4 ml-auto border-l border-slate-200 pl-6">
            <div className="flex bg-slate-100 p-1 rounded-lg">
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

            <div className="relative w-48">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                size={14}
              />
              <input
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
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
                  setMaxInv(Math.max(1, parseInt(e.target.value) || 1))
                }
                className="w-10 h-7 text-center text-xs font-bold rounded border border-slate-200"
                min="1"
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
          >
            Export
          </Button>
          <Button onClick={handlePrint} icon={<Printer size={16} />}>
            Print
          </Button>
        </div>
      </div>

      {/* WORKSPACE AREA */}
      <div className="flex-1 flex overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm relative">
        {/* SIDEBAR: Class Filters */}
        {viewMode !== "ROSTER" && (
          <div className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0">
            <div className="p-4 border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Exam Classes
              </span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
              {sortedClasses.map((cls) => (
                <button
                  key={cls.id}
                  onClick={() =>
                    setActiveId(cls.id === activeId ? "ALL" : cls.id)
                  }
                  className={`w-full text-left px-3 py-2 rounded-md text-xs font-bold transition-colors flex items-center gap-2 ${
                    activeId === cls.id
                      ? "bg-white text-amber-700 shadow-sm border border-slate-200"
                      : "text-slate-600 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      activeId === cls.id ? "bg-amber-500" : "bg-slate-300"
                    }`}
                  />
                  {cls.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-auto bg-white relative custom-scrollbar">
          {/* GRID VIEW */}
          {viewMode === "GRID" && (
            <div className="p-6 h-full min-w-full inline-block">
              <ExamGrid
                data={data}
                exams={filteredExams}
                activeId={activeId}
                onEdit={handleEditClick}
                checkConflicts={(exam) => validateExam(exam, exams)}
                onSwap={swapExams}
                isEditMode={isEditMode}
              />
            </div>
          )}

          {/* ROSTER VIEW */}
          {viewMode === "ROSTER" && (
            <div className="p-6 h-full">
              <InvigilatorRoster data={data} exams={filteredExams} />
            </div>
          )}

          {/* CARD VIEW */}
          {viewMode === "CARDS" && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  subject={data.subjects.find((s) => s.id === exam.subjectId)}
                  teachers={data.teachers}
                  room={data.rooms.find((r) => r.id === exam.roomId)}
                  classes={data.classes}
                  conflicts={validateExam(exam, exams)}
                  onEdit={() => handleEditClick(exam)}
                  onDelete={() => deleteExam(exam.id)}
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
        data={data}
        activeId={activeId}
        editingExam={editingExam}
        onSave={handleSaveManual}
      />

      <ExamSchoolAutoModal
        isOpen={autoModalOpen}
        onClose={() => setAutoModalOpen(false)}
        data={data}
        onSave={handleRegenerateExams}
      />
    </div>
  );
};
