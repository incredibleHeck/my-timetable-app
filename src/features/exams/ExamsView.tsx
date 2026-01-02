import React, { useState, useMemo } from "react";
import { Plus, Calendar, Search, FileText, LayoutGrid, List, Printer, Eraser, Globe, Users } from "lucide-react";
import { AppData, ExamSession } from "../../types";
import { Button } from "../../components/ui";

// Refactored Components
import { ExamCard } from "./components/ExamCard";
import { ExamGrid } from "./components/ExamGrid";
import { ExamAutoModal } from "./components/ExamAutoModal";
import { ExamManualModal } from "./components/ExamManualModal";
import { ExamSchoolAutoModal } from "./components/ExamSchoolAutoModal";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ExamsView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const [viewMode, setViewMode] = useState<"GRID" | "CARDS">("GRID");
  const [activeClassId, setActiveClassId] = useState<string>("ALL");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [schoolAutoModalOpen, setSchoolAutoModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamSession | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const exams = data.exams || [];

  // Filter based on active sidebar selection and search
  const filteredExams = useMemo(() => {
    let list = [...exams].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.startTime.localeCompare(b.startTime);
    });

    // 1. Sidebar Class Filter
    if (activeClassId !== "ALL") {
      list = list.filter(e => e.classIds.includes(activeClassId));
    }

    // 2. Search Query Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((e) => {
        const subj = data.subjects.find((s) => s.id === e.subjectId)?.name.toLowerCase() || "";
        const classes = e.classIds.map((cid) => data.classes.find((c) => c.id === cid)?.name.toLowerCase()).join(" ");
        return subj.includes(q) || classes.includes(q);
      });
    }
    return list;
  }, [exams, searchQuery, activeClassId, data.subjects, data.classes]);

  const handleSaveExam = (exam: ExamSession) => {
    const exists = exams.find((e) => e.id === exam.id);
    const newExams = exists
      ? exams.map((e) => (e.id === exam.id ? exam : e))
      : [...exams, exam];
    onUpdate({ ...data, exams: newExams });
  };

  const handleBulkSave = (sessions: ExamSession[]) => {
    onUpdate({ ...data, exams: [...exams, ...sessions] });
  };

  const handleDeleteExam = (id: string) => {
    if (confirm("Delete this exam session?")) {
      onUpdate({ ...data, exams: exams.filter((e) => e.id !== id) });
    }
  };

  const handleClearAll = () => {
    if (exams.length === 0) {
      alert("No exams to clear.");
      return;
    }
    if (confirm(`Are you sure you want to erase ALL ${exams.length} scheduled exams? This action cannot be undone.`)) {
      onUpdate({ ...data, exams: [] });
    }
  };

  const checkConflicts = (exam: ExamSession) => {
    const conflicts: string[] = [];
    const otherExams = exams.filter((e) => e.id !== exam.id && e.date === exam.date);

    const start = new Date(`${exam.date}T${exam.startTime}`).getTime();
    const end = start + exam.duration * 60000;

    otherExams.forEach((o) => {
      const oStart = new Date(`${o.date}T${o.startTime}`).getTime();
      const oEnd = oStart + o.duration * 60000;

      const overlap = start < oEnd && end > oStart;
      if (overlap) {
        const sharedClasses = exam.classIds.filter(cid => o.classIds.includes(cid));
        if (sharedClasses.length > 0) {
          conflicts.push(`Student overlap: ${sharedClasses.map(cid => data.classes.find(c => c.id === cid)?.name).join(", ")}`);
        }
        if (exam.invigilatorId && o.invigilatorId === exam.invigilatorId) {
          conflicts.push(`Invigilator busy elsewhere`);
        }
      }
    });
    return conflicts;
  };

  const handlePrint = () => {
    window.print();
  };

  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [data.classes]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] p-6 gap-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            Exam Planning
            {activeClassId !== "ALL" && (
              <span className="text-[10px] font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                Viewing: {data.classes.find(c => c.id === activeClassId)?.name}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500">Coordinate and generate assessment timetables.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("GRID")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "GRID" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              title="Grid View"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setViewMode("CARDS")}
              className={`p-1.5 rounded-md transition-all ${viewMode === "CARDS" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
              title="Card View"
            >
              <List size={18} />
            </button>
          </div>
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              className="w-full pl-9 pr-4 py-2 text-xs border-slate-200 rounded-lg focus:ring-amber-500 focus:border-amber-500"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleClearAll} icon={<Eraser size={16} />}>Clear All</Button>
            <Button variant="secondary" onClick={handlePrint} icon={<Printer size={16} />}>Print</Button>
            <Button variant="secondary" onClick={() => setSchoolAutoModalOpen(true)} icon={<Globe size={16} />}>
              School Auto-Schedule
            </Button>
            <Button 
              onClick={() => { setEditingExam(null); setManualModalOpen(true); }} 
              icon={<Plus size={16} />}
              disabled={activeClassId === "ALL"}
              title={activeClassId === "ALL" ? "Select a class to add a session" : "Add session"}
            >
              Add Session
            </Button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA WITH SIDEBAR */}
      <div className="flex-1 flex overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm relative">
        {/* SIDEBAR */}
        <div className="w-56 border-r border-slate-100 bg-slate-50/50 flex flex-col shrink-0 print:hidden">
          <div className="p-4 border-b border-slate-100 font-bold text-[10px] text-slate-400 uppercase tracking-widest">
            Timetable View
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setActiveClassId("ALL")}
              className={`w-full text-left px-4 py-3 border-b border-slate-100 text-xs font-bold flex items-center gap-3 transition-colors ${activeClassId === "ALL" ? "bg-white border-l-4 border-l-amber-500 text-amber-600" : "text-slate-500 hover:bg-slate-100"}`}
            >
              <Globe size={14} /> School Overview
            </button>
            {sortedClasses.map(c => (
              <button
                key={c.id}
                onClick={() => setActiveClassId(c.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 text-xs font-medium flex items-center gap-3 transition-colors ${activeClassId === c.id ? "bg-white border-l-4 border-l-amber-500 text-slate-800" : "text-slate-500 hover:bg-slate-100"}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${activeClassId === c.id ? "bg-amber-500" : "bg-slate-300"}`} />
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto p-6 bg-slate-50/20 custom-scrollbar">
          {viewMode === "GRID" ? (
            <ExamGrid 
              data={data} 
              exams={filteredExams} 
              onEdit={(exam) => { setEditingExam(exam); setManualModalOpen(true); }}
              checkConflicts={checkConflicts}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  subject={data.subjects.find(s => s.id === exam.subjectId)}
                  teacher={data.teachers.find(t => t.id === exam.invigilatorId)}
                  classes={data.classes}
                  conflicts={checkConflicts(exam)}
                  onEdit={() => { setEditingExam(exam); setManualModalOpen(true); }}
                  onDelete={() => handleDeleteExam(exam.id)}
                />
              ))}
            </div>
          )}

          {filteredExams.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
              <FileText size={48} className="mb-4 opacity-20" />
              <p className="font-medium">No exams found for this selection.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      <ExamManualModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        data={data}
        activeClassId={activeClassId}
        editingExam={editingExam}
        onSave={handleSaveExam}
      />

      <ExamAutoModal
        isOpen={autoModalOpen}
        onClose={() => setAutoModalOpen(false)}
        data={data}
        onSave={handleBulkSave}
      />

      <ExamSchoolAutoModal
        isOpen={schoolAutoModalOpen}
        onClose={() => setSchoolAutoModalOpen(false)}
        data={data}
        onSave={handleBulkSave}
      />
    </div>
  );
};
