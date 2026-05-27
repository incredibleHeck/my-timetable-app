import React from "react";
import { BookOpen, Clock, Users } from "lucide-react";
import { Modal } from "../../../components/ui";
import { Subject } from "../../../types";
import { PendingPlacement } from "../utils/pendingPlacements";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dayLabel: string;
  periodLabel: string;
  className: string;
  pendingOptions: PendingPlacement[];
  allPendingCount: number;
  subjects: Subject[];
  onSelect: (pending: PendingPlacement) => void;
}

export const ManualPlacementPicker: React.FC<Props> = ({
  isOpen,
  onClose,
  dayLabel,
  periodLabel,
  className,
  pendingOptions,
  allPendingCount,
  subjects,
  onSelect,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Place lesson — ${className}`}
      maxWidth="max-w-md"
    >
      <p className="text-xs text-slate-500 mb-4">
        {dayLabel}, {periodLabel}. Choose an unplaced lesson that fits this slot.
      </p>

      {allPendingCount === 0 ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs text-emerald-700 font-medium">
          All curriculum periods for this class are already on the grid.
        </div>
      ) : pendingOptions.length === 0 ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800 font-medium">
          {allPendingCount} unplaced lesson{allPendingCount === 1 ? "" : "s"} remain,
          but none can be placed in this slot (teacher, room, or double-period rules).
          Try another empty period.
        </div>
      ) : (
        <ul className="space-y-2">
          {pendingOptions.map((pending) => {
            const subject = subjects.find((s) => s.id === pending.subjectId);
            return (
              <li key={pending.id}>
                <button
                  type="button"
                  onClick={() => onSelect(pending)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: subject?.color || "#cbd5e1" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-slate-800 truncate flex items-center gap-2">
                        <BookOpen size={14} className="text-slate-400 shrink-0" />
                        {pending.subjectName}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} />
                          {pending.teacherName}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} />
                          {pending.duration === 2 ? "Double period" : "Single period"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};
