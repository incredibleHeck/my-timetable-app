import { useState } from "react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { AppData, ScheduleSlot } from "../../../types";
import { checkSlotValidity } from "../../../services/scheduler/validation";
import { useProfile } from "../../../contexts/ProfileContext";

export const useDndLogic = (
  data: AppData,
  activeId: string, // Current Class/Teacher ID in view
  mode: "CLASS" | "TEACHER",
  onUpdate: (d: AppData) => void
) => {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const { pushToHistory } = useProfile();

  // --- HELPERS ---
  const getSafeType = (item: any) =>
    (typeof item === "object" ? item.type : item) || "CLASS";

  const getNextClassIndex = (p: number, classId: string): number | null => {
    const cls = data.classes.find((c) => c.id === classId);
    const struct = cls?.structure || data.settings.dayStructure;
    const limit = cls?.periodCount || data.settings.periodsPerDay;
    
    // MODIFIED: Search for the next available CLASS slot, skipping BREAK/LUNCH
    for (let i = p + 1; i < limit; i++) {
      const item = struct[i];
      const type = getSafeType(item);
      if (type === "CLASS") return i;
    }
    return null;
  };

  const getDuration = (classId: string, d: number, p: number): number => {
    const slot = data.schedule[classId]?.[d]?.[p];
    if (!slot) return 1;
    const p2 = getNextClassIndex(p, classId);
    if (p2 !== null) {
      const nextSlot = data.schedule[classId]?.[d]?.[p2];
      // MODIFIED: If the next CLASS slot (even if split by break) 
      // is the second half of this double period, return 2.
      if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId)
        return 2;
    }
    return 1;
  };

  // --- HANDLERS ---
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    // Source Data
    const sData = active.data.current as {
      day: number;
      period: number;
      slot: ScheduleSlot;
      classGroup?: any;
    };
    
    // Target Data
    const tData = over.data.current as {
      day: number;
      period: number;
    };

    if (!sData || !tData) return;
    
    // Verify we are not dropping on same slot
    if (sData.day === tData.day && sData.period === tData.period) return;

    // Identify Class Context
    // In CLASS mode, we are editing 'activeId'.
    // In TEACHER mode, we are editing the class of the dragged slot (sData.classGroup.id).
    // Note: Moving between classes is NOT supported/safe usually without re-checking curriculum.
    // For now, assume operation is within the SAME class.
    const classId = mode === "CLASS" ? activeId : sData.classGroup?.id;
    if (!classId) return;

    const sD = sData.day;
    const sP = sData.period;
    const tD = tData.day;
    const tP = tData.period;

    // 1. DURATION CHECKS
    const sourceDuration = getDuration(classId, sD, sP);
    const targetSlot = data.schedule[classId]?.[tD]?.[tP];
    const targetDuration = targetSlot ? getDuration(classId, tD, tP) : 1; // Treat empty as 1 for basic fit check, but logic below handles empty explicitly.

    // Calculate P2 indices
    const sP2 = getNextClassIndex(sP, classId);
    const tP2 = getNextClassIndex(tP, classId);

    // --- RULE: Strict Duration Swap ---
    if (targetSlot) {
        // SWAPPING
        if (sourceDuration !== targetDuration) {
            // Cannot swap Double with Single
            // Provide visual feedback? (Shake?) - For now just return.
            // alert("Cannot swap lessons of different durations."); // Optional
            return;
        }
    } else {
        // MOVING TO EMPTY
        if (sourceDuration === 2) {
            // Must ensure P2 is also empty
            if (tP2 === null) return; // End of day
            const tSlot2 = data.schedule[classId]?.[tD]?.[tP2];
            if (tSlot2) {
                // Cannot move Double here (Overlap)
                return;
            }
        }
    }

    // 2. VALIDATION (Constraints & Conflicts)
    // We check if Source fits in Target
    const valMove = checkSlotValidity(
        data, tD, tP, sData.slot.teacherId, classId, sData.slot.subjectId,
        { day: sD, period: sP }, // Ignore self
        sData.slot.roomId,
        sourceDuration
    );
    if (!valMove.valid) {
        // alert(valMove.message);
        return;
    }

    // If Swapping, check if Target fits in Source
    if (targetSlot) {
        const valSwap = checkSlotValidity(
            data, sD, sP, targetSlot.teacherId, classId, targetSlot.subjectId,
            { day: tD, period: tP }, // Ignore self
            targetSlot.roomId,
            targetDuration // Should be same as sourceDuration here
        );
        if (!valSwap.valid) {
            // alert(`Swap failed: ${valSwap.message}`);
            return;
        }
    }

    // 3. EXECUTE UPDATE
    const newSchedule = JSON.parse(JSON.stringify(data.schedule));
    if (!newSchedule[classId]) newSchedule[classId] = {};
    if (!newSchedule[classId][sD]) newSchedule[classId][sD] = {};
    if (!newSchedule[classId][tD]) newSchedule[classId][tD] = {};

    // Helper to clear a slot
    const clearSlot = (d: number, p: number, dur: number) => {
        if (!newSchedule[classId][d]) return;
        delete newSchedule[classId][d][p];
        if (dur === 2) {
            const p2 = getNextClassIndex(p, classId);
            if (p2 !== null) delete newSchedule[classId][d][p2];
        }
    };

    // Helper to set a slot
    const setSlot = (d: number, p: number, slot: ScheduleSlot, dur: number) => {
        if (!newSchedule[classId][d]) newSchedule[classId][d] = {};
        newSchedule[classId][d][p] = slot;
        if (dur === 2) {
            const p2 = getNextClassIndex(p, classId);
            if (p2 !== null) {
                newSchedule[classId][d][p2] = { ...slot, isFixed: true };
            }
        }
    };

    // Prepare slots
    const sourceSlot = { ...sData.slot }; // Clone
    const destSlot = targetSlot ? { ...targetSlot } : null; // Clone if exists

    // Clear both locations
    clearSlot(sD, sP, sourceDuration);
    if (destSlot) clearSlot(tD, tP, targetDuration); // targetDuration == sourceDuration if swapping

    // Place slots
    setSlot(tD, tP, sourceSlot, sourceDuration);
    if (destSlot) {
        setSlot(sD, sP, destSlot, targetDuration);
    }

    pushToHistory(data);
    onUpdate({ ...data, schedule: newSchedule });
  };

  return {
    activeDragItem,
    handleDragStart,
    handleDragEnd
  };
};
