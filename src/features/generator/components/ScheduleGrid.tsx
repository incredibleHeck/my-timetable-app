import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  DragOverEvent,
} from "@dnd-kit/core";
import { Lock, ArrowRightLeft } from "lucide-react";
import { AppData, Conflict, PeriodConfig } from "../../../types";
import { DAYS } from "../../../utils/constants";
import { getOccasionLabel } from "../../../utils/utils";
import { calculateClassSchedule } from "../../../utils/timeUtils";
import { useToast } from "../../../components/ui/Toast";
import { DraggableSlot } from "./DraggableSlot";
import { DroppableCell } from "./DroppableCell";
import { EmptySlotPlacementButton } from "./EmptySlotPlacementButton";
import { ManualPlacementPicker } from "./ManualPlacementPicker";
import { useDndLogic } from "../hooks/useDndLogic";
import { useManualPlacement } from "../hooks/useManualPlacement";
import { PendingPlacement } from "../utils/pendingPlacements";

interface Props {
  data: AppData;
  activeId: string;
  mode: "CLASS" | "TEACHER";
  onUpdate: (d: AppData) => void;
  editMode: boolean;
  manualPlacementMode?: boolean;
  setHoverConflict?: (c: Conflict | null) => void;
  highlightedConflict?: Conflict | null;
}

export const ScheduleGrid: React.FC<Props> = ({
  data,
  activeId,
  mode,
  onUpdate,
  editMode,
  manualPlacementMode = false,
  setHoverConflict,
  highlightedConflict,
}) => {
  const { showToast } = useToast();
  const [placementTarget, setPlacementTarget] = useState<{
    day: number;
    period: number;
  } | null>(null);

  // --- SENSORS ---
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(MouseSensor),
    useSensor(TouchSensor),
  );

  const { settings, schedule, classes, teachers, subjects } = data;
  const currentClass = classes.find((c) => c.id === activeId);
  const currentTeacher = teachers.find((t) => t.id === activeId);

  // --- LOGIC HOOK ---
  const { activeDragItem, handleDragStart, handleDragEnd, checkDragValidity } = useDndLogic(
    data,
    activeId,
    mode,
    onUpdate,
    setHoverConflict,
  );

  const { listPendingForClass, listValidPendingForSlot, placePendingLesson } = useManualPlacement(
    data,
    onUpdate,
  );

  const showManualPlacement =
    manualPlacementMode && editMode && mode === "CLASS" && !activeDragItem;

  const pendingForClass = useMemo(
    () => (mode === "CLASS" ? listPendingForClass(activeId) : []),
    [mode, activeId, listPendingForClass],
  );

  const handlePlacementSelect = (pending: PendingPlacement) => {
    if (!placementTarget || mode !== "CLASS") return;

    const result = placePendingLesson(
      activeId,
      placementTarget.day,
      placementTarget.period,
      pending,
    );

    if (result.ok) {
      showToast(`Placed ${pending.subjectName} on the grid.`, "success");
      setPlacementTarget(null);
    } else {
      showToast(result.message, "error");
    }
  };

  // --- HELPERS ---
  const currentStructure = useMemo(() => {
    if (mode === "CLASS" && currentClass?.structure?.length) {
      return currentClass.structure;
    }
    return settings.dayStructure;
  }, [mode, currentClass, settings.dayStructure]);

  const classSchedule = useMemo(() => {
    if (mode === "CLASS" && currentClass) {
      return calculateClassSchedule(currentClass, settings, currentStructure);
    }
    return [];
  }, [mode, currentClass, settings, currentStructure]);

  let periodsToRender = settings.periodsPerDay;
  if (mode === "CLASS" && currentClass) {
    if (currentClass.structure?.length) {
      periodsToRender = currentClass.structure.length;
    } else {
      periodsToRender = currentClass.periodCount || settings.periodsPerDay;
    }
  } else if (mode === "TEACHER" && currentTeacher) {
    const maxClassPeriod = Math.max(
      settings.periodsPerDay,
      ...classes.map((c) => Math.max(c.periodCount || 0, c.structure?.length || 0)),
    );
    periodsToRender = maxClassPeriod;
  }

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
    const type = typeof item === "object" ? item.type : item || "CLASS";
    const effectiveType = type || "CLASS";

    let label: string;
    if (effectiveType !== "CLASS") {
      const l = typeof item === "string" ? item : (item as PeriodConfig)?.label || effectiveType;
      label = l || "Break";
    } else {
      let classCount = 0;
      for (let i = 0; i <= index; i++) {
        const pItem = currentStructure?.[i];
        const pType = typeof pItem === "object" ? pItem.type : pItem || "CLASS";
        if ((pType || "CLASS") === "CLASS") {
          classCount++;
        }
      }
      label = `Period ${classCount}`;
    }

    const time = classSchedule[index];
    if (time && mode === "CLASS") {
      return (
        <div className="flex flex-col items-center">
          <span>{label}</span>
          <span className="text-[10px] font-normal lowercase opacity-70">
            ({time.start} - {time.end})
          </span>
        </div>
      );
    }

    return label;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      if (setHoverConflict) setHoverConflict(null);
      return;
    }
    const currentData = over.data.current as { day: number; period: number } | undefined;
    if (currentData) {
      checkDragValidity(currentData.day, currentData.period, true);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <div className="flex flex-col h-full min-w-full w-fit print:min-w-0">
        {/* STATUS BAR */}
        <div className="mb-3 p-3 rounded-lg text-xs font-bold flex items-center gap-3 transition-all shadow-sm border bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
          <div
            className={`p-1 rounded ${editMode ? "bg-amber-100 text-amber-600" : "bg-slate-100 dark:bg-slate-800"}`}
          >
            {editMode ? <ArrowRightLeft size={14} /> : <Lock size={14} />}
          </div>
          <span>
            {manualPlacementMode && mode === "CLASS"
              ? "Manual placement: click + on empty slots to assign unplaced lessons."
              : editMode
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
              className="text-center bg-slate-100 dark:bg-slate-800 rounded py-2 text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider"
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
              <div className="h-16 flex items-center justify-end pr-3 border-r border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase -rotate-90">
                  {dayName.substring(0, 3)}
                </span>
              </div>

              {Array.from({ length: periodsToRender }).map((_, pIdx) => {
                const { slot, classId } = getCellData(dIdx, pIdx);
                const structItem = currentStructure?.[pIdx];
                const structType =
                  typeof structItem === "object" ? structItem.type : structItem || "CLASS";
                const isBreakSlot = structType && structType !== "CLASS";

                let content = null;
                const isValidTarget = activeDragItem ? checkDragValidity(dIdx, pIdx) : true;
                const opacityClass = !isValidTarget
                  ? "opacity-30 grayscale cursor-not-allowed"
                  : "";

                const isHighlighted =
                  highlightedConflict &&
                  highlightedConflict.day === dIdx &&
                  highlightedConflict.period === pIdx;

                const highlightClass = isHighlighted
                  ? "ring-4 ring-red-400 ring-opacity-70 shadow-lg scale-[1.02] z-20 transition-all duration-300"
                  : "";

                if (slot) {
                  if (slot.electiveBlockId) {
                    const block = data.electives?.find((e) => e.id === slot.electiveBlockId);
                    const blockSubjects =
                      block?.subjectIds
                        .map((sid) => subjects.find((s) => s.id === sid))
                        .filter(Boolean) || [];

                    content = (
                      <div
                        className={`flex flex-col h-full w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0 overflow-hidden hover:shadow-md transition-shadow ${opacityClass}`}
                      >
                        {blockSubjects.map((subj, idx) => (
                          <div
                            key={subj?.id || idx}
                            className={`flex-1 flex items-center px-2 text-[9px] font-bold truncate relative ${
                              idx < blockSubjects.length - 1
                                ? "border-b border-slate-200 dark:border-slate-700"
                                : ""
                            }`}
                            style={{ backgroundColor: `${subj?.color}15`, color: subj?.color }}
                          >
                            <div
                              className="w-1.5 h-1.5 rounded-full mr-1 shrink-0"
                              style={{ backgroundColor: subj?.color }}
                            ></div>
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
                  } else {
                    const subject = subjects.find((s) => s.id === slot.subjectId);
                    const teacher = teachers.find((t) => t.id === slot.teacherId);
                    const classGroup = classes.find((c) => c.id === classId);

                    let timeRange = "";
                    if (mode === "TEACHER" && classGroup) {
                      const classSched = calculateClassSchedule(
                        classGroup,
                        settings,
                        classGroup.structure || settings.dayStructure,
                      );
                      const slotTime = classSched[pIdx];
                      if (slotTime) {
                        timeRange = `${slotTime.start} - ${slotTime.end}`;
                      }
                    }

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
                          timeRange={timeRange}
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
                  const fixedLabel = data.settings.fixedOccasions?.[dIdx]?.[pIdx];
                  const classFixedLabel =
                    mode === "CLASS" ? currentClass?.fixedSessions?.[dIdx]?.[pIdx] : null;
                  const finalFixed = classFixedLabel || fixedLabel;

                  const fixedText = getOccasionLabel(finalFixed);
                  if (fixedText) {
                    content = (
                      <div className="flex items-center justify-center w-full h-full bg-slate-800 rounded text-amber-400 font-bold text-[9px] uppercase tracking-wider border border-slate-700">
                        {fixedText}
                      </div>
                    );
                  }

                  if (!content && activeDragItem && !isValidTarget) {
                    content = <div className="w-full h-full bg-slate-100/50 opacity-50"></div>;
                  }

                  if (!content && showManualPlacement && !fixedText) {
                    content = (
                      <EmptySlotPlacementButton
                        hasPending={pendingForClass.length > 0}
                        onClick={() => setPlacementTarget({ day: dIdx, period: pIdx })}
                      />
                    );
                  }
                }

                return (
                  <DroppableCell
                    key={`${dIdx}-${pIdx}`}
                    day={dIdx}
                    period={pIdx}
                    data={{ day: dIdx, period: pIdx }}
                    isValidTarget={isValidTarget}
                    isActiveDrag={!!activeDragItem}
                    className={`h-16 my-1 rounded-md border border-slate-100 dark:border-slate-700 flex transition-all relative bg-slate-50/50 ${!content && !isValidTarget ? "bg-slate-100 dark:bg-slate-800" : ""} ${highlightClass}`}
                  >
                    {content}
                  </DroppableCell>
                );
              })}
            </div>
          ))}
        </div>

        <DragOverlay
          dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}
        >
          {activeDragItem ? (
            <div className="h-16 w-32 shadow-2xl opacity-90 rotate-2">
              <DraggableSlot
                slot={activeDragItem.slot}
                day={activeDragItem.day}
                period={activeDragItem.period}
                subject={subjects.find((s) => s.id === activeDragItem.slot.subjectId)}
                teacher={teachers.find((t) => t.id === activeDragItem.slot.teacherId)}
                classGroup={classes.find(
                  (c) => c.id === (mode === "CLASS" ? activeId : activeDragItem.classGroup?.id),
                )}
                mode={mode}
                disabled={false}
              />
            </div>
          ) : null}
        </DragOverlay>

        {placementTarget && mode === "CLASS" && currentClass && (
          <ManualPlacementPicker
            isOpen={true}
            onClose={() => setPlacementTarget(null)}
            dayLabel={DAYS[placementTarget.day]}
            periodLabel={`Period ${placementTarget.period + 1}`}
            className={currentClass.name}
            pendingOptions={listValidPendingForSlot(
              activeId,
              placementTarget.day,
              placementTarget.period,
            )}
            allPendingCount={pendingForClass.length}
            subjects={subjects}
            onSelect={handlePlacementSelect}
          />
        )}
      </div>
    </DndContext>
  );
};
