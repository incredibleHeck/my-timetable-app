import { useState, useCallback, useEffect } from "react";
import { AppData, ExamSession } from "../../../types";
import { generateId } from "../../../utils/utils";

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
  // FIXED: Scoped updates to respect Stream/Level boundaries
  const upsertExams = (sessions: ExamSession[]) => {
    let currentList = [...exams];
    const classes = initialData.classes;

    sessions.forEach((incoming) => {
      const existingIndex = currentList.findIndex((e) => e.id === incoming.id);

      if (existingIndex >= 0) {
        // UPDATE EXISTING
        const original = currentList[existingIndex];

        // 1. Analyze Streams (Levels)
        // Get levels for the incoming classes
        const incomingLevels = new Set(
          incoming.classIds
            .map((cid) => classes.find((c) => c.id === cid)?.level)
            .filter(Boolean)
        );

        // Get levels for the original classes that are NOT in the incoming set
        const remainingClassIds = original.classIds.filter(
          (cid) => !incoming.classIds.includes(cid)
        );

        // 2. FORK LOGIC
        // If we are updating a subset of classes (e.g. splitting for one class but not others),
        // we must FORK the exam so the others stay on the original.
        if (remainingClassIds.length > 0) {
          // A. Modify the original exam to REMOVE the incoming classes
          const updatedOriginal = {
            ...original,
            classIds: remainingClassIds,
          };
          currentList[existingIndex] = updatedOriginal;

          // B. Create a NEW exam for the incoming classes
          const newForkedExam = {
            ...incoming,
            id: generateId(),
          };
          currentList.push(newForkedExam);
        } else {
          // STANDARD UPDATE (Overwrite)
          // Updating all classes involved
          currentList[existingIndex] = incoming;
        }
      } else {
        // INSERT NEW
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
  const swapExams = (ids1: string | string[], ids2: string | string[]) => {
    const group1 = Array.isArray(ids1) ? ids1 : [ids1];
    const group2 = Array.isArray(ids2) ? ids2 : [ids2];

    const e1 = exams.find((e) => e.id === group1[0]);
    const e2 = exams.find((e) => e.id === group2[0]);
    if (!e1 || !e2) return;

    const date1 = e1.date;
    const time1 = e1.startTime;
    const date2 = e2.date;
    const time2 = e2.startTime;

    const newExams = exams.map((e) => {
      if (group1.includes(e.id)) return { ...e, date: date2, startTime: time2 };
      if (group2.includes(e.id)) return { ...e, date: date1, startTime: time1 };
      return e;
    });

    setExams(newExams);
    onUpdate({ ...initialData, exams: newExams });
  };

  const moveExamToDate = (id: string | string[], newDate: string) => {
    const ids = Array.isArray(id) ? id : [id];
    const newExams = exams.map((e) =>
      ids.includes(e.id) ? { ...e, date: newDate } : e
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
