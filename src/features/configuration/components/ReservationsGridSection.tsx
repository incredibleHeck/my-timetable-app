import React from "react";
import { Plus } from "lucide-react";
import { AppData } from "../../../types";
import { DAYS } from "../../../utils/constants";
import { getOccasionLabel } from "../../../utils/utils";
import { periodTypeMeta } from "../../../utils/periodTypes";

interface ReservationsGridSectionProps {
  data: AppData;
  handleSlotClick: (dIdx: number, pIdx: number) => void;
}

/**
 * Week grid of slots blocked for every class. Reserved cells carry the accent so
 * the week reads at a glance; empty cells are near-silent, because on a five by
 * twelve grid the empty state is the background, not content.
 */
export const ReservationsGridSection: React.FC<ReservationsGridSectionProps> = ({
  data,
  handleSlotClick,
}) => {
  const { periodsPerDay, dayStructure, fixedOccasions } = data.settings;
  const columns = `4.5rem repeat(${periodsPerDay}, minmax(5.25rem, 1fr))`;

  return (
    <div className="overflow-x-auto px-5 py-4">
      <div className="grid min-w-max gap-1" style={{ gridTemplateColumns: columns }}>
        <div className="sticky left-0 z-10 bg-surface" aria-hidden />
        {dayStructure.slice(0, periodsPerDay).map((period, i) => {
          const meta = periodTypeMeta(period.type);
          return (
            <div key={i} className="px-1 pb-1 text-center">
              <div className={`text-2xs font-medium tabular-nums ${meta.ink}`}>P{i + 1}</div>
              <div className="truncate text-2xs text-content-muted" title={period.label}>
                {period.label}
              </div>
            </div>
          );
        })}

        {DAYS.map((day, dIdx) => (
          <React.Fragment key={day}>
            <div className="sticky left-0 z-10 flex items-center bg-surface pr-3 text-xs font-medium text-content-secondary">
              {day.slice(0, 3)}
            </div>
            {Array.from({ length: periodsPerDay }).map((_, pIdx) => {
              const occasion = getOccasionLabel(fixedOccasions[dIdx]?.[pIdx]);
              return (
                <button
                  key={`${dIdx}-${pIdx}`}
                  type="button"
                  aria-label={
                    occasion
                      ? `Edit ${occasion} on ${day} period ${pIdx + 1}`
                      : `Reserve ${day} period ${pIdx + 1}`
                  }
                  onClick={() => handleSlotClick(dIdx, pIdx)}
                  className={`group flex h-11 items-center justify-center rounded border px-1.5 text-2xs
                              transition-colors focus-visible:outline-none focus-visible:ring-2
                              focus-visible:ring-accent focus-visible:ring-offset-1
                              focus-visible:ring-offset-surface ${
                                occasion
                                  ? "border-accent/50 bg-accent/15 font-medium text-accent-ink"
                                  : "border-edge-subtle bg-canvas hover:border-edge-strong"
                              }`}
                >
                  {occasion ? (
                    <span className="line-clamp-2 text-center leading-tight">{occasion}</span>
                  ) : (
                    <Plus
                      size={13}
                      aria-hidden
                      className="text-transparent transition-colors group-hover:text-content-muted"
                    />
                  )}
                </button>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
