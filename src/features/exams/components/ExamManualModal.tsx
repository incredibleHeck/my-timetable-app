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
  const [paper2StartTime, setPaper2StartTime] = useState("14:00");

  useEffect(() => {
    if (editingExam) {
      setExamSubjectId(editingExam.subjectId);
      
      // SCOPE LOGIC: If a specific class is selected in the view, 
      // default the modal to ONLY that class (forcing a split on save).
      // Otherwise, load all classes from the exam.
      if (activeClassId !== "ALL" && editingExam.classIds.includes(activeClassId)) {
        setExamClassIds([activeClassId]);
      } else {
        setExamClassIds(editingExam.classIds);
      }

      setExamDate(editingExam.date);
      setExamStartTime(editingExam.startTime);
      setExamDuration(editingExam.duration.toString());
      setExamInvigilatorId(editingExam.invigilatorId || "");
      setExamRoomId(editingExam.roomId || "");

      setPaperNumber(editingExam.paperNumber?.toString() || "1");
      setPaperLabel(
        editingExam.paperLabel || `Paper ${editingExam.paperNumber || 1}`
      );

      // Check if there are other papers for this subject/date/class to set hasTwoPapers
      const others = data.exams?.filter(
        (e) =>
          e.subjectId === editingExam.subjectId &&
          e.date === editingExam.date &&
          e.id !== editingExam.id &&
          JSON.stringify(e.classIds.sort()) ===
            JSON.stringify(editingExam.classIds.sort())
      );

      if (others && others.length > 0) {
        setHasTwoPapers(true);
        const p2 = others.find((o) => o.paperNumber === 2) || others[0];
        setPaper2StartTime(p2.startTime);
      } else {
        setHasTwoPapers(false);
      }
    } else {
      setExamSubjectId(data.subjects[0]?.id || "");
      setExamClassIds(activeClassId !== "ALL" ? [activeClassId] : []);
      setExamDate(new Date().toISOString().split("T")[0]);
      setExamStartTime("09:00");
      setPaper2StartTime("14:00");
      setExamDuration("120");
      setExamInvigilatorId("");
      setExamRoomId("");
      setPaperNumber("1");
      setPaperLabel("Paper 1");
      setHasTwoPapers(false);
    }
  }, [editingExam, isOpen, activeClassId, data.subjects, data.exams]);

  const handleSave = () => {
    if (!examSubjectId || !examDate) return;

    const finalClassIds = examClassIds; // Just use what is selected in the UI

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
      // 1. Force current exam to be Paper 1
      const paper1 = {
        ...baseExam,
        paperNumber: 1,
        paperLabel: "Paper 1",
        startTime: examStartTime,
      };

      // 2. Create Paper 2 (On the SAME day, but different time)
      const paper2: ExamSession = {
        ...baseExam,
        id: crypto.randomUUID(), // New ID
        date: examDate, // SAME DATE
        startTime: paper2StartTime, // SECOND TIME
        paperNumber: 2,
        paperLabel: "Paper 2",
      };

      // Check if Paper 2 already exists in editing mode to avoid duplicates
      if (editingExam) {
        const existingP2 = data.exams?.find(
          (e) =>
            e.subjectId === paper1.subjectId &&
            e.date === paper1.date &&
            e.paperNumber === 2 &&
            JSON.stringify(e.classIds.sort()) ===
              JSON.stringify(paper1.classIds.sort())
        );
        if (existingP2) {
          paper2.id = existingP2.id;
        }
      }

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

            {hasTwoPapers && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <Input
                  label="Paper 1 Time"
                  type="time"
                  value={examStartTime}
                  onChange={(e) => setExamStartTime(e.target.value)}
                />
                <Input
                  label="Paper 2 Time"
                  type="time"
                  value={paper2StartTime}
                  onChange={(e) => setPaper2StartTime(e.target.value)}
                />
              </div>
            )}
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
          {!hasTwoPapers && (
            <Input
              label="Start Time"
              type="time"
              value={examStartTime}
              onChange={(e) => setExamStartTime(e.target.value)}
            />
          )}
        </div>
        <Input
          label="Duration (min)"
          type="number"
          value={examDuration}
          onChange={(e) => setExamDuration(e.target.value)}
        />

        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-bold text-slate-400 uppercase">
            Participating Classes
          </h4>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded bg-slate-50">
            {data.classes.map((cls) => (
              <label
                key={cls.id}
                className={`flex items-center gap-2 px-2 py-1 rounded border text-xs cursor-pointer select-none transition-colors ${
                  examClassIds.includes(cls.id)
                    ? "bg-amber-100 border-amber-300 text-amber-800"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <input
                  type="checkbox"
                  className="hidden"
                  checked={examClassIds.includes(cls.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setExamClassIds([...examClassIds, cls.id]);
                    } else {
                      setExamClassIds(examClassIds.filter((id) => id !== cls.id));
                    }
                  }}
                />
                {cls.name}
              </label>
            ))}
          </div>
        </div>

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
