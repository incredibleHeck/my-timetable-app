import { useState, useCallback, useEffect } from "react";
import { AppData, ExamSession } from "../../../types";

export const useExamSchedule = (
  initialData: AppData,
  onUpdate: (data: AppData) => void
) => {
  const [exams, setExams] = useState<ExamSession[]>(initialData.exams || []);

  useEffect(() => {
    setExams(initialData.exams || []);
  }, [initialData.exams]);

  // ... [Keep validateExam logic unchanged] ...
  const validateExam = useCallback(
    (exam: ExamSession, currentExams: ExamSession[]): string[] => {
      // ... [Same conflict logic as before] ...
      const errors: string[] = [];
      // (Rest of validation code...)
      return errors;
    },
    []
  );

  // --- CRUD OPERATIONS ---

  const addExam = (exam: ExamSession) => {
    const newExams = [...exams, exam];
    setExams(newExams);
    onUpdate({ ...initialData, exams: newExams });
  };

  const updateExam = (exam: ExamSession) => {
    const newExams = exams.map((e) => (e.id === exam.id ? exam : e));
    setExams(newExams);
    onUpdate({ ...initialData, exams: newExams });
  };

  const deleteExam = (id: string) => {
    const newExams = exams.filter((e) => e.id !== id);
    setExams(newExams);
    onUpdate({ ...initialData, exams: newExams });
  };

  const bulkAddExams = (newSessions: ExamSession[]) => {
    const combined = [...exams, ...newSessions];
    setExams(combined);
    onUpdate({ ...initialData, exams: combined });
  };

  // NEW: Smart Batch Update (Updates existing IDs, Adds new IDs)
  const upsertExams = (sessions: ExamSession[]) => {
    let currentList = [...exams];

    sessions.forEach((incoming) => {
      const index = currentList.findIndex((e) => e.id === incoming.id);
      if (index >= 0) {
        // Update existing
        currentList[index] = incoming;
      } else {
        // Add new
        currentList.push(incoming);
      }
    });

    setExams(currentList);
    onUpdate({ ...initialData, exams: currentList });
  };

  const clearAllExams = () => {
    setExams([]);
    onUpdate({ ...initialData, exams: [] });
  };

  // --- DRAG AND DROP ---
  const swapExams = (id1: string, id2: string) => {
    const e1Index = exams.findIndex((e) => e.id === id1);
    const e2Index = exams.findIndex((e) => e.id === id2);
    if (e1Index === -1 || e2Index === -1) return;

    const newExams = [...exams];
    const e1 = { ...newExams[e1Index] };
    const e2 = { ...newExams[e2Index] };

    const tempDate = e1.date;
    const tempTime = e1.startTime;

    e1.date = e2.date;
    e1.startTime = e2.startTime;
    e2.date = tempDate;
    e2.startTime = tempTime;

    newExams[e1Index] = e1;
    newExams[e2Index] = e2;

    setExams(newExams);
    onUpdate({ ...initialData, exams: newExams });
  };

  const moveExamToDate = (id: string, newDate: string) => {
    const newExams = exams.map((e) =>
      e.id === id ? { ...e, date: newDate } : e
    );
    setExams(newExams);
    onUpdate({ ...initialData, exams: newExams });
  };

  return {
    exams,
    addExam,
    updateExam,
    deleteExam,
    bulkAddExams,
    upsertExams, // EXPORTED
    clearAllExams,
    validateExam,
    swapExams,
    moveExamToDate,
  };
};
