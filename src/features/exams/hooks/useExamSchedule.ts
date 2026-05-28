import { useState, useCallback, useEffect, useRef } from "react";
import { AppData, ExamSession } from "../../../types";
import { generateId } from "../../../utils/utils";
import { validateExamMove, ExamConflict } from "../logic/examValidation";
import { getStreamLevel } from "../logic/examUtils";
import { useHistory } from "../../../contexts/HistoryContext";

export const useExamSchedule = (initialData: AppData, onUpdate: (data: AppData) => void) => {
  // 1. STATE & REFS
  const [exams, setExams] = useState<ExamSession[]>(initialData.exams || []);
  const { pushToHistory } = useHistory();

  // Create a Ref for initialData to avoid stale closures in complex DND handlers
  const dataRef = useRef(initialData);

  // Sync state and Ref when props change
  useEffect(() => {
    setExams(initialData.exams || []);
    dataRef.current = initialData;
  }, [initialData]);

  // --- HELPERS ---
  const resolveStreamLevel = useCallback(
    (classId: string) => getStreamLevel(classId, dataRef.current.classes),
    [],
  );

  // --- VALIDATION ---
  const validateExam = useCallback(
    (exam: ExamSession): string[] => {
      const conflicts = validateExamMove(exam, exams, dataRef.current);
      return conflicts.map((c) => c.message);
    },
    [exams],
  );

  /**
   * Specifically for DND: Checks if moving these exams to a new slot causes conflicts.
   * ignoreIds: IDs to exclude from the validation set (e.g., the exams being swapped).
   */
  const checkMoveConflicts = useCallback(
    (ids: string[], newDate: string, newTime: string, ignoreIds: string[] = []): ExamConflict[] => {
      const targets = exams.filter((e) => ids.includes(e.id));
      const otherExams = exams.filter((e) => !ignoreIds.includes(e.id));
      const results: ExamConflict[] = [];

      targets.forEach((t) => {
        const moved = { ...t, date: newDate, startTime: newTime };
        const conflicts = validateExamMove(moved, otherExams, dataRef.current);
        results.push(...conflicts);
      });

      return results;
    },
    [exams],
  );

  // --- CRUD OPERATIONS ---

  const addExam = (exam: ExamSession) => {
    pushToHistory(dataRef.current);
    const newExams = [...exams, exam];
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const updateExam = (exam: ExamSession) => {
    pushToHistory(dataRef.current);
    const newExams = exams.map((e) => (e.id === exam.id ? exam : e));
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const deleteExam = (id: string) => {
    pushToHistory(dataRef.current);
    const newExams = exams.filter((e) => e.id !== id);
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const bulkAddExams = (newSessions: ExamSession[]) => {
    pushToHistory(dataRef.current);
    const combined = [...exams, ...newSessions];
    setExams(combined);
    onUpdate({ ...dataRef.current, exams: combined });
  };

  const upsertExams = (sessions: ExamSession[]) => {
    pushToHistory(dataRef.current);
    const currentList = [...exams];
    const allProjectClasses = dataRef.current.classes;

    const getFullStreamClassIds = (ids: string[]) => {
      const targetLevels = new Set(ids.map((id) => resolveStreamLevel(id)));
      const siblings = allProjectClasses
        .filter((c) => targetLevels.has(resolveStreamLevel(c.id)))
        .map((c) => c.id);
      return Array.from(new Set([...ids, ...siblings]));
    };

    sessions.forEach((incoming) => {
      const syncedClassIds = getFullStreamClassIds(incoming.classIds);
      const syncedIncoming = { ...incoming, classIds: syncedClassIds };
      const existingIndex = currentList.findIndex((e) => e.id === incoming.id);

      if (existingIndex >= 0) {
        const original = currentList[existingIndex];
        const remainingClassIds = original.classIds.filter(
          (cid) => !syncedIncoming.classIds.includes(cid),
        );

        if (remainingClassIds.length > 0) {
          const updatedOriginal = { ...original, classIds: remainingClassIds };
          currentList[existingIndex] = updatedOriginal;
          const newForkedExam = { ...syncedIncoming, id: generateId() };
          currentList.push(newForkedExam);
        } else {
          currentList[existingIndex] = syncedIncoming;
        }
      } else {
        currentList.push(syncedIncoming);
      }
    });

    setExams(currentList);
    onUpdate({ ...dataRef.current, exams: currentList });
  };

  const clearAllExams = () => {
    pushToHistory(dataRef.current);
    setExams([]);
    onUpdate({ ...dataRef.current, exams: [] });
  };

  // --- SIMPLIFIED SWAP & MOVE LOGIC ---

  /**
   * Directly swaps the subject identity between two sets of exams.
   * This ensures only the name, color and subject time are swapped,
   * keeping the slot infrastructure (classes, rooms, staff) fixed.
   * Handles multi-stream consistency by identifying related exams.
   */
  const swapExams = (ids1: string | string[], ids2: string | string[]) => {
    const group1Ids = Array.isArray(ids1) ? ids1 : [ids1];
    const group2Ids = Array.isArray(ids2) ? ids2 : [ids2];

    const group1 = exams.filter((e) => group1Ids.includes(e.id));
    const group2 = exams.filter((e) => group2Ids.includes(e.id));

    if (group1.length === 0 || group2.length === 0) return;

    pushToHistory(dataRef.current);

    // Use subject from first element of each group
    const sub1Id = group1[0].subjectId;
    const sub2Id = group2[0].subjectId;

    // Identify all exams in the same streams as the selected groups
    // A stream is defined by the same Level and the same Subject
    const getStreamExams = (sourceExams: ExamSession[]) => {
      const streams = new Set(
        sourceExams.map((e) => {
          const levels = e.classIds.map((cid) => resolveStreamLevel(cid));
          return JSON.stringify({ levels, subId: e.subjectId });
        }),
      );

      return exams
        .filter((e) => {
          const levels = e.classIds.map((cid) => resolveStreamLevel(cid));
          return streams.has(JSON.stringify({ levels, subId: e.subjectId }));
        })
        .map((e) => e.id);
    };

    const stream1Ids = getStreamExams(group1);
    const stream2Ids = getStreamExams(group2);

    const newExams = exams.map((e) => {
      if (stream1Ids.includes(e.id)) {
        return { ...e, subjectId: sub2Id };
      }
      if (stream2Ids.includes(e.id)) {
        return { ...e, subjectId: sub1Id };
      }
      return e;
    });

    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  /**
   * Directly moves a set of exams to a specific date.
   */
  const moveExamToDate = (ids: string | string[], newDate: string) => {
    pushToHistory(dataRef.current);
    const targetIds = Array.isArray(ids) ? ids : [ids];
    const newExams = exams.map((e) => (targetIds.includes(e.id) ? { ...e, date: newDate } : e));
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  /**
   * Directly moves a set of exams to a specific slot.
   * Maintains multi-stream consistency by moving related exams together.
   */
  const moveExamToSlot = (ids: string[], newDate: string, newTime: string) => {
    const targetExams = exams.filter((e) => ids.includes(e.id));
    if (targetExams.length === 0) return;

    pushToHistory(dataRef.current);

    // Identify all related exams in the same streams
    const streams = new Set(
      targetExams.map((e) => {
        const levels = e.classIds.map((cid) => resolveStreamLevel(cid));
        return JSON.stringify({ levels, subId: e.subjectId });
      }),
    );

    const streamIds = exams
      .filter((e) => {
        const levels = e.classIds.map((cid) => resolveStreamLevel(cid));
        return streams.has(JSON.stringify({ levels, subId: e.subjectId }));
      })
      .map((e) => e.id);

    const newExams = exams.map((e) => {
      if (streamIds.includes(e.id)) {
        // Direct move for entire stream, resetting staff assignments
        return { ...e, date: newDate, startTime: newTime, invigilatorIds: [] };
      }
      return e;
    });

    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  return {
    exams,
    addExam,
    updateExam,
    deleteExam,
    bulkAddExams,
    upsertExams,
    clearAllExams,
    validateExam,
    checkMoveConflicts,
    swapExams,
    moveExamToDate,
    moveExamToSlot,
  };
};
