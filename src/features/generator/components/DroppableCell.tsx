import React from "react";
import { useDroppable } from "@dnd-kit/core";

interface DroppableCellProps {
  day: number;
  period: number;
  data?: any;
  children: React.ReactNode;
  isOver?: boolean; // Prop from parent to override visual state if needed, or derived locally
  className?: string;
  disabled?: boolean;
}

export const DroppableCell: React.FC<DroppableCellProps> = ({
  day,
  period,
  data,
  children,
  className = "",
  disabled = false,
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${day}-${period}`,
    data: { day, period, ...data },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${
        isOver ? "ring-2 ring-blue-400 z-10" : ""
      }`}
    >
      {children}
    </div>
  );
};
