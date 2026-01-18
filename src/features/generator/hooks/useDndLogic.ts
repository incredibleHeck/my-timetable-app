import { useState, useMemo } from "react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { AppData, ScheduleSlot, Conflict } from "../../../types";
import { checkSlotValidity } from "../scheduler/validation";
import { initializeState } from "../scheduler/state";
import { useProfile } from "../../../contexts/ProfileContext";
import { DAYS } from "../../../utils/constants";
// ARCHITECT: Import shared utils to ensure UI matches Solver logic
import { getNextClassPeriod, getPrevClassPeriod } from "../scheduler/utils";

/**
 * ARCHITECT NOTES:
 * 1. Logic: Replaced manual period loops with shared 'utils.ts' helpers.
 * 2. Performance: Relies on the O(1) SchedulerState built in useMemo.
 * 3. Integrity: Ensures "Tail-Dragging" (moving the 2nd part of a double) is handled robustly.
 */

export const useDndLogic = (
  data: AppData,
  activeId: string, // Current Class/Teacher ID in view
  mode: "CLASS" | "TEACHER",
  onUpdate: (d: AppData) => void,
  setHoverConflict?: (c: Conflict | null) => void
) => {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const { pushToHistory, addActivity } = useProfile();

  // 1. Initialize O(1) State for Validation
  const schedulerState = useMemo(() => initializeState(data), [data]);

  const { settings, schedule, classes, teachers, subjects } = data;
  const currentClass = classes.find((c) => c.id === activeId);
  const maxPeriods = settings.periodsPerDay;

  // --- OPTIMIZED HELPERS ---

  const getDuration = (classId: string, d: number, p: number): number => {
    const slot = schedule[classId]?.[d]?.[p];
    if (!slot) return 1;
    
    // Use shared utility to find next valid class slot
    const structure = classes.find(c => c.id === classId)?.structure || settings.dayStructure;
    const p2 = getNextClassPeriod(p, structure, maxPeriods);
    
    if (p2 !== null) {
      const nextSlot = schedule[classId]?.[d]?.[p2];
      if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId)
        return 2;
    }
    return 1;
  };

  const checkDragValidity = (targetDay: number, targetPeriod: number, isHoverCheck = false): boolean => {
    if (!activeDragItem) return true;
    
    // --- 1. NORMALIZE SOURCE (Handle Tail Dragging) ---
    let sourcePeriod = activeDragItem.period;
    let sourceDay = activeDragItem.day;
    const sourceClassId = mode === "CLASS" ? activeId : activeDragItem.classGroup?.id;
    
    // Access structure for the source class
    const sourceCls = classes.find(c => c.id === sourceClassId);
    const sourceStructure = sourceCls?.structure || settings.dayStructure;

    // If dragging the tail (Fixed slot), shift reference to Head
    if (activeDragItem.slot.isFixed && sourceClassId) {
        const prev = getPrevClassPeriod(sourcePeriod, sourceStructure);
        if (prev !== null) sourcePeriod = prev;
    }

    if (sourceDay === targetDay && sourcePeriod === targetPeriod) {
        if (isHoverCheck && setHoverConflict) setHoverConflict(null);
        return true;
    }

    if (!sourceClassId) return false;

    // --- 2. VALIDATE TARGET CLASS ---
    let targetClassId = sourceClassId;
    let targetClassName = mode === "CLASS" ? currentClass?.name : activeDragItem.classGroup?.name;
    
    if (mode === "TEACHER") {
         for (const cId of Object.keys(schedule)) {
            const s = schedule[cId]?.[targetDay]?.[targetPeriod];
            if (s && s.teacherId === activeId) {
                targetClassId = cId;
                targetClassName = classes.find(c => c.id === cId)?.name;
                break;
            }
         }
    }

    if (sourceClassId !== targetClassId) {
        if (isHoverCheck && setHoverConflict) {
             setHoverConflict({
                 classId: targetClassId,
                 className: targetClassName || "Unknown",
                 reason: "Cannot move between different classes",
                 day: targetDay,
                 period: targetPeriod
             });
        }
        return false;
    }

    const classId = sourceClassId;
    // Use Target Class Structure for target validation
    const targetCls = classes.find(c => c.id === classId);
    const targetStructure = targetCls?.structure || settings.dayStructure;

    const sourceDuration = getDuration(classId, sourceDay, sourcePeriod);
    const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
    const targetDuration = targetSlot ? getDuration(classId, targetDay, targetPeriod) : 1;

    const sourceSubject = subjects.find(s => s.id === activeDragItem.slot.subjectId);
    const sourceEffectiveRoomId = activeDragItem.slot.roomId || sourceSubject?.requiredRoomId || targetCls?.defaultRoomId;

    // --- 3. CHECK DURATION / BOUNDS ---
    if (targetSlot) {
        if (sourceDuration !== targetDuration) {
             if (isHoverCheck && setHoverConflict) {
                 const targetSubj = subjects.find(s => s.id === targetSlot.subjectId);
                 setHoverConflict({
                     classId,
                     className: targetClassName || "Unknown",
                     reason: `Duration Mismatch: Cannot swap ${sourceDuration}-period lesson with ${targetDuration}-period ${targetSubj?.name}.`,
                     day: targetDay,
                     period: targetPeriod
                 });
             }
            return false;
        }
    } else {
        if (sourceDuration === 2) {
             const tP2 = getNextClassPeriod(targetPeriod, targetStructure, maxPeriods);
             
             // A. End of Day Check
             if (tP2 === null) {
                  if (isHoverCheck && setHoverConflict) {
                      setHoverConflict({
                          classId,
                          className: targetClassName || "Unknown",
                          reason: "Not enough time remaining in day (Double Period)",
                          day: targetDay,
                          period: targetPeriod
                      });
                  }
                  return false;
             }
             
             // B. Overlap with existing lesson at P2
             if (schedule[classId]?.[targetDay]?.[tP2]) {
                  if (isHoverCheck && setHoverConflict) {
                      const p2Slot = schedule[classId]?.[targetDay]?.[tP2];
                      const p2Subj = subjects.find(s => s.id === p2Slot?.subjectId);
                      setHoverConflict({
                          classId,
                          className: targetClassName || "Unknown",
                          reason: `Overlap: Next period occupied by ${p2Subj?.name}`,
                          day: targetDay,
                          period: targetPeriod
                      });
                  }
                  return false;
             }
        }
    }

    // --- 4. VALIDATE MOVE (Target Slot Validity) ---
    // Uses the Unified Validation Engine
    const valMove = checkSlotValidity(
        data, targetDay, targetPeriod, activeDragItem.slot.teacherId, classId, activeDragItem.slot.subjectId,
        schedulerState,
        { day: sourceDay, period: sourcePeriod, duration: sourceDuration }, // Ignore Source
        sourceEffectiveRoomId,
        sourceDuration,
        targetSlot ? { day: targetDay, period: targetPeriod, duration: targetDuration } : undefined // Ignore Target (if swapping)
    );

    if (!valMove.valid) {
         if (isHoverCheck && setHoverConflict) {
             setHoverConflict({
                 classId,
                 className: targetClassName || "Unknown",
                 reason: valMove.message || "Invalid Move",
                 day: targetDay,
                 period: targetPeriod
             });
         }
         return false;
    }

    // --- 5. VALIDATE SWAP (Source Slot Validity for Target Item) ---
    if (targetSlot) {
         const targetSubject = subjects.find(s => s.id === targetSlot.subjectId);
         const targetEffectiveRoomId = targetSlot.roomId || targetSubject?.requiredRoomId || targetCls?.defaultRoomId;

         const valSwap = checkSlotValidity(
            data, activeDragItem.day, activeDragItem.period, targetSlot.teacherId, classId, targetSlot.subjectId,
            schedulerState,
            { day: targetDay, period: targetPeriod, duration: targetDuration }, // Ignore Target's current spot
            targetEffectiveRoomId,
            targetDuration,
            { day: activeDragItem.day, period: activeDragItem.period, duration: sourceDuration } // Ignore Source's current spot
        );
        if (!valSwap.valid) {
             if (isHoverCheck && setHoverConflict) {
                 setHoverConflict({
                     classId,
                     className: targetClassName || "Unknown",
                     reason: `Swap Target Invalid: ${valSwap.message}`,
                     day: targetDay,
                     period: targetPeriod
                 });
             }
             return false;
        }
    }

    if (isHoverCheck && setHoverConflict) setHoverConflict(null);
    return true;
  };

  // --- HANDLERS ---

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over) return;

    const sData = active.data.current as { day: number; period: number; slot: ScheduleSlot; classGroup?: any };
    const tData = over.data.current as { day: number; period: number };

    if (!sData || !tData) return;
    
    const classId = mode === "CLASS" ? activeId : sData.classGroup?.id;
    if (!classId) return;

    // Normalization (Head/Tail)
    let sP = sData.period;
    const sD = sData.day;
    const sourceStructure = classes.find(c => c.id === classId)?.structure || settings.dayStructure;

    if (sData.slot.isFixed) {
        const prev = getPrevClassPeriod(sP, sourceStructure);
        if (prev !== null) sP = prev;
    }

    if (sD === tData.day && sP === tData.period) return;

    const tD = tData.day;
    const tP = tData.period;
    const targetStructure = classes.find(c => c.id === classId)?.structure || settings.dayStructure;

    const sourceDuration = getDuration(classId, sD, sP);
    const targetSlot = data.schedule[classId]?.[tD]?.[tP];
    const targetDuration = targetSlot ? getDuration(classId, tD, tP) : 1;
    const tP2 = getNextClassPeriod(tP, targetStructure, maxPeriods);

    // Re-Validation (Safety Check before commit)
    if (targetSlot) {
        if (sourceDuration !== targetDuration) return;
    } else {
        if (sourceDuration === 2) {
            if (tP2 === null) return;
            if (data.schedule[classId]?.[tD]?.[tP2]) return;
        }
    }

    // --- COMMIT MOVE ---
    const newSchedule = JSON.parse(JSON.stringify(data.schedule));
    if (!newSchedule[classId]) newSchedule[classId] = {};
    if (!newSchedule[classId][sD]) newSchedule[classId][sD] = {};
    if (!newSchedule[classId][tD]) newSchedule[classId][tD] = {};

    const clearSlot = (d: number, p: number, dur: number) => {
        if (!newSchedule[classId][d]) return;
        delete newSchedule[classId][d][p];
        if (dur === 2) {
            const p2 = getNextClassPeriod(p, targetStructure, maxPeriods);
            if (p2 !== null) delete newSchedule[classId][d][p2];
        }
    };

    const setSlot = (d: number, p: number, slot: ScheduleSlot, dur: number) => {
        if (!newSchedule[classId][d]) newSchedule[classId][d] = {};
        newSchedule[classId][d][p] = { ...slot, isFixed: false };
        if (dur === 2) {
            const p2 = getNextClassPeriod(p, targetStructure, maxPeriods);
            if (p2 !== null) {
                newSchedule[classId][d][p2] = { ...slot, isFixed: true };
            }
        }
    };

    const sourceSlot = { ...sData.slot };
    const destSlot = targetSlot ? { ...targetSlot } : null;

    clearSlot(sD, sP, sourceDuration);
    if (destSlot) clearSlot(tD, tP, targetDuration);

    setSlot(tD, tP, sourceSlot, sourceDuration);
    if (destSlot) {
        setSlot(sD, sP, destSlot, targetDuration);
    }

    const nextData = { ...data, schedule: newSchedule };

    // --- LOGGING ---
    const classObj = classes.find(c => c.id === classId);
    const subjObj = subjects.find(s => s.id === sourceSlot.subjectId);
    
    let message = "";
    if (destSlot) {
        const targetSubj = subjects.find(s => s.id === destSlot.subjectId);
        message = `Swapped ${subjObj?.name} with ${targetSubj?.name} in ${classObj?.name}`;
    } else {
        message = `Moved ${subjObj?.name} in ${classObj?.name} to ${DAYS[tD]} P${tP + 1}`;
    }
    addActivity("SCHEDULING", message, nextData);

    pushToHistory(data);
    onUpdate(nextData);
  };

  return {
    activeDragItem,
    handleDragStart,
    handleDragEnd,
    checkDragValidity,
    getDuration
  };
};
