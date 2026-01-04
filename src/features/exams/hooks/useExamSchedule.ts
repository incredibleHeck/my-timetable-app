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

  // --- HELPERS ---
  const getStreamLevel = useCallback((classId: string) => {
    const allProjectClasses = dataRef.current.classes;
    const cls = allProjectClasses.find((c) => c.id === classId);
    if (!cls) return classId;
    if (cls.level) return cls.level;
    // Smart parsing: Extract digits (e.g., "10A" -> "10", "Grade 1" -> "1")
    const match = cls.name.match(/(\d+)/);
    return match ? match[1] : cls.name;
  }, []);

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
      const targetLevels = new Set(ids.map(id => getStreamLevel(id)));
      
      const siblings = allProjectClasses
        .filter((c) => targetLevels.has(getStreamLevel(c.id)))
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
    date: string
  ) => {
    const allProjectClasses = dataRef.current.classes; // Safe Ref access

    // Identify levels AND subjects affected by the target exams
    const targets = exams.filter(e => targetIds.includes(e.id));
    const affectedSubjects = new Set(targets.map(e => e.subjectId));
    const affectedLevels = new Set(
      allProjectClasses
        .filter((c) =>
          targets.some((e) => e.classIds.includes(c.id))
        )
        .map((c) => getStreamLevel(c.id))
    );

    // Find all exams at that date belonging to those subjects AND those levels
    return exams
      .filter(
        (e) =>
          e.date === date &&
          affectedSubjects.has(e.subjectId) &&
          e.classIds.some((cid) => {
            return affectedLevels.has(getStreamLevel(cid));
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

    // 1. Identify all exams in both "Stream Slots"
    const slot1Ids = getStreamAlignedIds(group1Ids, e1.date);
    const slot2Ids = getStreamAlignedIds(group2Ids, e2.date);

    const slot1Exams = exams.filter(e => slot1Ids.includes(e.id));
    const slot2Exams = exams.filter(e => slot2Ids.includes(e.id));

    // 2. Define a map of updates to perform a "Paired Swap"
    const updates: Record<string, Partial<ExamSession>> = {};

    // Helper to find "Matching" exam in the other group (by class level/name)
    const findMatch = (exam: ExamSession, searchGroup: ExamSession[]) => {
      // Priority 1: Same Classes AND Same Paper Number
      const exact = searchGroup.find(other => 
        other.paperNumber === exam.paperNumber &&
        other.classIds.some(cid => exam.classIds.includes(cid))
      );
      if (exact) return exact;

      // Priority 2: Same Classes (regardless of paper)
      const classMatch = searchGroup.find(other => 
        other.classIds.some(cid => exam.classIds.includes(cid))
      );
      if (classMatch) return classMatch;

      // Priority 3: Same Paper Number
      const paperMatch = searchGroup.find(other => other.paperNumber === exam.paperNumber);
      if (paperMatch) return paperMatch;

      // Fallback: Use the first one in the group
      return searchGroup[0];
    };

    // MAP UPDATES FOR GROUP 1 -> Takes Group 2's Slots
    slot1Exams.forEach(ex1 => {
      const target = findMatch(ex1, slot2Exams);
      if (target) {
        updates[ex1.id] = {
          date: target.date,
          startTime: target.startTime,
          roomId: target.roomId,
          invigilatorIds: target.invigilatorIds || []
        };
      }
    });

    // MAP UPDATES FOR GROUP 2 -> Takes Group 1's Slots
    slot2Exams.forEach(ex2 => {
      const target = findMatch(ex2, slot1Exams);
      if (target) {
        updates[ex2.id] = {
          date: target.date,
          startTime: target.startTime,
          roomId: target.roomId,
          invigilatorIds: target.invigilatorIds || []
        };
      }
    });

    // 3. Commit Swap
    const newExams = exams.map((e) => {
      if (updates[e.id]) {
        return { ...e, ...updates[e.id] };
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
      firstExam.date
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
      firstExam.date
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
