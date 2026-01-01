import { useState } from "react";
import { AppData, ScheduleSlot } from "../../../types";

export interface DragItem {
  classId: string;
  day: number;
  period: number;
  slot: ScheduleSlot;
}

export const useDragAndDrop = (
  data: AppData,
  activeId: string,
  mode: "CLASS" | "TEACHER",
  onUpdate: (d: AppData) => void,
  isEnabled: boolean
) => {
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<{ d: number; p: number } | null>(
    null
  );
  const [isValidDrop, setIsValidDrop] = useState(false);

  // Helper to find next valid class period (skips breaks)
  const getNextClassIndex = (p: number, classId: string): number | null => {
    const cls = data.classes.find((c) => c.id === classId);
    const struct = cls?.structure || data.settings.dayStructure;
    const limit = cls?.periodCount || data.settings.periodsPerDay;

    for (let i = p + 1; i < limit; i++) {
      const item = struct[i];
      const type = (typeof item === "object" ? item.type : item) || "CLASS";
      if (type === "CLASS") return i;
    }
    return null;
  };

  // Helper to determine if the dragged item is a Double or Single
  const getDuration = (
    schedule: any,
    classId: string,
    d: number,
    p: number
  ): number => {
    const slot = schedule[classId]?.[d]?.[p];
    if (!slot) return 1;

    const p2 = getNextClassIndex(p, classId);
    if (p2 !== null) {
      const nextSlot = schedule[classId]?.[d]?.[p2];
      if (
        nextSlot &&
        nextSlot.isFixed &&
        nextSlot.subjectId === slot.subjectId
      ) {
        return 2;
      }
    }
    return 1;
  };

  const handleDragStart = (
    e: React.DragEvent,
    d: number,
    p: number,
    slot: ScheduleSlot
  ) => {
    if (!isEnabled || mode !== "CLASS" || slot.isFixed) {
      e.preventDefault();
      return;
    }
    const payload: DragItem = { classId: activeId, day: d, period: p, slot };
    setDragItem(payload);
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, d: number, p: number) => {
    e.preventDefault();
    if (!dragItem || !activeId || !isEnabled) return;

    const targetTeacherId = dragItem.slot.teacherId;
    const sourceDuration = getDuration(
      data.schedule,
      dragItem.classId,
      dragItem.day,
      dragItem.period
    );

    // 1. Structure Check (Target must be CLASS type, not Lunch/Break)
    const currentClass = data.classes.find((c) => c.id === activeId);
    const struct = currentClass?.structure || data.settings.dayStructure;

    const item = struct[p];
    const type = (typeof item === "object" ? item.type : item) || "CLASS";

    if (type !== "CLASS") {
      setIsValidDrop(false);
      setDropTarget({ d, p });
      return;
    }

    let p2: number | null = null;
    if (sourceDuration === 2) {
      p2 = getNextClassIndex(p, activeId);
      if (p2 === null) {
        setIsValidDrop(false);
        setDropTarget({ d, p });
        return;
      }
    }

    // --- NEW: RESERVATION CHECKS (Global & Class-Specific) ---
    // Check Period 1
    if (data.settings.fixedOccasions[d]?.[p]) {
      setIsValidDrop(false);
      setDropTarget({ d, p });
      return;
    }
    if (currentClass?.fixedSessions?.[d]?.[p]) {
      setIsValidDrop(false);
      setDropTarget({ d, p });
      return;
    }

    // Check Period 2 (if double)
    if (sourceDuration === 2 && p2 !== null) {
      if (data.settings.fixedOccasions[d]?.[p2]) {
        setIsValidDrop(false);
        setDropTarget({ d, p });
        return;
      }
      if (currentClass?.fixedSessions?.[d]?.[p2]) {
        setIsValidDrop(false);
        setDropTarget({ d, p });
        return;
      }
    }
    // ---------------------------------------------------------

    // 2. Occupancy Check
    const existingClassSlot = data.schedule[activeId]?.[d]?.[p];
    if (existingClassSlot) {
      // If we are hovering over ourselves (same slot), it's valid
      if (
        existingClassSlot.subjectId === dragItem.slot.subjectId &&
        d === dragItem.day &&
        p === dragItem.period
      ) {
        setIsValidDrop(true);
        setDropTarget({ d, p });
        return;
      }
      setIsValidDrop(false);
      setDropTarget({ d, p });
      return;
    }

    // Check P2 Occupancy
    if (p2 !== null) {
      const existingNext = data.schedule[activeId]?.[d]?.[p2];
      if (existingNext) {
        setIsValidDrop(false);
        setDropTarget({ d, p });
        return;
      }
    }

    // 3. Teacher Check
    let teacherBusy = false;
    for (const cls of data.classes) {
      if (cls.id === activeId) continue;

      const s1 = data.schedule[cls.id]?.[d]?.[p];
      if (s1 && s1.teacherId === targetTeacherId) {
        teacherBusy = true;
        break;
      }

      if (p2 !== null) {
        const s2 = data.schedule[cls.id]?.[d]?.[p2];
        if (s2 && s2.teacherId === targetTeacherId) {
          teacherBusy = true;
          break;
        }
      }
    }

    const teacher = data.teachers.find((t) => t.id === targetTeacherId);
    if (teacher) {
      if (teacher.constraints?.[d]?.[p]) teacherBusy = true;
      if (p2 !== null && teacher.constraints?.[d]?.[p2]) teacherBusy = true;
    }

    setIsValidDrop(!teacherBusy);
    setDropTarget({ d, p });
  };

  const handleDrop = (e: React.DragEvent, d: number, p: number) => {
    e.preventDefault();
    if (!dragItem || !isValidDrop) {
      setDragItem(null);
      setDropTarget(null);
      return;
    }

    const newSchedule = JSON.parse(JSON.stringify(data.schedule));
    const duration = getDuration(
      data.schedule,
      dragItem.classId,
      dragItem.day,
      dragItem.period
    );

    if (!newSchedule[activeId]) newSchedule[activeId] = {};
    if (!newSchedule[activeId][d]) newSchedule[activeId][d] = {};

    // Remove from old location
    if (newSchedule[dragItem.classId]?.[dragItem.day]) {
      delete newSchedule[dragItem.classId][dragItem.day][dragItem.period];
      if (duration === 2) {
        const oldP2 = getNextClassIndex(dragItem.period, dragItem.classId);
        if (oldP2 !== null)
          delete newSchedule[dragItem.classId][dragItem.day][oldP2];
      }
    }

    // Add to new location
    newSchedule[activeId][d][p] = dragItem.slot;
    if (duration === 2) {
      const newP2 = getNextClassIndex(p, activeId);
      if (newP2 !== null) {
        newSchedule[activeId][d][newP2] = { ...dragItem.slot, isFixed: true };
      }
    }

    onUpdate({ ...data, schedule: newSchedule });
    setDragItem(null);
    setDropTarget(null);
  };

  return {
    dragItem,
    dropTarget,
    isValidDrop,
    handleDragStart,
    handleDragOver,
    handleDrop,
  };
};
