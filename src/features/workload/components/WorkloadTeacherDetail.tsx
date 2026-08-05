import React, { useEffect, useId, useRef, useState } from "react";
import { ClassWorkloadBreakdown } from "../hooks/useWorkloadStats";

interface WorkloadTeacherDetailProps {
  teacherName: string;
  assignedPeriods: number;
  maxWeeklyCapacity: number;
  targetLoad?: number;
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
  targetLoad,
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
        className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        {children}
      </div>

      {isOpen && (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Workload breakdown for ${teacherName}`}
          className="absolute left-0 right-0 top-full z-20 mt-2 rounded-lg border border-edge bg-surface p-4 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-1 text-sm font-medium text-content">{teacherName}</p>
          <p className="mb-3 text-2xs text-content-muted">
            <strong>{assignedPeriods}</strong> requested / <strong>{maxWeeklyCapacity}</strong>{" "}
            weekly max
            {targetLoad != null && targetLoad > 0 && (
              <>
                {" "}
                · Target: <strong>{targetLoad}</strong> periods/week
              </>
            )}
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
            <ul className="custom-scrollbar max-h-48 divide-y divide-edge-subtle overflow-y-auto">
              {classBreakdown.map((row) => (
                <li
                  key={`${row.classId}:${row.subjectId}`}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 py-1.5 text-2xs"
                  title={`${row.className} — ${row.subjectName}`}
                >
                  <span className="whitespace-nowrap text-content-secondary">{row.className}</span>
                  <span className="truncate text-content-muted">{row.subjectName}</span>
                  <span className="whitespace-nowrap text-right tabular-nums text-content">
                    {row.periods} {row.periods === 1 ? "period" : "periods"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-2xs text-content-muted">No class assignments in curriculum.</p>
          )}

          <p className="mt-2 text-2xs text-content-muted">
            {pinned ? "Click again or press Escape to close" : "Click to pin · hover to preview"}
          </p>
        </div>
      )}
    </div>
  );
};
