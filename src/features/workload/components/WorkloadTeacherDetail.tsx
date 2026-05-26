import React, { useEffect, useId, useRef, useState } from "react";
import { ClassWorkloadBreakdown } from "../hooks/useWorkloadStats";

interface WorkloadTeacherDetailProps {
  teacherName: string;
  assignedPeriods: number;
  maxWeeklyCapacity: number;
  scheduledPeriods: number;
  blockedSlots: number;
  classBreakdown: ClassWorkloadBreakdown[];
  children: React.ReactNode;
}

const HOVER_DELAY_MS = 280;

export const WorkloadTeacherDetail: React.FC<WorkloadTeacherDetailProps> = ({
  teacherName,
  assignedPeriods,
  maxWeeklyCapacity,
  scheduledPeriods,
  blockedSlots,
  classBreakdown,
  children,
}) => {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinned, setPinned] = useState(false);
  const [hoverOpen, setHoverOpen] = useState(false);

  const isOpen = pinned || hoverOpen;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    if (pinned) return;
    clearHoverTimer();
    hoverTimerRef.current = setTimeout(() => setHoverOpen(true), HOVER_DELAY_MS);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    if (!pinned) setHoverOpen(false);
  };

  const handleTogglePin = () => {
    setPinned((prev) => !prev);
    setHoverOpen(false);
  };

  useEffect(() => {
    if (!pinned) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPinned(false);
    };

    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setPinned(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [pinned]);

  useEffect(() => () => clearHoverTimer(), []);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls={panelId}
        onClick={handleTogglePin}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleTogglePin();
          }
        }}
        className="outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 rounded-xl"
      >
        {children}
      </div>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Workload breakdown for ${teacherName}`}
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-bold text-slate-800 mb-1">{teacherName}</p>
          <p className="text-[11px] text-slate-500 mb-3">
            <strong>{assignedPeriods}</strong> requested /{" "}
            <strong>{maxWeeklyCapacity}</strong> weekly max
            {scheduledPeriods > 0 && (
              <>
                {" "}
                · <strong>{scheduledPeriods}</strong> scheduled
              </>
            )}
            {blockedSlots > 0 && (
              <>
                {" "}
                · <strong>{blockedSlots}</strong> blocked slots
              </>
            )}
          </p>

          {classBreakdown.length > 0 ? (
            <ul className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {classBreakdown.map((row) => (
                <li
                  key={row.classId}
                  className="flex justify-between gap-3 text-[11px] border-b border-slate-50 pb-1 last:border-0"
                >
                  <span className="text-slate-700 truncate" title={row.className}>
                    {row.className}
                  </span>
                  <span className="font-bold text-slate-800 shrink-0">
                    {row.periods} {row.periods === 1 ? "period" : "periods"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              No class assignments in curriculum.
            </p>
          )}

          <p className="text-[9px] text-slate-400 mt-2">
            {pinned ? "Click again or press Escape to close" : "Click to pin · hover to preview"}
          </p>
        </div>
      )}
    </div>
  );
};
