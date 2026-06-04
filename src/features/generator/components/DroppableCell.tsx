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

  // Dynamic border/background classes based on active drag states
  let dragFeedbackClass = "";
  if (isActiveDrag) {
    if (isOver) {
      dragFeedbackClass = isValidTarget
        ? "ring-2 ring-emerald-500 bg-emerald-500/10 scale-[0.98] z-10 shadow-md"
        : "ring-2 ring-rose-500 bg-rose-500/10 cursor-not-allowed z-10 shadow-inner";
    } else {
      dragFeedbackClass = isValidTarget
        ? "border-dashed border-emerald-400 bg-emerald-500/[0.02]"
        : "opacity-40 grayscale";
    }
  } else if (isOver) {
    dragFeedbackClass = "ring-2 ring-blue-400 z-10";
  }

  return (
    <div
      ref={setNodeRef}
      className={`transition-all duration-200 ${className} ${dragFeedbackClass}`}
    >
      {children}
    </div>
  );
};
