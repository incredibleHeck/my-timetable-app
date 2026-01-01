import React, { memo } from "react";
import { Users, Move, Lock } from "lucide-react";
import { ScheduleSlot, Subject, Teacher } from "../../../types";

interface Props {
  slot: ScheduleSlot;
  subject?: Subject;
  teacher?: Teacher;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
}

// Wrapped in memo for performance (prevents unnecessary re-renders in large grids)
export const DraggableSlot: React.FC<Props> = memo(
  ({ slot, subject, teacher, isDragging, onDragStart }) => {
    return (
      <div
        draggable={!slot.isFixed}
        onDragStart={onDragStart}
        className={`relative group border-l-4 shadow-sm rounded-r-md p-2 flex flex-col justify-center w-full h-full transition-all bg-white overflow-hidden print:border print:border-slate-300 
         ${
           slot.isFixed
             ? "opacity-90 cursor-not-allowed bg-slate-50"
             : "cursor-grab active:cursor-grabbing hover:shadow-md"
         } 
         ${
           isDragging
             ? "opacity-50 scale-95 border-dashed border-slate-400"
             : ""
         }
      `}
        style={{ borderLeftColor: subject?.color || "#cbd5e1" }}
      >
        {/* Background tint */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundColor: subject?.color || "#cbd5e1" }}
        ></div>

        <div className="font-bold text-xs text-slate-800 leading-tight truncate relative z-10">
          {subject?.name}
        </div>

        <div className="text-[10px] text-slate-500 truncate mt-1 flex items-center gap-1 relative z-10">
          <Users size={10} /> {teacher?.name || "Unassigned"}
        </div>

        {/* Icons for Interaction Status */}
        {!slot.isFixed ? (
          <div className="absolute top-1 right-1 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <Move size={10} />
          </div>
        ) : (
          <div className="absolute top-1 right-1 text-slate-300 opacity-50">
            <Lock size={10} />
          </div>
        )}
      </div>
    );
  }
);

DraggableSlot.displayName = "DraggableSlot";
