import React, { useState, useEffect } from "react";
import { AppData, ExamSession } from "../../../types";
import { Modal, Button, Select, Input } from "../../../components/ui";
import { Layers } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  activeClassId: string;
  editingExam: ExamSession | null;
  onSave: (exam: ExamSession | ExamSession[]) => void;
}

export const ExamManualModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  activeClassId,
  editingExam,
  onSave,
}) => {
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examClassIds, setExamClassIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("09:00");
  const [examDuration, setExamDuration] = useState("120");
  const [examInvigilatorId, setExamInvigilatorId] = useState("");
  const [examRoomId, setExamRoomId] = useState("");

  // Multi-Paper Fields
  const [paperNumber, setPaperNumber] = useState("1");
  const [paperLabel, setPaperLabel] = useState("Paper 1");
  const [hasTwoPapers, setHasTwoPapers] = useState(false);

  useEffect(() => {
    if (editingExam) {
      setExamSubjectId(editingExam.subjectId);
      setExamClassIds(editingExam.classIds);
      setExamDate(editingExam.date);
      setExamStartTime(editingExam.startTime);
      setExamDuration(editingExam.duration.toString());
      setExamInvigilatorId(editingExam.invigilatorId || "");
      setExamRoomId(editingExam.roomId || "");

      setPaperNumber(editingExam.paperNumber?.toString() || "1");
      setPaperLabel(
        editingExam.paperLabel || `Paper ${editingExam.paperNumber || 1}`
      );

      // Auto-detect if multi-paper
      if (
        editingExam.paperNumber > 1 ||
        editingExam.paperLabel?.includes("Paper")
      ) {
        setHasTwoPapers(true);
      }
    } else {
      setExamSubjectId(data.subjects[0]?.id || "");
      setExamClassIds(activeClassId !== "ALL" ? [activeClassId] : []);
      setExamDate(new Date().toISOString().split("T")[0]);
      setExamStartTime("09:00");
      setExamDuration("120");
      setExamInvigilatorId("");
      setExamRoomId("");
      setPaperNumber("1");
      setPaperLabel("Paper 1");
      setHasTwoPapers(false);
    }
  }, [editingExam, isOpen, activeClassId, data.subjects]);

  const handleSave = () => {
    if (!examSubjectId || !examDate) return;

    const finalClassIds =
      examClassIds.length > 0
        ? examClassIds
        : activeClassId !== "ALL"
        ? [activeClassId]
        : [];

    const baseExam: ExamSession = {
      id: editingExam ? editingExam.id : crypto.randomUUID(),
      subjectId: examSubjectId,
      classIds: finalClassIds,
      date: examDate,
      startTime: examStartTime,
      duration: parseInt(examDuration),
      invigilatorId: examInvigilatorId || undefined,
      roomId: examRoomId || undefined,
      paperNumber: parseInt(paperNumber),
      paperLabel: paperLabel,
      status: editingExam ? editingExam.status : "DRAFT",
      locked: editingExam ? editingExam.locked : false,
    };

    // LOGIC: If "Has Two Papers" is checked
    if (hasTwoPapers) {
      // 1. Force current exam to be Paper 1 (if user didn't change it manually)
      const paper1 = {
        ...baseExam,
        paperNumber: 1,
        paperLabel: "Paper 1",
      };

      // 2. Create Paper 2 (scheduled for tomorrow)
      // Note: In a real app, we might check if Paper 2 already exists to avoid duplication.
      // Here, we assume if the user clicks this on edit, they want to generate the missing part.
      const nextDay = new Date(examDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const paper2 = {
        ...baseExam,
        id: crypto.randomUUID(), // Always new ID for the second paper
        date: nextDay.toISOString().split("T")[0],
        paperNumber: 2,
        paperLabel: "Paper 2",
      };

      // Return both (Upsert will update Paper 1 and insert Paper 2)
      onSave([paper1, paper2]);
    } else {
      onSave(baseExam);
    }

    onClose();
  };

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
          <Button onClick={handleSave}>Save Exam</Button>
        </div>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {/* Subject & Paper Details */}
        <div className="space-y-3 border-b border-slate-100 pb-4">
          <Select
            label="Subject"
            value={examSubjectId}
            onChange={(e) => setExamSubjectId(e.target.value)}
            options={data.subjects.map((s) => ({ value: s.id, label: s.name }))}
          />

          <div className="bg-slate-50 p-3 rounded border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="hasTwoPapers"
                checked={hasTwoPapers}
                onChange={(e) => setHasTwoPapers(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label
                htmlFor="hasTwoPapers"
                className="text-sm font-medium text-slate-700 cursor-pointer flex items-center gap-2"
              >
                <Layers size={14} className="text-amber-500" />
                Has Two Papers
              </label>
            </div>

            <div
              className={`grid grid-cols-3 gap-4 transition-all ${
                hasTwoPapers ? "opacity-100" : "opacity-50 grayscale"
              }`}
            >
              <div className="col-span-1">
                <Input
                  label="Paper #"
                  type="number"
                  min="1"
                  value={paperNumber}
                  onChange={(e) => setPaperNumber(e.target.value)}
                />
              </div>
              <div className="col-span-2">
                <Input
                  label="Label"
                  value={paperLabel}
                  onChange={(e) => setPaperLabel(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Date, Time, Duration, Resources... */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Date"
            type="date"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
          />
          <Input
            label="Start Time"
            type="time"
            value={examStartTime}
            onChange={(e) => setExamStartTime(e.target.value)}
          />
        </div>
        <Input
          label="Duration (min)"
          type="number"
          value={examDuration}
          onChange={(e) => setExamDuration(e.target.value)}
        />

        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase">
            Resources
          </h4>
          <Select
            label="Room"
            value={examRoomId}
            onChange={(e) => setExamRoomId(e.target.value)}
            options={[
              { value: "", label: "-- Allocate Later --" },
              ...data.rooms.map((r) => ({ value: r.id, label: r.name })),
            ]}
          />
          <Select
            label="Invigilator"
            value={examInvigilatorId}
            onChange={(e) => setExamInvigilatorId(e.target.value)}
            options={[
              { value: "", label: "-- Unassigned --" },
              ...data.teachers.map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>
      </div>
    </Modal>
  );
};
