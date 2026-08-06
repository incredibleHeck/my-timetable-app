import React, { useState, useEffect, useMemo } from "react";
import { AppData, ExamSession } from "../../../types";
import { Modal, Button, Select, controlClass } from "../../../components/ui";
import { generateId } from "../../../utils/utils";
import { useToast } from "../../../components/ui/Toast";
import { toLocalDateString } from "../logic/examUtils";
import { validateExamMove } from "../logic/examValidation";
import { ExamStatus } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  activeId: string;
  editingExam: ExamSession | null;
  onSave: (exam: ExamSession | ExamSession[]) => void;
}

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({
  id,
  label,
  children,
}) => (
  <div className="min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-content">
      {label}
    </label>
    {children}
  </div>
);

export const ExamManualModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  activeId,
  editingExam,
  onSave,
}) => {
  const { showToast } = useToast();
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examClassIds, setExamClassIds] = useState<string[]>([]);
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("09:00");
  const [examDuration, setExamDuration] = useState("120");
  const [examInvigilatorIds, setExamInvigilatorIds] = useState<string[]>([]);
  const [examRoomId, setExamRoomId] = useState("");

  const [paperNumber, setPaperNumber] = useState("1");
  const [paperLabel, setPaperLabel] = useState("Paper 1");
  const [hasTwoPapers, setHasTwoPapers] = useState(false);
  const [paper2StartTime, setPaper2StartTime] = useState("14:00");
  const [examLocked, setExamLocked] = useState(false);
  const [examStatus, setExamStatus] = useState<ExamStatus>("DRAFT");

  useEffect(() => {
    if (editingExam) {
      setExamSubjectId(editingExam.subjectId);
      setExamClassIds(editingExam.classIds);
      setExamDate(editingExam.date);
      setExamStartTime(editingExam.startTime);
      setExamDuration(editingExam.duration.toString());
      setExamInvigilatorIds(editingExam.invigilatorIds || []);
      setExamRoomId(editingExam.roomId || "");
      setPaperNumber(editingExam.paperNumber?.toString() || "1");
      setPaperLabel(editingExam.paperLabel || `Paper ${editingExam.paperNumber || 1}`);
      setExamLocked(!!editingExam.locked);
      setExamStatus(editingExam.status || "DRAFT");

      const potentialPaper2 = data.exams?.find(
        (e) =>
          e.subjectId === editingExam.subjectId &&
          e.date === editingExam.date &&
          e.id !== editingExam.id &&
          e.paperNumber === 2 &&
          e.classIds.some((cid) => editingExam.classIds.includes(cid)),
      );

      if (potentialPaper2) {
        setHasTwoPapers(true);
        setPaper2StartTime(potentialPaper2.startTime);
      } else {
        setHasTwoPapers(editingExam.paperNumber === 2);
      }
    } else {
      setExamSubjectId(data.subjects[0]?.id || "");
      setExamClassIds(activeId !== "ALL" ? [activeId] : []);
      setExamDate(toLocalDateString(new Date()));
      setExamStartTime("09:00");
      setPaper2StartTime("14:00");
      setExamDuration("120");
      setExamInvigilatorIds([]);
      setExamRoomId("");
      setPaperNumber("1");
      setPaperLabel("Paper 1");
      setHasTwoPapers(false);
      setExamLocked(false);
      setExamStatus("DRAFT");
    }
  }, [editingExam, isOpen, data.subjects, data.exams, activeId]);

  const validateSessions = (sessions: ExamSession[], excludeIds: string[]): boolean => {
    const others = (data.exams || []).filter((e) => !excludeIds.includes(e.id));
    for (const session of sessions) {
      const critical = validateExamMove(session, others, data).filter(
        (c) => c.severity === "CRITICAL",
      );
      if (critical.length > 0) {
        showToast(critical[0].message, "error");
        return false;
      }
    }
    return true;
  };

  const handleClassToggle = (clsId: string) => {
    setExamClassIds((prev) =>
      prev.includes(clsId) ? prev.filter((id) => id !== clsId) : [...prev, clsId],
    );
  };

  const handleInvigilatorToggle = (tId: string) => {
    setExamInvigilatorIds((prev) =>
      prev.includes(tId) ? prev.filter((id) => id !== tId) : [...prev, tId],
    );
  };

  const handleSave = () => {
    if (!examSubjectId || !examDate) {
      showToast("Choose a subject and a date.", "error");
      return;
    }
    if (examClassIds.length === 0) {
      showToast("Choose at least one class.", "error");
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
      paperLabel,
      status: examStatus,
      locked: examLocked,
    };

    if (hasTwoPapers) {
      const paper1 = {
        ...baseExam,
        paperNumber: 1,
        paperLabel: "Paper 1",
        startTime: examStartTime,
      };

      let existingP2: ExamSession | undefined;
      if (editingExam) {
        existingP2 = data.exams?.find(
          (e) =>
            e.subjectId === paper1.subjectId &&
            e.date === paper1.date &&
            e.paperNumber === 2 &&
            e.classIds.some((cid) => paper1.classIds.includes(cid)),
        );
      }

      const paper2: ExamSession = {
        ...baseExam,
        id: existingP2?.id ?? generateId(),
        startTime: paper2StartTime,
        paperNumber: 2,
        paperLabel: "Paper 2",
        roomId: existingP2?.roomId ?? (examRoomId || undefined),
        invigilatorIds: existingP2?.invigilatorIds ?? [],
      };

      const excludeIds = [paper1.id, paper2.id];
      if (!validateSessions([paper1, paper2], excludeIds)) return;
      onSave([paper1, paper2]);
    } else {
      const excludeIds = [baseExam.id].filter(Boolean);
      if (!validateSessions([baseExam], excludeIds)) return;
      onSave(baseExam);
    }

    onClose();
  };

  const sortedTeachers = useMemo(
    () => [...data.teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [data.teachers],
  );

  const sortedClasses = useMemo(
    () =>
      [...data.classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [data.classes],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingExam ? "Edit Exam Session" : "Schedule New Exam"}
      maxWidth="max-w-2xl"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{editingExam ? "Save Changes" : "Create Exam"}</Button>
        </div>
      }
    >
      <div className="custom-scrollbar max-h-[75vh] space-y-5 overflow-y-auto px-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field id="exam-subject" label="Subject">
              <select
                id="exam-subject"
                className={`${controlClass} w-full cursor-pointer`}
                value={examSubjectId}
                onChange={(e) => setExamSubjectId(e.target.value)}
              >
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id="exam-date" label="Date">
            <input
              id="exam-date"
              type="date"
              className={`${controlClass} w-full`}
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
          </Field>
          <Field id="exam-duration" label="Duration (min)">
            <input
              id="exam-duration"
              type="number"
              className={`${controlClass} w-full`}
              value={examDuration}
              onChange={(e) => setExamDuration(e.target.value)}
            />
          </Field>
          <Select
            label="Status"
            value={examStatus}
            onChange={(e) => setExamStatus(e.target.value as ExamStatus)}
            options={[
              { value: "DRAFT", label: "Draft" },
              { value: "PUBLISHED", label: "Published" },
              { value: "COMPLETED", label: "Completed" },
            ]}
          />
        </div>

        <div className="rounded-md border border-edge bg-surface p-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-content">
            <input
              type="checkbox"
              checked={hasTwoPapers}
              onChange={(e) => setHasTwoPapers(e.target.checked)}
              className="h-4 w-4 rounded border-edge-strong text-accent focus:ring-accent"
            />
            Schedule two papers
          </label>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Field id="exam-p1-start" label="Paper 1 start">
              <input
                id="exam-p1-start"
                type="time"
                className={`${controlClass} w-full`}
                value={examStartTime}
                onChange={(e) => setExamStartTime(e.target.value)}
              />
            </Field>
            {hasTwoPapers && (
              <Field id="exam-p2-start" label="Paper 2 start">
                <input
                  id="exam-p2-start"
                  type="time"
                  className={`${controlClass} w-full`}
                  value={paper2StartTime}
                  onChange={(e) => setPaper2StartTime(e.target.value)}
                />
              </Field>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-sm font-medium text-content">Participating Classes</h4>
            {examClassIds.length === 0 && (
              <span className="text-2xs text-danger-ink">Pick at least one</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortedClasses.map((cls) => {
              const isOn = examClassIds.includes(cls.id);
              return (
                <button
                  key={cls.id}
                  type="button"
                  aria-pressed={isOn}
                  onClick={() => handleClassToggle(cls.id)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    isOn
                      ? "border-accent bg-accent/15 font-medium text-content"
                      : "border-edge text-content-secondary hover:border-edge-strong"
                  }`}
                >
                  {cls.name}
                </button>
              );
            })}
          </div>
        </div>

        <Field id="exam-room" label="Room">
          <select
            id="exam-room"
            className={`${controlClass} w-full cursor-pointer`}
            value={examRoomId}
            onChange={(e) => setExamRoomId(e.target.value)}
          >
            <option value="">Each class in its own home room</option>
            {data.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h4 className="text-sm font-medium text-content">Invigilators</h4>
            <span className="text-2xs tabular-nums text-content-muted">
              {examInvigilatorIds.length} selected
            </span>
          </div>
          <div className="custom-scrollbar max-h-40 overflow-y-auto rounded-md border border-edge">
            <ul className="grid grid-cols-2">
              {sortedTeachers.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2 border-b border-edge-subtle px-2.5 py-1.5 text-xs hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={examInvigilatorIds.includes(t.id)}
                      onChange={() => handleInvigilatorToggle(t.id)}
                      className="h-3.5 w-3.5 rounded border-edge-strong text-accent focus:ring-accent"
                    />
                    <span className="truncate text-content-secondary">{t.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-content-secondary">
          <input
            type="checkbox"
            checked={examLocked}
            onChange={(e) => setExamLocked(e.target.checked)}
            className="h-4 w-4 rounded border-edge-strong text-accent focus:ring-accent"
          />
          Lock invigilators (kept when re-running Assign staff)
        </label>
      </div>
    </Modal>
  );
};
