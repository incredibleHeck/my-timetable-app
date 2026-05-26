import React, { useState, useEffect, useMemo } from "react";
import { AppData, ExamSession } from "../../../types";
import { Modal, Button, Select, Input } from "../../../components/ui";
import { Layers, Users, BookOpen, Clock } from "lucide-react";
import { generateId } from "../../../utils/utils";
import { useToast } from "../../../components/ui/Toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  activeId: string;
  editingExam: ExamSession | null;
  onSave: (exam: ExamSession | ExamSession[]) => void;
}

export const ExamManualModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  activeId,
  editingExam,
  onSave,
}) => {
  const { showToast } = useToast();
  // --- FORM STATE ---
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examClassIds, setExamClassIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("09:00");
  const [examDuration, setExamDuration] = useState("120");
  const [examInvigilatorIds, setExamInvigilatorIds] = useState<string[]>([]);
  const [examRoomId, setExamRoomId] = useState("");

  // Multi-Paper Fields
  const [paperNumber, setPaperNumber] = useState("1");
  const [paperLabel, setPaperLabel] = useState("Paper 1");
  const [hasTwoPapers, setHasTwoPapers] = useState(false);
  const [paper2StartTime, setPaper2StartTime] = useState("14:00");

  // --- INITIALIZATION ---
  useEffect(() => {
    if (editingExam) {
      // EDIT MODE
      setExamSubjectId(editingExam.subjectId);
      setExamClassIds(editingExam.classIds);
      setExamDate(editingExam.date);
      setExamStartTime(editingExam.startTime);
      setExamDuration(editingExam.duration.toString());
      setExamInvigilatorIds(editingExam.invigilatorIds || []);
      setExamRoomId(editingExam.roomId || "");
      setPaperNumber(editingExam.paperNumber?.toString() || "1");
      setPaperLabel(
        editingExam.paperLabel || `Paper ${editingExam.paperNumber || 1}`
      );

      // Smart Detection: Does a "Paper 2" already exist for this group?
      // We look for same Subject + Date + At least one overlapping class
      const potentialPaper2 = data.exams?.find(
        (e) =>
          e.subjectId === editingExam.subjectId &&
          e.date === editingExam.date &&
          e.id !== editingExam.id &&
          e.paperNumber === 2 &&
          e.classIds.some((cid) => editingExam.classIds.includes(cid))
      );

      if (potentialPaper2) {
        setHasTwoPapers(true);
        setPaper2StartTime(potentialPaper2.startTime);
      } else {
        // Fallback: If current exam IS paper 2, maybe Paper 1 is the sibling?
        // For now, simpler to just assume we are editing the primary record.
        setHasTwoPapers(editingExam.paperNumber === 2);
      }
    } else {
      // CREATE MODE
      setExamSubjectId(data.subjects[0]?.id || "");

      // If a specific class filter is active in the grid, auto-select it
      setExamClassIds(activeId !== "ALL" ? [activeId] : []);

      setExamDate(new Date().toISOString().split("T")[0]);
      setExamStartTime("09:00");
      setPaper2StartTime("14:00");
      setExamDuration("120");
      setExamInvigilatorIds([]);
      setExamRoomId("");
      setPaperNumber("1");
      setPaperLabel("Paper 1");
      setHasTwoPapers(false);
    }
  }, [editingExam, isOpen, data.subjects, data.exams, activeId]);

  // --- HANDLERS ---

  const handleClassToggle = (clsId: string) => {
    setExamClassIds((prev) =>
      prev.includes(clsId)
        ? prev.filter((id) => id !== clsId)
        : [...prev, clsId]
    );
  };

  const handleInvigilatorToggle = (tId: string) => {
    setExamInvigilatorIds((prev) =>
      prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId]
    );
  };

  const handleSave = () => {
    if (!examSubjectId || !examDate) {
      showToast("Please select a Subject and Date.", "error");
      return;
    }
    if (examClassIds.length === 0) {
      showToast("Please select at least one Class.", "error");
      return;
    }

    const baseExam: ExamSession = {
      id: editingExam ? editingExam.id : generateId(),
      subjectId: examSubjectId,
      classIds: examClassIds,
      date: examDate,
      startTime: examStartTime,
      duration: parseInt(examDuration) || 60,
      invigilatorIds: examInvigilatorIds,
      roomId: examRoomId || undefined,
      paperNumber: parseInt(paperNumber) || 1,
      paperLabel: paperLabel,
      status: editingExam ? editingExam.status : "DRAFT",
      locked: editingExam ? editingExam.locked : false,
    };

    if (hasTwoPapers) {
      // 1. Prepare Paper 1
      const paper1 = {
        ...baseExam,
        paperNumber: 1,
        paperLabel: "Paper 1",
        startTime: examStartTime, // User-defined P1 time
      };

      // 2. Prepare Paper 2
      const paper2: ExamSession = {
        ...baseExam,
        id: generateId(), // Default to new ID
        startTime: paper2StartTime, // User-defined P2 time
        paperNumber: 2,
        paperLabel: "Paper 2",
        roomId: undefined, // Usually P2 room needs re-confirmation or same? Leaving blank is safer to avoid conflicts.
        invigilatorIds: [], // Clear invigilators for P2 as they are likely different
      };

      // 3. Try to find existing Paper 2 ID to update instead of creating duplicate
      if (editingExam) {
        const existingP2 = data.exams?.find(
          (e) =>
            e.subjectId === paper1.subjectId &&
            e.date === paper1.date &&
            e.paperNumber === 2 &&
            // Matches any of the selected classes (Loose matching)
            e.classIds.some((cid) => paper1.classIds.includes(cid))
        );

        if (existingP2) {
          paper2.id = existingP2.id;
          // Optionally preserve existing P2 staff/room if not explicitly cleared
          // paper2.invigilatorIds = existingP2.invigilatorIds;
        }
      }

      onSave([paper1, paper2]);
    } else {
      onSave(baseExam);
    }

    onClose();
  };

  // Sorted Lists for UI
  const sortedTeachers = useMemo(
    () => [...data.teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [data.teachers]
  );

  const sortedClasses = useMemo(
    () =>
      [...data.classes].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true })
      ),
    [data.classes]
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingExam ? "Edit Exam Session" : "Schedule New Exam"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {editingExam ? "Save Changes" : "Create Exam"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 max-h-[75vh] overflow-y-auto px-1 custom-scrollbar">
        {/* SECTION 1: CORE DETAILS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Select
              label="Subject"
              value={examSubjectId}
              onChange={(e) => setExamSubjectId(e.target.value)}
              options={data.subjects.map((s) => ({
                value: s.id,
                label: s.name,
              }))}
            />
          </div>

          <Input
            label="Date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />

          <Input
            label="Duration (minutes)"
            type="number"
            value={examDuration}
            onChange={(e) => setExamDuration(e.target.value)}
          />
        </div>

        {/* SECTION 2: PAPER CONFIGURATION */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
              <Layers size={14} /> Session Configuration
            </h4>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-slate-700">
              <input
                type="checkbox"
                checked={hasTwoPapers}
                onChange={(e) => setHasTwoPapers(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              Schedule Two Papers
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Paper 1 Config */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">
                Paper 1 Start
              </label>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <input
                  type="time"
                  value={examStartTime}
                  onChange={(e) => setExamStartTime(e.target.value)}
                  className="flex-1 text-sm border-slate-200 rounded-md shadow-sm"
                />
              </div>
            </div>

            {/* Paper 2 Config (Conditional) */}
            {hasTwoPapers && (
              <div className="space-y-2 animate-in fade-in">
                <label className="text-xs font-bold text-slate-400">
                  Paper 2 Start
                </label>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-500" />
                  <input
                    type="time"
                    value={paper2StartTime}
                    onChange={(e) => setPaper2StartTime(e.target.value)}
                    className="flex-1 text-sm border-amber-200 ring-1 ring-amber-100 rounded-md shadow-sm bg-amber-50/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: CLASSES */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2">
            <BookOpen size={14} /> Participating Classes
          </h4>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-white shadow-sm">
            {sortedClasses.map((cls) => (
              <label
                key={cls.id}
                className={`
                  flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer select-none transition-all border
                  ${
                    examClassIds.includes(cls.id)
                      ? "bg-amber-50 border-amber-300 text-amber-800 shadow-sm"
                      : "bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100"
                  }
                `}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={examClassIds.includes(cls.id)}
                  onChange={() => handleClassToggle(cls.id)}
                />
                <div
                  className={`w-2 h-2 rounded-full ${
                    examClassIds.includes(cls.id)
                      ? "bg-amber-500"
                      : "bg-slate-300"
                  }`}
                />
                {cls.name}
              </label>
            ))}
          </div>
          {examClassIds.length === 0 && (
            <p className="text-[10px] text-red-500 mt-1 font-bold">
              * Required
            </p>
          )}
        </div>

        {/* SECTION 4: RESOURCES (Invigilators & Room) */}
        <div className="grid grid-cols-1 gap-4 pt-2 border-t border-slate-100">
          {/* Room Select */}
          <Select
            label="Location / Room"
            value={examRoomId}
            onChange={(e) => setExamRoomId(e.target.value)}
            options={[
              { value: "", label: "TBD - Allocate Later" },
              ...data.rooms.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />

          {/* Invigilator Select */}
          <div>
            <div className="flex justify-between items-end mb-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                <Users size={14} /> Invigilators
              </h4>
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {examInvigilatorIds.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-slate-200 rounded-lg bg-slate-50/50">
              {sortedTeachers.map((t) => {
                const isSelected = examInvigilatorIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`
                        flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer select-none transition-all
                        ${
                          isSelected
                            ? "bg-white border-amber-300 text-amber-900 shadow-sm ring-1 ring-amber-100"
                            : "border-transparent hover:bg-white hover:border-slate-200 text-slate-600"
                        }
                      `}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={isSelected}
                      onChange={() => handleInvigilatorToggle(t.id)}
                    />
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? "bg-amber-500" : "bg-slate-300"
                      }`}
                    />
                    <span className="truncate">{t.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
