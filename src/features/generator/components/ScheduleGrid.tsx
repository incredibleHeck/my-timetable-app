import React, { useState, useMemo } from "react";
import { Lock, Move, ArrowRightLeft, AlertCircle } from "lucide-react";
import { AppData, ScheduleSlot } from "../../../types";
import { DAYS } from "../../../utils/constants";
import { checkSlotValidity } from "../../../utils/schedulerValidation";
import { DraggableSlot } from "./DraggableSlot";

interface Props {
  data: AppData;
  activeId: string;
  mode: "CLASS" | "TEACHER";
  onUpdate: (d: AppData) => void;
  editMode: boolean;
  editTool: "MOVE" | "SWAP";
}

export const ScheduleGrid: React.FC<Props> = ({
  data,
  activeId,
  mode,
  onUpdate,
  editMode,
  editTool,
}) => {
  // --- STATE ---
  // We use a "Selected" state instead of native DnD for better visual control
  const [selected, setSelected] = useState<{
    day: number;
    period: number;
    slot: ScheduleSlot;
    originalClassId: string; // Critical for Teacher Mode sync
  } | null>(null);

  const [hoverFeedback, setHoverFeedback] = useState<string | null>(null);

  const { settings, schedule, classes, teachers, subjects } = data;
  const currentClass = classes.find((c) => c.id === activeId);
  const currentTeacher = teachers.find((t) => t.id === activeId);

  // --- DYNAMIC PERIOD CALCULATION (Preserved from your code) ---
  let periodsToRender = settings.periodsPerDay;
  if (mode === "CLASS" && currentClass) {
    periodsToRender = currentClass.periodCount || settings.periodsPerDay;
  } else if (mode === "TEACHER" && currentTeacher) {
    let maxAssignedPeriod = settings.periodsPerDay - 1;
    Object.values(schedule).forEach((classDays) => {
      Object.values(classDays).forEach((periodMap) => {
        Object.entries(periodMap).forEach(([pStr, slot]) => {
          if ((slot as ScheduleSlot).teacherId === currentTeacher.id)
            maxAssignedPeriod = Math.max(maxAssignedPeriod, parseInt(pStr));
        });
      });
    });
    periodsToRender = maxAssignedPeriod + 1;
  }

  // --- HELPERS ---
  const getCellData = (day: number, period: number) => {
    if (mode === "CLASS") {
      const slot = schedule[activeId]?.[day]?.[period];
      return { slot, classId: activeId };
    } else {
      // Teacher Mode: Reverse Lookup
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
    const struct = settings.dayStructure?.[index];
    if (struct && struct.type !== "CLASS") return struct.type; // BREAK or LUNCH
    return `Period ${index + 1}`;
  };

  // --- INTERACTION ---
  const handleSlotClick = (day: number, period: number) => {
    if (!editMode) return;

    const { slot, classId } = getCellData(day, period);

    // 1. SELECT (Pick Up)
    if (!selected) {
      if (slot) {
        if (slot.locked) {
          setHoverFeedback("This slot is locked.");
          return;
        }
        // In Teacher Mode, classId is dynamic. In Class Mode, it's activeId.
        // We MUST know the classId to check constraints properly.
        const actualClassId = mode === "CLASS" ? activeId : classId;

        setSelected({
          day,
          period,
          slot,
          originalClassId: actualClassId,
        });
        setHoverFeedback("Select a green slot to move, or orange to swap.");
      }
      return;
    }

    // 2. ACTION (Drop or Swap)
    if (selected) {
      // If clicking self, deselect
      if (selected.day === day && selected.period === period) {
        setSelected(null);
        setHoverFeedback(null);
        return;
      }

      const targetClassId = selected.originalClassId; // We stay in the same class context

      // Validate Move
      const validation = checkSlotValidity(
        data,
        day,
        period,
        selected.slot.teacherId,
        targetClassId,
        { day: selected.day, period: selected.period }
      );

      if (!validation.valid) {
        // Don't allow move, just shake or alert
        // (Visual feedback is already red, but we prevent action here)
        return;
      }

      // EXECUTE MOVE/SWAP
      const newSchedule = { ...schedule };

      // Ensure paths exist
      if (!newSchedule[targetClassId]) newSchedule[targetClassId] = [];
      if (!newSchedule[targetClassId][selected.day])
        newSchedule[targetClassId][selected.day] = [];
      if (!newSchedule[targetClassId][day])
        newSchedule[targetClassId][day] = [];

      // 1. Remove from source
      delete newSchedule[targetClassId][selected.day][selected.period];

      // 2. Handle Swap (if target occupied)
      const targetSlot = getCellData(day, period).slot;
      if (targetSlot) {
        // Move target to source
        newSchedule[targetClassId][selected.day][selected.period] = targetSlot;
      }

      // 3. Place source at target
      newSchedule[targetClassId][day][period] = selected.slot;

      onUpdate({ ...data, schedule: newSchedule });
      setSelected(null);
      setHoverFeedback(null);
    }
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-full min-w-full w-fit print:min-w-0">
      {/* STATUS BAR */}
      <div
        className={`mb-3 p-3 rounded-lg text-xs font-bold flex items-center gap-3 transition-all shadow-sm border ${
          selected
            ? "bg-blue-600 text-white border-blue-700"
            : "bg-white text-slate-500 border-slate-200"
        }`}
      >
        {selected ? (
          <>
            <div className="p-1 bg-white/20 rounded">
              <Move size={14} className="animate-pulse" />
            </div>
            <span>
              Moving:{" "}
              <span className="underline decoration-blue-300 decoration-2 underline-offset-2">
                {subjects.find((s) => s.id === selected.slot.subjectId)?.name}
              </span>
            </span>
            <span className="opacity-50 mx-2">|</span>
            <span>{hoverFeedback || "Select a destination..."}</span>
          </>
        ) : (
          <>
            <div
              className={`p-1 rounded ${
                editMode ? "bg-amber-100 text-amber-600" : "bg-slate-100"
              }`}
            >
              {editMode ? <ArrowRightLeft size={14} /> : <Lock size={14} />}
            </div>
            <span>
              {editMode
                ? "Click a lesson to pick it up."
                : "Read-only mode. Enable editing to modify schedule."}
            </span>
          </>
        )}
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
              const structType = settings.dayStructure?.[pIdx]?.type;
              const isGlobalBreak = structType && structType !== "CLASS";

              // Determine visual state
              let cellClass = "bg-slate-50/50 border-slate-100";
              let content = null;
              let isClickable = editMode;

              // 1. IS SELECTED (Source)
              if (selected?.day === dIdx && selected?.period === pIdx) {
                cellClass =
                  "bg-blue-50 border-blue-400 ring-2 ring-blue-400 z-10 opacity-75";
              }
              // 2. IS VALID TARGET (During Drag)
              else if (selected) {
                const validation = checkSlotValidity(
                  data,
                  dIdx,
                  pIdx,
                  selected.slot.teacherId,
                  selected.originalClassId, // Use original class context
                  { day: selected.day, period: selected.period }
                );

                if (validation.valid) {
                  if (validation.isSwap) {
                    cellClass =
                      "bg-amber-50 border-amber-300 cursor-pointer hover:bg-amber-100 ring-1 ring-amber-200";
                  } else {
                    cellClass =
                      "bg-emerald-50 border-emerald-300 cursor-pointer hover:bg-emerald-100 ring-1 ring-emerald-200";
                  }
                } else {
                  cellClass =
                    "bg-red-50 border-red-200 cursor-not-allowed opacity-60 grayscale-[0.5]";
                }
              }

              // CONTENT RENDER
              if (isGlobalBreak) {
                content = (
                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    {structType}
                  </span>
                );
                isClickable = false;
              } else if (slot) {
                const subject = subjects.find((s) => s.id === slot.subjectId);
                const teacher = teachers.find((t) => t.id === slot.teacherId);
                content = (
                  <DraggableSlot
                    slot={slot}
                    subject={subject}
                    teacher={teacher}
                    isDragging={false} // We handle drag visual via parent class
                    onDragStart={() => {}} // Disabled native drag
                  />
                );
              } else {
                // Empty Slot
                // Check if it's a fixed/reserved slot
                const fixedLabel = data.settings.fixedOccasions?.[dIdx]?.[pIdx];
                if (fixedLabel) {
                  let label = "Unavailable";
                  if (typeof fixedLabel === "string") {
                    label = fixedLabel;
                  } else if (typeof fixedLabel === "object" && fixedLabel !== null && "name" in fixedLabel) {
                    label = fixedLabel.name;
                  }

                  content = (
                    <div className="flex items-center justify-center w-full h-full bg-slate-800 rounded text-amber-400 font-bold text-[9px] uppercase tracking-wider border border-slate-700">
                      {label}
                    </div>
                  );
                  cellClass = "p-0 border-none bg-transparent"; // Reset container
                  isClickable = false;
                }
              }

              return (
                <div
                  key={`${dIdx}-${pIdx}`}
                  onClick={() => isClickable && handleSlotClick(dIdx, pIdx)}
                  onMouseEnter={() => {
                    if (selected) {
                      const validation = checkSlotValidity(
                        data,
                        dIdx,
                        pIdx,
                        selected.slot.teacherId,
                        selected.originalClassId,
                        { day: selected.day, period: selected.period }
                      );
                      setHoverFeedback(
                        validation.valid
                          ? validation.isSwap
                            ? "Click to SWAP"
                            : "Click to MOVE here"
                          : validation.message || "Blocked"
                      );
                    }
                  }}
                  className={`h-16 my-1 rounded-md border flex transition-all relative ${cellClass}`}
                >
                  {/* Overlay for Red State (Conflict Message on Hover) */}
                  {content}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
