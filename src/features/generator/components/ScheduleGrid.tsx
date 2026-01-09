import React, { useState, useMemo } from "react";
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor,
  MouseSensor,
  TouchSensor
} from "@dnd-kit/core";
import { Lock, ArrowRightLeft } from "lucide-react";
import { AppData, ScheduleSlot, Conflict } from "../../../types";
import { DAYS } from "../../../utils/constants";
import { checkSlotValidity } from "../../../services/scheduler/validation";
import { DraggableSlot } from "./DraggableSlot";
import { DroppableCell } from "./DroppableCell";
import { useDndLogic } from "../hooks/useDndLogic";

interface Props {
  data: AppData;
  activeId: string;
  mode: "CLASS" | "TEACHER";
  onUpdate: (d: AppData) => void;
  editMode: boolean;
  setHoverConflict?: (c: Conflict | null) => void;
  highlightedConflict?: Conflict | null;
}

export const ScheduleGrid: React.FC<Props> = ({
  data,
  activeId,
  mode,
  onUpdate,
  editMode,
  setHoverConflict,
  highlightedConflict,
}) => {
  // --- SENSORS ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // 5px movement to start drag
    useSensor(MouseSensor),
    useSensor(TouchSensor)
  );

  const { settings, schedule, classes, teachers, subjects } = data;
  const currentClass = classes.find((c) => c.id === activeId);
  const currentTeacher = teachers.find((t) => t.id === activeId);

  // --- LOGIC HOOK ---
  const { activeDragItem, handleDragStart, handleDragEnd } = useDndLogic(data, activeId, mode, onUpdate);

  // --- HELPERS ---
  const getSafeType = (item: any) =>
    (typeof item === "object" ? item.type : item) || "CLASS";

  const getNextClassIndex = (p: number, classId: string): number | null => {
    const cls = classes.find((c) => c.id === classId);
    const struct = cls?.structure || settings.dayStructure;
    const limit = cls?.periodCount || settings.periodsPerDay;
    
    // MODIFIED: Search for the next available CLASS slot, skipping BREAK/LUNCH
    for (let i = p + 1; i < limit; i++) {
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
      // MODIFIED: If the next CLASS slot (even if split by break) 
      // is the second half of this double period, return 2.
      if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId)
        return 2;
    }
    return 1;
  };

  const checkDragValidity = (targetDay: number, targetPeriod: number, isHoverCheck = false): boolean => {
    if (!activeDragItem) return true;
    
    // Self check
    if (activeDragItem.day === targetDay && activeDragItem.period === targetPeriod) {
        if (isHoverCheck && setHoverConflict) setHoverConflict(null);
        return true;
    }

    // 1. Identify Source Class
    const sourceClassId = mode === "CLASS" ? activeId : activeDragItem.classGroup?.id;
    if (!sourceClassId) return false;

    // 2. Identify Target Context (Teacher Mode Handling)
    // If in TEACHER mode, the target slot might belong to a DIFFERENT class.
    // We currently do not support cross-class swapping via drag-and-drop.
    let targetClassId = sourceClassId;
    let targetClassName = mode === "CLASS" ? currentClass?.name : activeDragItem.classGroup?.name;
    
    if (mode === "TEACHER") {
         // Check if this slot is occupied by a class for the current teacher
         for (const cId of Object.keys(schedule)) {
            const s = schedule[cId]?.[targetDay]?.[targetPeriod];
            if (s && s.teacherId === activeId) {
                targetClassId = cId;
                targetClassName = classes.find(c => c.id === cId)?.name;
                break;
            }
         }
    }

    // Constraint: Can only swap/move within the same class
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

    // Helper to format conflict details
    const formatConflict = (reason: string) => {
        const subj = subjects.find(s => s.id === activeDragItem.slot.subjectId);
        const teach = teachers.find(t => t.id === activeDragItem.slot.teacherId);
        const time = `${DAYS[targetDay]} P${targetPeriod + 1}`;
        return `${reason} for ${subj?.name} (${teach?.name}) at ${time}`;
    };

    // 3. DURATION CHECK (Basic fit)
    const sourceDuration = getDuration(classId, activeDragItem.day, activeDragItem.period);
    
    // Check if target has a slot
    const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
    // MODIFIED: Use getDuration which now supports split checks
    const targetDuration = targetSlot ? getDuration(classId, targetDay, targetPeriod) : 1;

    // Strict swap constraint: must match duration
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
        // Moving to empty: Check if double fits
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
             // MODIFIED: Check the correct target index (could be split)
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
                  return false; // Overlap P2
             }
        }
    }

    // 4. CHECK SOURCE -> TARGET
    const valMove = checkSlotValidity(
        data, targetDay, targetPeriod, activeDragItem.slot.teacherId, classId, activeDragItem.slot.subjectId,
        { day: activeDragItem.day, period: activeDragItem.period },
        activeDragItem.slot.roomId,
        sourceDuration
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

    // 5. CHECK TARGET -> SOURCE (If Swap)
    if (targetSlot) {
         const valSwap = checkSlotValidity(
            data, activeDragItem.day, activeDragItem.period, targetSlot.teacherId, classId, targetSlot.subjectId,
            { day: targetDay, period: targetPeriod },
            targetSlot.roomId,
            targetDuration
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

  // --- NEW: DYNAMIC STRUCTURE (Respects Class Overrides) ---
  const currentStructure = useMemo(() => {
    if (mode === "CLASS" && currentClass?.structure?.length) {
      return currentClass.structure;
    }
    return settings.dayStructure;
  }, [mode, currentClass, settings.dayStructure]);

  // --- DYNAMIC PERIOD CALCULATION ---
  let periodsToRender = settings.periodsPerDay;
  if (mode === "CLASS" && currentClass) {
    // If structure is defined, strictly use its length.
    if (currentClass.structure?.length) {
       periodsToRender = currentClass.structure.length;
    } else {
       periodsToRender = currentClass.periodCount || settings.periodsPerDay;
    }
  } else if (mode === "TEACHER" && currentTeacher) {
    const maxClassPeriod = Math.max(
      settings.periodsPerDay,
      ...classes.map((c) => Math.max(c.periodCount || 0, c.structure?.length || 0))
    );
    periodsToRender = maxClassPeriod;
  }

  // --- HELPERS ---
  const getCellData = (day: number, period: number) => {
    if (mode === "CLASS") {
      const slot = schedule[activeId]?.[day]?.[period];
      return { slot, classId: activeId };
    } else {
      for (const cId of Object.keys(schedule)) {
        const s = schedule[cId]?.[day]?.[period];
        if (s && s.teacherId === activeId) {
          return { slot: s, classId: cId };
        }
      }
      return { slot: undefined, classId: "" };
    }
  };

  const getPeriodLabel = (index: number) => {
    const item = currentStructure?.[index];
    const type = typeof item === "string" ? item : item?.type;
    // If not defined, default to CLASS
    const effectiveType = type || "CLASS"; 

    if (effectiveType !== "CLASS") {
        const label = typeof item === "string" ? item : item?.label || item?.type;
        return label || "Break";
    }

    // Calculate sequential period number (skipping non-class slots)
    let classCount = 0;
    const limit = index;
    for (let i = 0; i <= limit; i++) {
        const pItem = currentStructure?.[i];
        const pType = typeof pItem === "string" ? pItem : pItem?.type;
        const pEffective = pType || "CLASS";
        if (pEffective === "CLASS") {
            classCount++;
        }
    }

    return `Period ${classCount}`;
  };

  const handleDragOver = (event: any) => {
      const { over } = event;
      if (!over) {
          if (setHoverConflict) setHoverConflict(null);
          return;
      }
      const { day, period } = over.data.current;
      // We perform the check with isHoverCheck = true to update the state
      checkDragValidity(day, period, true);
  };

  // --- RENDER ---
  return (
    <DndContext 
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex flex-col h-full min-w-full w-fit print:min-w-0">
        {/* STATUS BAR */}
        <div className="mb-3 p-3 rounded-lg text-xs font-bold flex items-center gap-3 transition-all shadow-sm border bg-white text-slate-500 border-slate-200">
          <div className={`p-1 rounded ${editMode ? "bg-amber-100 text-amber-600" : "bg-slate-100"}`}>
             {editMode ? <ArrowRightLeft size={14} /> : <Lock size={14} />}
          </div>
          <span>
            {editMode
              ? "Drag and drop lessons to move or swap."
              : "Read-only mode. Enable editing to modify schedule."}
          </span>
        </div>

        {/* GRID HEADER */}
        <div
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: `60px repeat(${periodsToRender}, minmax(120px, 1fr))` }}
        >
          <div className="text-right pr-3 text-[10px] font-bold text-slate-400 uppercase self-end pb-2">
            Day
          </div>
          {Array.from({ length: periodsToRender }).map((_, i) => (
            <div
              key={i}
              className="text-center bg-slate-100 rounded py-2 text-xs font-bold text-slate-600 uppercase tracking-wider"
            >
              {getPeriodLabel(i)}
            </div>
          ))}
        </div>

        {/* GRID BODY */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {DAYS.map((dayName, dIdx) => (
            <div
              key={dayName}
              className="grid gap-1 mb-1"
              style={{
                gridTemplateColumns: `60px repeat(${periodsToRender}, minmax(120px, 1fr))`,
              }}
            >
              {/* Day Label */}
              <div className="h-16 flex items-center justify-end pr-3 border-r border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase -rotate-90">
                  {dayName.substring(0, 3)}
                </span>
              </div>

              {/* Slots */}
              {Array.from({ length: periodsToRender }).map((_, pIdx) => {
                const { slot, classId } = getCellData(dIdx, pIdx);
                
                const structItem = currentStructure?.[pIdx];
                const structType = typeof structItem === "string" ? structItem : structItem?.type;
                const isBreakSlot = structType && structType !== "CLASS";

                // Determine visual state
                let content = null;
                const isValidTarget = activeDragItem ? checkDragValidity(dIdx, pIdx) : true;
                const opacityClass = !isValidTarget ? "opacity-30 grayscale cursor-not-allowed" : "";

                // Highlight Logic
                const isHighlighted = highlightedConflict && 
                    highlightedConflict.day === dIdx && 
                    highlightedConflict.period === pIdx;
                    
                const highlightClass = isHighlighted ? "ring-4 ring-red-400 ring-opacity-70 shadow-lg scale-[1.02] z-20 transition-all duration-300" : "";

                // CONTENT RENDER
                if (slot) {
                  // CHECK FOR ELECTIVE BLOCK (Split Cell)
                  if (slot.electiveBlockId) {
                     const block = data.electives?.find(e => e.id === slot.electiveBlockId);
                     const blockSubjects = block?.subjectIds.map(sid => subjects.find(s => s.id === sid)).filter(Boolean) || [];
                     
                     content = (
                       <div className={`flex flex-col h-full w-full bg-white border border-slate-200 p-0 overflow-hidden hover:shadow-md transition-shadow ${opacityClass}`}>
                         {blockSubjects.map((subj, idx) => (
                           <div 
                             key={subj?.id || idx} 
                             className={`flex-1 flex items-center px-2 text-[9px] font-bold truncate relative ${
                               idx < blockSubjects.length - 1 ? "border-b border-slate-200" : ""
                             }`}
                             style={{ backgroundColor: `${subj?.color}15`, color: subj?.color }}
                           >
                              <div className="w-1.5 h-1.5 rounded-full mr-1 shrink-0" style={{ backgroundColor: subj?.color }}></div>
                              <span className="truncate">{subj?.name}</span>
                           </div>
                         ))}
                         {blockSubjects.length === 0 && (
                           <div className="flex-1 flex items-center justify-center text-[9px] text-slate-400 italic">
                             Unknown Elective
                           </div>
                         )}
                       </div>
                     );
                  } 
                  else {
                    // STANDARD SLOT
                    const subject = subjects.find((s) => s.id === slot.subjectId);
                    const teacher = teachers.find((t) => t.id === slot.teacherId);
                    const classGroup = classes.find((c) => c.id === classId);
                    content = (
                       <div className={`w-full h-full ${opacityClass}`}>
                          <DraggableSlot
                            slot={slot}
                            day={dIdx}
                            period={pIdx}
                            subject={subject}
                            teacher={teacher}
                            classGroup={classGroup}
                            mode={mode}
                            disabled={!editMode}
                          />
                       </div>
                    );
                  }
                } else if (isBreakSlot) {
                  content = (
                    <div className="flex items-center justify-center h-full">
                       <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        {structType}
                       </span>
                    </div>
                  );
                } else {
                  // Empty Slot
                  const fixedLabel = data.settings.fixedOccasions?.[dIdx]?.[pIdx];
                  const classFixedLabel = mode === "CLASS" ? currentClass?.fixedSessions?.[dIdx]?.[pIdx] : null;
                  const finalFixed = classFixedLabel || fixedLabel;

                  if (finalFixed) {
                    let label = "Unavailable";
                    if (typeof finalFixed === "string") {
                      label = finalFixed;
                    } else if (typeof finalFixed === "object" && finalFixed !== null && "name" in finalFixed) {
                      label = finalFixed.name;
                    }

                    content = (
                      <div className="flex items-center justify-center w-full h-full bg-slate-800 rounded text-amber-400 font-bold text-[9px] uppercase tracking-wider border border-slate-700">
                        {label}
                      </div>
                    );
                  }
                  
                  // Empty Drop Target Visuals
                  if (!content && activeDragItem && !isValidTarget) {
                      content = <div className="w-full h-full bg-slate-100/50 opacity-50"></div>;
                  }
                }

                return (
                  <DroppableCell
                    key={`${dIdx}-${pIdx}`}
                    day={dIdx}
                    period={pIdx}
                    data={{ day: dIdx, period: pIdx }}
                    className={`h-16 my-1 rounded-md border border-slate-100 flex transition-all relative bg-slate-50/50 ${!content && !isValidTarget ? "bg-slate-100" : ""} ${highlightClass}`}
                  >
                    {content}
                  </DroppableCell>
                );
              })}
            </div>
          ))}
        </div>

        {/* DRAG OVERLAY */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeDragItem ? (
            <div className="h-16 w-32 shadow-2xl opacity-90 rotate-2">
               <DraggableSlot
                  slot={activeDragItem.slot}
                  day={activeDragItem.day}
                  period={activeDragItem.period}
                  subject={subjects.find(s => s.id === activeDragItem.slot.subjectId)}
                  teacher={teachers.find(t => t.id === activeDragItem.slot.teacherId)}
                  classGroup={classes.find(c => c.id === (mode === "CLASS" ? activeId : activeDragItem.classGroup?.id))}
                  mode={mode}
                  disabled={false}
               />
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

