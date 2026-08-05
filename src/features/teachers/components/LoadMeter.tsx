import React from "react";

interface LoadMeterProps {
  assignedPeriods: number;
  capacity: number;
  utilizationPct: number;
}

/**
 * Weekly load as a number first and a bar second. The bar is a 3px rule rather
 * than a rounded pill: forty of them in a column should read as a sparkline
 * gauge you can scan down, not as forty progress widgets.
 */
export const LoadMeter: React.FC<LoadMeterProps> = ({
  assignedPeriods,
  capacity,
  utilizationPct,
}) => {
  const pct = Math.round(utilizationPct);
  const isOver = utilizationPct > 100;
  const isHigh = utilizationPct > 85;
  const isIdle = assignedPeriods === 0;

  const bar = isOver ? "bg-danger" : isHigh ? "bg-accent" : "bg-success";
  const ink = isOver
    ? "text-danger-ink"
    : isHigh
      ? "text-accent-ink"
      : isIdle
        ? "text-content-muted"
        : "text-content-secondary";

  return (
    <div className="ml-auto w-28">
      <div className="flex items-baseline justify-end gap-1.5 tabular-nums">
        <span className="text-sm text-content">{assignedPeriods}</span>
        <span className="text-2xs text-content-muted">/ {capacity}</span>
        <span className={`w-9 text-right text-2xs font-medium ${ink}`}>{pct}%</span>
      </div>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-surface-inset">
        <div
          className={`h-full ${isIdle ? "" : bar}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
};
