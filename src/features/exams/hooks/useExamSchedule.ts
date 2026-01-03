import { useState, useCallback, useEffect, useRef } from "react";
import { AppData, ExamSession } from "../../../types";
import { generateId } from "../../../utils/utils";

export const useExamSchedule = (
  initialData: AppData,
  onUpdate: (data: AppData) => void
) => {
  // 1. STATE & REFS
  const [exams, setExams] = useState<ExamSession[]>(initialData.exams || []);

  // Create a Ref for initialData to avoid stale closures in complex DND handlers
  const dataRef = useRef(initialData);

  // Sync state and Ref when props change
  useEffect(() => {
    setExams(initialData.exams || []);
    dataRef.current = initialData;
  }, [initialData]);

  // --- VALIDATION ---
  const validateExam = useCallback(
    (exam: ExamSession, currentExams: ExamSession[]): string[] => {
      const errors: string[] = [];

      // Basic Conflict Checks
      const overlaps = currentExams.filter(
        (e) =>
          e.id !== exam.id &&
          e.date === exam.date &&
          e.startTime === exam.startTime &&
          (e.roomId === exam.roomId ||
            (e.invigilatorIds || []).some((i) =>
              (exam.invigilatorIds || []).includes(i)
            ))
      );

      if (overlaps.some((o) => o.roomId === exam.roomId && !!exam.roomId)) {
        errors.push("Room Conflict");
      }

      if (
        overlaps.some((o) =>
          (o.invigilatorIds || []).some((i) =>
            (exam.invigilatorIds || []).includes(i)
          )
        )
      ) {
        errors.push("Staff Conflict");
      }

      return errors;
    },
    []
  );

  // --- CRUD OPERATIONS ---

  const addExam = (exam: ExamSession) => {
    const newExams = [...exams, exam];
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const updateExam = (exam: ExamSession) => {
    const newExams = exams.map((e) => (e.id === exam.id ? exam : e));
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const deleteExam = (id: string) => {
    const newExams = exams.filter((e) => e.id !== id);
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const bulkAddExams = (newSessions: ExamSession[]) => {
    const combined = [...exams, ...newSessions];
    setExams(combined);
    onUpdate({ ...dataRef.current, exams: combined });
  };

  // --- SMART BATCH UPDATE (Upsert with Fork Logic) ---
  const upsertExams = (sessions: ExamSession[]) => {
    let currentList = [...exams];
    const allProjectClasses = dataRef.current.classes; // Safe Ref access

    // Helper: Expand class IDs to include all classes in the same stream/level
    const getFullStreamClassIds = (ids: string[]) => {
      const levels = new Set(
        allProjectClasses
          .filter((c) => ids.includes(c.id))
          .map((c) => c.level)
          .filter(Boolean)
      );
      if (levels.size === 0) return ids;
      const siblings = allProjectClasses
        .filter((c) => levels.has(c.level))
        .map((c) => c.id);
      return Array.from(new Set([...ids, ...siblings]));
    };

    sessions.forEach((incoming) => {
      // 1. Sync Streams
      const syncedClassIds = getFullStreamClassIds(incoming.classIds);
      const syncedIncoming = { ...incoming, classIds: syncedClassIds };

      const existingIndex = currentList.findIndex((e) => e.id === incoming.id);

      if (existingIndex >= 0) {
        // UPDATE EXISTING
        const original = currentList[existingIndex];

        // Determine classes NOT covered by this update (the "Leftovers")
        const remainingClassIds = original.classIds.filter(
          (cid) => !syncedIncoming.classIds.includes(cid)
        );

        // FORK LOGIC: If updating a subset, split the exam record
        if (remainingClassIds.length > 0) {
          // A. Modify original to keep the leftovers
          const updatedOriginal = {
            ...original,
            classIds: remainingClassIds,
          };
          currentList[existingIndex] = updatedOriginal;

          // B. Create NEW record for the moved/updated stream
          const newForkedExam = {
            ...syncedIncoming,
            id: generateId(),
          };
          currentList.push(newForkedExam);
        } else {
          // STANDARD UPDATE (No split needed)
          currentList[existingIndex] = syncedIncoming;
        }
      } else {
        // INSERT NEW
        currentList.push(syncedIncoming);
      }
    });

    setExams(currentList);
    onUpdate({ ...dataRef.current, exams: currentList });
  };

  const clearAllExams = () => {
    setExams([]);
    onUpdate({ ...dataRef.current, exams: [] });
  };

  // --- SCHEDULING & DRAG-DROP LOGIC ---

  // Helper: Find all IDs in the same "Stream Block" at a specific time
  const getStreamAlignedIds = (
    targetIds: string[],
    date: string,
    startTime: string
  ) => {
    const allProjectClasses = dataRef.current.classes; // Safe Ref access

    // Identify levels affected by the target exams
    const affectedLevels = new Set(
      allProjectClasses
        .filter((c) =>
          exams.some(
            (e) => targetIds.includes(e.id) && e.classIds.includes(c.id)
          )
        )
        .map((c) => c.level || c.id)
        .filter(Boolean)
    );

    // Find all exams at that slot belonging to those levels
    return exams
      .filter(
        (e) =>
          e.date === date &&
          e.startTime === startTime &&
          e.classIds.some((cid) => {
            const cls = allProjectClasses.find((c) => c.id === cid);
            return cls && affectedLevels.has(cls.level || cls.id);
          })
      )
      .map((e) => e.id);
  };

  const swapExams = (ids1: string | string[], ids2: string | string[]) => {
    const group1Ids = Array.isArray(ids1) ? ids1 : [ids1];
    const group2Ids = Array.isArray(ids2) ? ids2 : [ids2];

    const e1 = exams.find((e) => group1Ids.includes(e.id));
    const e2 = exams.find((e) => group2Ids.includes(e.id));

    if (!e1 || !e2) return;

    // 1. Identify all exams in both "Stream Slots" (e.g., all Form 1s at 9am, all Form 2s at 2pm)
    const slot1Ids = getStreamAlignedIds(group1Ids, e1.date, e1.startTime);
    const slot2Ids = getStreamAlignedIds(group2Ids, e2.date, e2.startTime);

    // 2. Define Contexts to Swap
    // Note: We deliberately swap invigilatorIds to keep them anchored to the Slot (Grid Cell).
    const context1 = {
      date: e1.date,
      startTime: e1.startTime,
      roomId: e1.roomId,
      invigilatorIds: e1.invigilatorIds || [],
    };
    const context2 = {
      date: e2.date,
      startTime: e2.startTime,
      roomId: e2.roomId,
      invigilatorIds: e2.invigilatorIds || [],
    };

    // 3. Commit Swap
    const newExams = exams.map((e) => {
      if (slot1Ids.includes(e.id)) {
        return { ...e, ...context2 }; // Inherit target slot's Invigilators
      }
      if (slot2Ids.includes(e.id)) {
        return { ...e, ...context1 }; // Inherit target slot's Invigilators
      }
      return e;
    });

    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const moveExamToDate = (ids: string | string[], newDate: string) => {
    const targetIds = Array.isArray(ids) ? ids : [ids];
    const firstExam = exams.find((e) => targetIds.includes(e.id));
    if (!firstExam) return;

    // Move whole stream block
    const alignedIds = getStreamAlignedIds(
      targetIds,
      firstExam.date,
      firstExam.startTime
    );

    const newExams = exams.map((e) =>
      alignedIds.includes(e.id) ? { ...e, date: newDate } : e
    );
    setExams(newExams);
    onUpdate({ ...dataRef.current, exams: newExams });
  };

  const moveExamToSlot = (ids: string[], newDate: string, newTime: string) => {
    const firstExam = exams.find((e) => ids.includes(e.id));
    if (!firstExam) return;

    // Move whole stream block
    const alignedIds = getStreamAlignedIds(
      ids,
      firstExam.date,
      firstExam.startTime
    );

    const newExams = exams.map((e) => {
      if (alignedIds.includes(e.id)) {
        // Reset invigilators on time move to prevent conflicts
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
    swapExams,
    moveExamToDate,
    moveExamToSlot,
  };
};
