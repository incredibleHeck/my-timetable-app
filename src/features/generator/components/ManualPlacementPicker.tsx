import React from "react";
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
      <p className="text-xs text-content-muted mb-4">
        {dayLabel}, {periodLabel}. Choose an unplaced lesson that fits this slot.
      </p>

      {allPendingCount === 0 ? (
        <p className="rounded-md border border-edge bg-surface-muted px-4 py-3 text-xs text-content-secondary">
          All curriculum periods for this class are already on the grid.
        </p>
      ) : pendingOptions.length === 0 ? (
        <p className="rounded-md border border-edge border-l-2 border-l-accent bg-surface px-4 py-3 text-xs text-content-secondary">
          {allPendingCount} unplaced lesson{allPendingCount === 1 ? "" : "s"} remain, but none fit
          this slot — the teacher, the room or a double-period rule rules each one out. Try another
          empty period.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {pendingOptions.map((pending) => {
            const subject = subjects.find((s) => s.id === pending.subjectId);
            return (
              <li key={pending.id}>
                <button
                  type="button"
                  onClick={() => onSelect(pending)}
                  className="w-full rounded-md border border-edge bg-surface px-3 py-2.5 text-left
                             transition-colors hover:border-edge-strong focus-visible:outline-none
                             focus-visible:ring-2 focus-visible:ring-accent
                             focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: subject?.color || "#cbd5e1" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-content">
                        {pending.subjectName}
                      </div>
                      <div className="mt-0.5 truncate text-2xs text-content-muted">
                        {pending.teacherName}
                        {" · "}
                        {pending.duration === 2 ? "Double period" : "Single period"}
                      </div>
                    </div>
                  </div>
                  {pending.warning && (
                    <p className="mt-2 border-t border-edge-subtle pt-2 text-2xs text-accent-ink">
                      {pending.warning}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
};
