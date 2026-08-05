import React, { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Users, Repeat, Lock, BookOpen, Clock } from "lucide-react";
import { ScheduleSlot, Subject, Teacher, ClassGroup } from "../../../types";

interface Props {
  slot: ScheduleSlot;
  day: number;
  period: number;
  subject?: Subject;
  teacher?: Teacher;
  classGroup?: ClassGroup;
  mode: "CLASS" | "TEACHER" | "ROOM";
  disabled?: boolean;
  timeRange?: string;
}

// Wrapped in memo for performance (prevents unnecessary re-renders in large grids)
export const DraggableSlot: React.FC<Props> = memo(
  ({ slot, day, period, subject, teacher, classGroup, mode, disabled, timeRange }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: `slot-${day}-${period}`,
      data: { slot, day, period, classGroup, teacher }, // Pass all context data
      disabled: disabled || slot.isFixed,
    });

    const style = transform
      ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
          zIndex: 999, // Ensure it's above everything while dragging
        }
      : undefined;

    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        style={{
          ...style,
          borderLeftColor: subject?.color || "#cbd5e1",
        }}
        className={`relative group border-l-4 shadow-sm rounded-r-md p-2 flex flex-col justify-center w-full h-full transition-shadow bg-white dark:bg-slate-800 overflow-hidden print:border print:border-slate-300 touch-none
         ${
           slot.isFixed
             ? "opacity-90 cursor-not-allowed bg-slate-50 dark:bg-slate-900"
             : // The cursor used to promise a grab whenever the slot was not a
               // fixed occasion, including in views where dragging is switched off.
               disabled
               ? "cursor-default"
               : "cursor-grab active:cursor-grabbing hover:shadow-md"
         }
         ${
           isDragging
             ? "opacity-40 z-50 ring-2 ring-accent" // the lifted copy is what the cursor follows
             : ""
         }
      `}
      >
        {/* Background tint */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundColor: subject?.color || "#cbd5e1" }}
        ></div>

        <div className="font-bold text-xs text-slate-800 dark:text-slate-100 leading-tight truncate relative z-10">
          {subject?.name}
        </div>

        <div className="text-2xs text-content-muted truncate mt-1 flex items-center gap-1 relative z-10">
          {mode === "CLASS" ? (
            <>
              <Users size={10} /> {teacher?.name || "Unassigned"}
            </>
          ) : (
            <>
              <BookOpen size={10} /> {classGroup?.name || "Unknown Class"}
            </>
          )}
        </div>

        {/* TIME LABEL (Teacher Mode Only) */}
        {mode !== "CLASS" && timeRange && (
          <div className="text-2xs font-bold text-content-muted mt-1 flex items-center gap-1 relative z-10 uppercase tracking-tight">
            <Clock size={8} /> {timeRange}
          </div>
        )}

        {/* Icons for Interaction Status */}
        {!slot.isFixed ? (
          <div className="absolute top-1 right-1 text-content-muted opacity-50 group-hover:opacity-100 transition-opacity">
            <Repeat size={10} />
          </div>
        ) : (
          <div className="absolute top-1 right-1 text-slate-300 opacity-50">
            <Lock size={10} />
          </div>
        )}
      </div>
    );
  },
);

DraggableSlot.displayName = "DraggableSlot";
