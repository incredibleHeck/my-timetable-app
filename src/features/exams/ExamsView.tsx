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
} from "lucide-react";
import { AppData, ExamSession } from "../../types";
import { Button, Input } from "../../components/ui";

// Hooks
import { useExamSchedule } from "./hooks/useExamSchedule";

// Components
import { ExamCard } from "./components/ExamCard";
import { ExamGrid } from "./components/ExamGrid";
import { ExamManualModal } from "./components/ExamManualModal";
import { ExamSchoolAutoModal } from "./components/ExamSchoolAutoModal";

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

  // 2. UI State
  const [viewMode, setViewMode] = useState<"GRID" | "CARDS">("GRID");
  const [activeClassId, setActiveClassId] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTool, setEditTool] = useState<"MOVE" | "SWAP">("MOVE"); // NEW

  // Modal States
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);

  // 3. Filtering Logic
  const filteredExams = useMemo(() => {
    let list = [...exams];

    // Filter by Class
    if (activeClassId !== "ALL") {
      list = list.filter((e) => e.classIds.includes(activeClassId));
    }

    // Filter by Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const subject = data.subjects.find((s) => s.id === e.subjectId);
        const teacher = data.teachers.find((t) => t.id === e.invigilatorId);
        return (
          subject?.name.toLowerCase().includes(q) ||
          teacher?.name.toLowerCase().includes(q) ||
          e.paperLabel?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  }, [exams, activeClassId, searchQuery, data.subjects, data.teachers]);

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

  return (
    <div className="flex h-full bg-slate-50">
      {/* SIDEBAR: Class Filters */}
      <div className="w-56 bg-white border-r border-slate-200 flex flex-col h-full shrink-0">
        <div className="p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-amber-500" />
            Exam Classes
          </h2>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
          {data.classes.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setActiveClassId(cls.id === activeClassId ? "ALL" : cls.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2 ${
                activeClassId === cls.id
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "text-slate-600 hover:bg-slate-50 border border-transparent"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  activeClassId === cls.id ? "bg-amber-500" : "bg-slate-300"
                }`}
              />
              {cls.name}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Back Button */}
            <button
              onClick={() => onNavigate && onNavigate("DASHBOARD")}
              className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 mr-2"
              title="Back to Dashboard"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="relative w-64">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <Input
                placeholder="Search exams..."
                className="pl-9 focus:ring-amber-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View Toggles */}
            <div className="flex bg-slate-100 p-1 rounded-md border border-slate-200">
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
                onClick={() => setViewMode("CARDS")}
                className={`p-1.5 rounded ${
                  viewMode === "CARDS"
                    ? "bg-white shadow-sm text-amber-600"
                    : "text-slate-400 hover:text-slate-600"
                }`}
                title="List/Card View"
              >
                <List size={16} />
              </button>
            </div>

            {/* Edit Mode Toggle (New) */}
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
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
          </div>

          <div className="flex items-center gap-3">
            {/* Clear Button */}
            <Button
              variant="secondary"
              className="text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={handleClearAll}
              title="Clear All Exams"
            >
              <Eraser size={18} />
            </Button>

            {/* Auto-Generate Button */}
            <Button
              variant="secondary"
              className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50 hover:border-amber-300"
              onClick={() => setAutoModalOpen(true)}
            >
              <Wand2 size={16} />
              Auto Schedule
            </Button>

            {/* Manual Add Button */}
            <Button
              className="gap-2 bg-amber-500 hover:bg-amber-600 text-white border border-amber-600"
              onClick={() => {
                setEditingExam(null);
                setManualModalOpen(true);
              }}
            >
              <Plus size={16} />
              Add Exam
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
              isEditMode={isEditMode} // PASS EDIT MODE
            />
          )}

          {/* CARD VIEW (Kanban/List) */}
          {viewMode === "CARDS" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  subject={data.subjects.find((s) => s.id === exam.subjectId)}
                  teacher={data.teachers.find(
                    (t) => t.id === exam.invigilatorId
                  )}
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
        activeClassId={activeClassId}
        editingExam={editingExam}
        onSave={handleSaveManual}
      />

      <ExamSchoolAutoModal
        isOpen={autoModalOpen}
        onClose={() => setAutoModalOpen(false)}
        data={data}
        onSave={bulkAddExams}
      />
    </div>
  );
};
