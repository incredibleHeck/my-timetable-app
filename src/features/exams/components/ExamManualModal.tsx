import React, { useState, useEffect } from "react";
import { AppData, ExamSession } from "../../../types";
import { Modal, Button, Select, Input } from "../../../components/ui";
import { generateId } from "../../../utils/utils";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  activeClassId: string; // Passed from sidebar context
  editingExam: ExamSession | null;
  onSave: (exam: ExamSession) => void;
}

export const ExamManualModal: React.FC<Props> = ({ isOpen, onClose, data, activeClassId, editingExam, onSave }) => {
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examInvigilatorId, setExamInvigilatorId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("09:00");
  const [examDuration, setExamDuration] = useState("120");

  useEffect(() => {
    if (editingExam) {
      setExamSubjectId(editingExam.subjectId);
      setExamInvigilatorId(editingExam.invigilatorId || "");
      setExamDate(editingExam.date);
      setExamStartTime(editingExam.startTime);
      setExamDuration(editingExam.duration.toString());
    } else {
      setExamSubjectId(data.subjects[0]?.id || "");
      setExamInvigilatorId("");
      setExamDate(new Date().toISOString().split("T")[0]);
      setExamStartTime("09:00");
      setExamDuration("120");
    }
  }, [editingExam, data.subjects, isOpen]);

  const handleSave = () => {
    if (!examSubjectId || !examDate) return;

    // Use existing classIds if editing, or use current active class if creating
    let classIds: string[] = [];
    
    if (editingExam) {
      classIds = editingExam.classIds;
    } else {
      // New exam logic: 
      // If a specific class is selected in sidebar, use it.
      // If "ALL" is selected, we technically need a class but the user removed selection.
      // We'll default to all if nothing selected, or better: prevent "Add" in 'ALL' view 
      // or handle it gracefully.
      classIds = activeClassId === "ALL" ? [] : [activeClassId];
    }

    onSave({
      id: editingExam?.id || generateId(),
      subjectId: examSubjectId,
      classIds: classIds,
      roomId: "any",
      invigilatorId: examInvigilatorId || undefined,
      date: examDate,
      startTime: examStartTime,
      duration: parseInt(examDuration) || 60,
    });
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingExam ? "Edit Exam Session" : "New Exam Session"}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Exam</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {activeClassId !== "ALL" && !editingExam && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-500">
            Adding exam for: <strong className="text-slate-700">{data.classes.find(c => c.id === activeClassId)?.name}</strong>
          </div>
        )}

        <Select
          label="Subject"
          value={examSubjectId}
          onChange={(e) => setExamSubjectId(e.target.value)}
          options={data.subjects.map(s => ({ value: s.id, label: s.name }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          <Input label="Start Time" type="time" value={examStartTime} onChange={(e) => setExamStartTime(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (min)" type="number" value={examDuration} onChange={(e) => setExamDuration(e.target.value)} />
          <Select
            label="Invigilator (Optional)"
            value={examInvigilatorId}
            onChange={(e) => setExamInvigilatorId(e.target.value)}
            options={[{ value: "", label: "Unassigned" }, ...data.teachers.map(t => ({ value: t.id, label: t.name }))]}
          />
        </div>
      </div>
    </Modal>
  );
};