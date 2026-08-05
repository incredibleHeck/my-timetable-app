import React from "react";
import { useDroppable } from "@dnd-kit/core";

interface DroppableCellProps {
  day: number;
  period: number;
  data?: Record<string, unknown>;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  isValidTarget?: boolean;
  isActiveDrag?: boolean;
}

export const DroppableCell: React.FC<DroppableCellProps> = ({
  day,
  period,
  data,
  children,
  className = "",
  disabled = false,
  isValidTarget = true,
  isActiveDrag = false,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${day}-${period}`,
    data: { day, period, ...data },
    disabled,
  });

  // Drop feedback. Valid and invalid targets keep their green/red meaning, but
  // the hovered cell no longer shrinks to 0.98 — scaling a cell inside a grid
  // made its neighbours appear to twitch as the pointer crossed them.
  let dragFeedbackClass = "";
  if (isActiveDrag) {
    if (isOver) {
      dragFeedbackClass = isValidTarget
        ? "ring-2 ring-success bg-success/10 z-10"
        : "ring-2 ring-danger bg-danger/10 cursor-not-allowed z-10";
    } else {
      dragFeedbackClass = isValidTarget
        ? "border-dashed border-success/50"
        : "opacity-40 grayscale";
    }
  } else if (isOver) {
    dragFeedbackClass = "ring-2 ring-accent z-10";
  }

  return (
    <div
      ref={setNodeRef}
      className={`transition-colors duration-150 ${className} ${dragFeedbackClass}`}
    >
      {children}
    </div>
  );
};
