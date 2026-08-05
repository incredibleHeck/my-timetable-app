import React, { useMemo } from "react";
import { AppData, PeriodType } from "../../../types";
import { timeToMinutes } from "../../../utils/timeUtils";
import { PERIOD_TYPES, periodTypeMeta } from "../../../utils/periodTypes";

interface DayTimelineProps {
  data: AppData;
}

/**
 * Proportional strip of the school day. Its job is to show the *shape* of the
 * day — where the breaks fall, whether one period is oddly long — so it carries
 * no controls and no per-block chrome; the period list below is where you edit.
 */
export const DayTimeline: React.FC<DayTimelineProps> = ({ data }) => {
  const { dayStructure, timeSlots } = data.settings;

  const blocks = useMemo(() => {
    if (!dayStructure?.length || !timeSlots?.length) return [];

    const measured = dayStructure.map((period, index) => {
      const start = timeSlots[index]?.start || "08:00";
      const end = timeSlots[index]?.end || "09:00";
      const startMin = timeToMinutes(start);
      const endMin = timeToMinutes(end);
      return { ...period, index, start, end, duration: Math.max(0, endMin - startMin) };
    });

    const total = measured.reduce((sum, b) => sum + b.duration, 0) || 1;
    return measured.map((b) => ({ ...b, widthPercent: (b.duration / total) * 100 }));
  }, [dayStructure, timeSlots]);

  if (blocks.length === 0) return null;

  const dayStart = blocks[0].start;
  const dayEnd = blocks[blocks.length - 1].end;
  const teachingMinutes = blocks
    .filter((b) => b.type === "CLASS")
    .reduce((sum, b) => sum + b.duration, 0);

  /** Types actually present — a legend for types nobody uses is decoration. */
  const usedTypes = PERIOD_TYPES.filter((type) => blocks.some((b) => b.type === type));

  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-xs">
        <p className="text-content-muted">
          <span className="font-medium tabular-nums text-content-secondary">{dayStart}</span> to{" "}
          <span className="font-medium tabular-nums text-content-secondary">{dayEnd}</span>
          <span className="mx-2 text-edge-strong">·</span>
          <span className="tabular-nums">{Math.round(teachingMinutes / 6) / 10}h</span> teaching
          time across {blocks.filter((b) => b.type === "CLASS").length} periods
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {usedTypes.map((type) => (
            <li key={type} className="flex items-center gap-1.5 text-content-muted">
              <span
                className={`h-2 w-2 rounded-[2px] ${periodTypeMeta(type).swatch}`}
                aria-hidden
              />
              {periodTypeMeta(type).label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex h-9 w-full gap-px overflow-hidden rounded-md border border-edge">
        {blocks.map((block) => {
          const meta = periodTypeMeta(block.type as PeriodType);
          return (
            <div
              key={block.index}
              style={{ width: `${block.widthPercent}%` }}
              title={`${block.label} · ${block.start}–${block.end} · ${block.duration} min`}
              className={`flex min-w-0 items-center justify-center border-0 px-1 ${meta.block} ${meta.ink}`}
            >
              <span className="truncate text-2xs font-medium">{block.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
