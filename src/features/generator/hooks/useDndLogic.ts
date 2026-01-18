import { useState, useMemo } from "react";
import { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { AppData, ScheduleSlot, Conflict } from "../../../types";
import { checkSlotValidity } from "../scheduler/validation";
import { initializeState } from "../scheduler/state";
import { useProfile } from "../../../contexts/ProfileContext";
import { DAYS } from "../../../utils/constants";

export const useDndLogic = (
  data: AppData,
  activeId: string, // Current Class/Teacher ID in view
  mode: "CLASS" | "TEACHER",
  onUpdate: (d: AppData) => void,
  setHoverConflict?: (c: Conflict | null) => void
) => {
  const [activeDragItem, setActiveDragItem] = useState<any>(null);
  const { pushToHistory, addActivity } = useProfile();

  const schedulerState = useMemo(() => initializeState(data), [data]);

  const { settings, schedule, classes, teachers, subjects } = data;
  const currentClass = classes.find((c) => c.id === activeId);

  // --- HELPERS ---
  const getSafeType = (item: any) =>
    (typeof item === "object" ? item.type : item) || "CLASS";

  const getNextClassIndex = (p: number, classId: string): number | null => {
    const cls = classes.find((c) => c.id === classId);
    const struct = cls?.structure || settings.dayStructure;
    const limit = cls?.periodCount || settings.periodsPerDay;
    
    for (let i = p + 1; i < limit; i++) {
      const item = struct[i];
      const type = getSafeType(item);
      if (type === "CLASS") return i;
    }
    return null;
  };

  const getPrevClassIndex = (p: number, classId: string): number | null => {
    const cls = classes.find((c) => c.id === classId);
    const struct = cls?.structure || settings.dayStructure;
    
    // Loop backwards to find the previous CLASS period
    for (let i = p - 1; i >= 0; i--) {
      const item = struct[i];
      const type = getSafeType(item);
      if (type === "CLASS") return i;
    }
    return null;
  };

  const getDuration = (classId: string, d: number, p: number): number => {
    const slot = schedule[classId]?.[d]?.[p];
    if (!slot) return 1;
    const p2 = getNextClassIndex(p, classId);
    if (p2 !== null) {
      const nextSlot = schedule[classId]?.[d]?.[p2];
      if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId)
        return 2;
    }
    return 1;
  };

  const checkDragValidity = (targetDay: number, targetPeriod: number, isHoverCheck = false): boolean => {
    if (!activeDragItem) return true;
    
    // --- NORMALIZE SOURCE: If dragging the TAIL (isFixed), shift start to HEAD ---
    let sourcePeriod = activeDragItem.period;
    let sourceDay = activeDragItem.day;
    const sourceClassId = mode === "CLASS" ? activeId : activeDragItem.classGroup?.id;

    if (activeDragItem.slot.isFixed && sourceClassId) {
        const prev = getPrevClassIndex(sourcePeriod, sourceClassId);
        if (prev !== null) sourcePeriod = prev;
    }

    if (sourceDay === targetDay && sourcePeriod === targetPeriod) {
        if (isHoverCheck && setHoverConflict) setHoverConflict(null);
        return true;
    }

    if (!sourceClassId) return false;

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

    const formatConflict = (reason: string) => {
        const subj = subjects.find(s => s.id === activeDragItem.slot.subjectId);
        const teach = teachers.find(t => t.id === activeDragItem.slot.teacherId);
        const time = `${DAYS[targetDay]} P${targetPeriod + 1}`;
        return `${reason} for ${subj?.name} (${teach?.name}) at ${time}`;
    };

    const sourceDuration = getDuration(classId, sourceDay, sourcePeriod);
    const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
    const targetDuration = targetSlot ? getDuration(classId, targetDay, targetPeriod) : 1;

    // Resolve Effective Room for the item being dragged
    const sourceSubject = subjects.find(s => s.id === activeDragItem.slot.subjectId);
    const sourceEffectiveRoomId = activeDragItem.slot.roomId || sourceSubject?.requiredRoomId || currentClass?.defaultRoomId;

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
             const tP2 = getNextClassIndex(targetPeriod, classId);
             if (tP2 === null) {
                  if (isHoverCheck && setHoverConflict) {
                     setHoverConflict({
                         classId,
                         className: targetClassName || "Unknown",
                         reason: formatConflict("Not enough time remaining in day"),
                         day: targetDay,
                         period: targetPeriod
                     });
                  }
                  return false;
             }
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

    const valMove = checkSlotValidity(
        data, targetDay, targetPeriod, activeDragItem.slot.teacherId, classId, activeDragItem.slot.subjectId,
        schedulerState,
        { day: sourceDay, period: sourcePeriod, duration: sourceDuration },
        sourceEffectiveRoomId,
        sourceDuration,
        targetSlot ? { day: targetDay, period: targetPeriod, duration: targetDuration } : undefined
    );
    if (!valMove.valid) {
         if (isHoverCheck && setHoverConflict) {
             setHoverConflict({
                 classId,
                 className: targetClassName || "Unknown",
                 reason: `${valMove.message}`,
                 day: targetDay,
                 period: targetPeriod
             });
         }
         return false;
    }

    if (targetSlot) {
         const targetSubject = subjects.find(s => s.id === targetSlot.subjectId);
         const targetEffectiveRoomId = targetSlot.roomId || targetSubject?.requiredRoomId || currentClass?.defaultRoomId;

         const valSwap = checkSlotValidity(
            data, activeDragItem.day, activeDragItem.period, targetSlot.teacherId, classId, targetSlot.subjectId,
            schedulerState,
            { day: targetDay, period: targetPeriod, duration: targetDuration },
            targetEffectiveRoomId,
            targetDuration,
            { day: activeDragItem.day, period: activeDragItem.period, duration: sourceDuration }
        );
        if (!valSwap.valid) {
             if (isHoverCheck && setHoverConflict) {
                 const targetSubj = subjects.find(s => s.id === targetSlot.subjectId);
                 setHoverConflict({
                     classId,
                     className: targetClassName || "Unknown",
                     reason: `Swap Target Invalid: ${valSwap.message} (for ${targetSubj?.name})`,
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

    const sData = active.data.current as {
      day: number;
      period: number;
      slot: ScheduleSlot;
      classGroup?: any;
    };
    
    const tData = over.data.current as {
      day: number;
      period: number;
    };

    if (!sData || !tData) return;
    if (sData.day === tData.day && sData.period === tData.period) return;

    const classId = mode === "CLASS" ? activeId : sData.classGroup?.id;
    if (!classId) return;

    // --- NORMALIZE SOURCE: If dragging the TAIL, shift reference to the HEAD ---
    let sP = sData.period;
    const sD = sData.day;
    if (sData.slot.isFixed) {
        const prev = getPrevClassIndex(sP, classId);
        if (prev !== null) sP = prev;
    }

    if (sD === tData.day && sP === tData.period) return;

    const tD = tData.day;
    const tP = tData.period;

    const sourceDuration = getDuration(classId, sD, sP);
    const targetSlot = data.schedule[classId]?.[tD]?.[tP];
    const targetDuration = targetSlot ? getDuration(classId, tD, tP) : 1;

    const tP2 = getNextClassIndex(tP, classId);

    if (targetSlot) {
        if (sourceDuration !== targetDuration) return;
    } else {
        if (sourceDuration === 2) {
            if (tP2 === null) return;
            const tSlot2 = data.schedule[classId]?.[tD]?.[tP2];
            if (tSlot2) return;
        }
    }

    const valMove = checkSlotValidity(
        data, tD, tP, sData.slot.teacherId, classId, sData.slot.subjectId,
        schedulerState,
        { day: sD, period: sP, duration: sourceDuration },
        sData.slot.roomId,
        sourceDuration,
        targetSlot ? { day: tD, period: tP, duration: targetDuration } : undefined
    );
    if (!valMove.valid) return;

    if (targetSlot) {
        const valSwap = checkSlotValidity(
            data, sD, sP, targetSlot.teacherId, classId, targetSlot.subjectId,
            schedulerState,
            { day: tD, period: tP, duration: targetDuration },
            targetSlot.roomId,
            targetDuration,
            { day: sD, period: sP, duration: sourceDuration }
        );
        if (!valSwap.valid) return;
    }


    const newSchedule = JSON.parse(JSON.stringify(data.schedule));
    if (!newSchedule[classId]) newSchedule[classId] = {};
    if (!newSchedule[classId][sD]) newSchedule[classId][sD] = {};
    if (!newSchedule[classId][tD]) newSchedule[classId][tD] = {};

    const clearSlot = (d: number, p: number, dur: number) => {
        if (!newSchedule[classId][d]) return;
        delete newSchedule[classId][d][p];
        if (dur === 2) {
            const p2 = getNextClassIndex(p, classId);
            if (p2 !== null) delete newSchedule[classId][d][p2];
        }
    };

    const setSlot = (d: number, p: number, slot: ScheduleSlot, dur: number) => {
        if (!newSchedule[classId][d]) newSchedule[classId][d] = {};
        // Ensure Head is NOT fixed
        newSchedule[classId][d][p] = { ...slot, isFixed: false };
        if (dur === 2) {
            const p2 = getNextClassIndex(p, classId);
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

    // --- LOG ACTIVITY ---
    const classObj = classes.find(c => c.id === classId);
    const subjObj = subjects.find(s => s.id === sourceSlot.subjectId);
    const teacherObj = teachers.find(t => t.id === sourceSlot.teacherId);
    
    let message = "";
    if (destSlot) {
        const targetSubj = subjects.find(s => s.id === destSlot.subjectId);
        message = `Swapped ${subjObj?.name} with ${targetSubj?.name} in ${classObj?.name}`;
    } else {
        message = `Moved ${subjObj?.name} (${teacherObj?.name}) in ${classObj?.name} to ${DAYS[tD]} P${tP + 1}`;
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
    getDuration,
    getNextClassIndex
  };
};