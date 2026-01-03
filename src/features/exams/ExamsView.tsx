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
} from "lucide-react";
import { AppData, ExamSession } from "../../types";
import { Button, Input } from "../../components/ui";

// Hooks
import { useExamSchedule } from "./hooks/useExamSchedule";

// Import the Logic Engine
import { ExamCard } from "./components/ExamCard";
import { ExamGrid } from "./components/ExamGrid";
import { ExamManualModal } from "./components/ExamManualModal";
import { ExamSchoolAutoModal } from "./components/ExamSchoolAutoModal";
import { InvigilatorRoster } from "./components/InvigilatorRoster";
import { allocateInvigilators } from "./logic/invigilatorAllocator";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  onNavigate?: (view: any) => void;
}

export const ExamsView: React.FC<ViewProps> = ({ data, onUpdate, onNavigate }) => {
  const {
    exams,
    addExam,
    updateExam,
    deleteExam,
    bulkAddExams,
    upsertExams, // IMPORT NEW FUNCTION
    clearAllExams,
    validateExam,
    swapExams,
    moveExamToDate,
  } = useExamSchedule(data, onUpdate);

  // Replacement for bulkAddExams that clears first
  const handleRegenerateExams = (newSessions: ExamSession[]) => {
    // Simply overwrite the global state with the new sessions.
    // This effectively "clears" the old ones and populates the new ones in one go.
    onUpdate({ 
      ...data, 
      exams: newSessions 
    });
  };

  // 2. UI State
  const [viewMode, setViewMode] = useState<"GRID" | "CARDS" | "ROSTER">("GRID");
  const [activeId, setActiveId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTool, setEditTool] = useState<"MOVE" | "SWAP">("MOVE"); // RESTORED state

  // Modal States
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);

  // Invigilator Allocation State
  const [minInv, setMinInv] = useState(2);
  const [maxInv, setMaxInv] = useState(3);

  // --- SORTING HELPERS ---
  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }, [data.classes]);

  const sortedTeachers = useMemo(() => {
    return [...data.teachers].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.teachers]);

  // 3. Filtering Logic
  const filteredExams = useMemo(() => {
    let list = [...exams];

    // Filter by Class (Only applies to GRID and CARDS)
    if (viewMode !== "ROSTER" && activeId !== "ALL") {
      list = list.filter((e) => e.classIds.includes(activeId));
    }

    // Filter by Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const subject = data.subjects.find((s) => s.id === e.subjectId);
        // Check if ANY assigned invigilator matches the search
        const hasMatchingTeacher = e.invigilatorIds?.some(id => {
          const t = data.teachers.find(teacher => teacher.id === id);
          return t?.name.toLowerCase().includes(q);
        });

        return (
          subject?.name.toLowerCase().includes(q) ||
          hasMatchingTeacher ||
          e.paperLabel?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [exams, activeId, viewMode, searchQuery, data.subjects, data.teachers]);

  // 4. Handlers
  const handleSaveManual = (result: ExamSession | ExamSession[]) => {
    if (Array.isArray(result)) {
      // Handle Split Papers (Update P1, Insert P2)
      upsertExams(result);
    } else {
      // Single Save
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

  const handleExcelExport = () => {
    alert("Excel export for exams not yet implemented.");
  };

  const handlePrint = () => {
    alert("Print function for exams not yet implemented.");
  };

  const handleAutoAssignInvigilators = () => {
    const updatedExams = allocateInvigilators(data, {
      minInvigilators: minInv,
      maxInvigilators: maxInv,
    });
    onUpdate({ ...data, exams: updatedExams });
    alert("Invigilators assigned successfully!");
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* SIDEBAR: Class Filters (Hidden in Roster view) */}
      {viewMode !== "ROSTER" && (
        <div className="w-56 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
          <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Users size={18} className="text-amber-500" />
              Exam Classes
            </h2>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
            {sortedClasses.map((cls) => (
              <button
                key={cls.id}
                onClick={() => setActiveId(cls.id === activeId ? "ALL" : cls.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
                  activeId === cls.id
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "text-slate-600 hover:bg-slate-50 border border-transparent"
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

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Back Button */}
            <button
              onClick={() => {
                console.log("Navigating back to Dashboard");
                if (onNavigate) onNavigate("DASHBOARD");
              }}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            
            <div>
              <h2 className="text-xl font-bold text-slate-800">Exam Management</h2>
              <p className="text-xs text-slate-500">Auto-schedule or manually coordinate academic assessments.</p>
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
                    onClick={() => setEditTool("MOVE")}
                    className={`p-1.5 rounded-md ${
                      editTool === "MOVE"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-400"
                    }`}
                    title="Move Mode"
                  >
                    <Move size={16} />
                  </button>
                  <button
                    onClick={() => setEditTool("SWAP")}
                    className={`p-1.5 rounded-md ${
                      editTool === "SWAP"
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-400"
                    }`}
                    title="Swap Mode"
                  >
                    <Repeat size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* NEW: View Toggles & Search (Restored) */}
            <div className="flex items-center gap-4 ml-auto border-l border-slate-200 pl-6">
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode("GRID")}
                  className={`p-1.5 rounded ${
                    viewMode === "GRID"
                      ? "bg-white shadow-sm text-amber-600"
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                  title="Grid View"
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
                  title="List View"
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
              <div className="px-2 py-1 text-[9px] font-bold text-slate-400 uppercase">Invig Range</div>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  value={minInv} 
                  onChange={e => setMinInv(parseInt(e.target.value))}
                  className="w-10 h-7 text-center text-xs font-bold rounded border border-slate-200"
                  min="1"
                />
                <span className="text-slate-400 text-xs">-</span>
                <input 
                  type="number" 
                  value={maxInv} 
                  onChange={e => setMaxInv(parseInt(e.target.value))}
                  className="w-10 h-7 text-center text-xs font-bold rounded border border-slate-200"
                  min="1"
                />
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-[10px] px-2 bg-white hover:bg-amber-50 text-amber-700"
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
              Generate Exams
            </Button>
            <Button
              onClick={handleExcelExport}
              disabled={false}
              icon={<FileSpreadsheet size={16} />}
            >
              Export All
            </Button>
            <Button
              onClick={handlePrint}
              disabled={false}
              icon={<Printer size={16} />}
            >
              Print All (PDF)
            </Button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 overflow-auto p-4 bg-slate-50/50">
          {/* GRID VIEW (Timetable) */}
          {viewMode === "GRID" && (
            <ExamGrid
              data={data}
              exams={filteredExams}
              onEdit={handleEditClick}
              checkConflicts={(exam) => validateExam(exam, exams)}
              onSwap={swapExams}
              onMoveDate={moveExamToDate}
              isEditMode={isEditMode}
              editTool={editTool}
            />
          )}

          {/* ROSTER VIEW (Class vs Day) */}
          {viewMode === "ROSTER" && (
            <InvigilatorRoster data={data} exams={filteredExams} />
          )}

          {/* CARD VIEW (Kanban/List) */}
          {viewMode === "CARDS" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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

          {/* Empty State */}
          {filteredExams.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <div className="bg-white p-4 rounded-full mb-4 shadow-sm border border-slate-100">
                <FileText size={48} className="text-slate-200" />
              </div>
              <p className="font-medium text-lg text-slate-600">
                No exams found
              </p>
              <p className="text-sm">
                Select a class or add a new exam to get started.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- MODALS --- */}

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
