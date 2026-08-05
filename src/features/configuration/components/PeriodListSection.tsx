import React, { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AppData, PeriodType } from "../../../types";
import { timeToMinutes } from "../../../utils/timeUtils";
import { ConfigCommitFn } from "../hooks/useConfigCommit";
import { PERIOD_TYPES, periodTypeMeta } from "../../../utils/periodTypes";
import { controlClass } from "./ConfigPanel";

interface PeriodRowProps {
  index: number;
  label: string;
  type: PeriodType;
  start: string;
  end: string;
  onLabelCommit: (label: string) => void;
  onTypeChange: (type: PeriodType) => void;
  onTimeChange: (field: "start" | "end", value: string) => void;
}

const PeriodRow: React.FC<PeriodRowProps> = ({
  index,
  label,
  type,
  start,
  end,
  onLabelCommit,
  onTypeChange,
  onTimeChange,
}) => {
  const [draftLabel, setDraftLabel] = useState(label);
  useEffect(() => setDraftLabel(label), [label]);

  const meta = periodTypeMeta(type);
  const Icon = meta.icon;
  const duration = timeToMinutes(end) - timeToMinutes(start);

  const commitLabel = () => {
    const trimmed = draftLabel.trim();
    if (!trimmed) {
      setDraftLabel(label);
      return;
    }
    if (trimmed !== label) onLabelCommit(trimmed);
  };

  return (
    <div className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_9.5rem_minmax(11rem,auto)_4rem] items-center gap-3 px-5 py-2">
      <span
        className={`grid h-7 w-7 place-items-center rounded border text-2xs font-medium tabular-nums ${meta.block} ${meta.ink}`}
        aria-hidden
      >
        {index + 1}
      </span>

      <input
        aria-label={`Period ${index + 1} name`}
        value={draftLabel}
        onChange={(e) => setDraftLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setDraftLabel(label);
        }}
        className="h-8 min-w-0 rounded border border-transparent bg-transparent px-2 text-sm text-content
                   transition-colors hover:border-edge focus:border-accent focus:bg-surface
                   focus:outline-none focus:ring-2 focus:ring-accent/30"
      />

      <div className="relative">
        <Icon
          size={13}
          className={`pointer-events-none absolute left-2.5 top-2.5 ${meta.ink}`}
          aria-hidden
        />
        <select
          aria-label={`Period ${index + 1} type`}
          value={type}
          onChange={(e) => onTypeChange(e.target.value as PeriodType)}
          className={`${controlClass} h-8 w-full cursor-pointer appearance-none pl-7 pr-7 font-medium ${meta.ink}`}
        >
          {PERIOD_TYPES.map((option) => (
            <option key={option} value={option} className="text-content">
              {periodTypeMeta(option).label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={13}
          className="pointer-events-none absolute right-2.5 top-2.5 text-content-muted"
          aria-hidden
        />
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="time"
          aria-label={`Period ${index + 1} start`}
          value={start}
          onChange={(e) => onTimeChange("start", e.target.value)}
          className={`${controlClass} h-8 w-[5.75rem] px-2`}
        />
        <span className="text-content-muted" aria-hidden>
          –
        </span>
        <input
          type="time"
          aria-label={`Period ${index + 1} end`}
          value={end}
          onChange={(e) => onTimeChange("end", e.target.value)}
          className={`${controlClass} h-8 w-[5.75rem] px-2`}
        />
      </div>

      <span
        className={`text-right text-xs tabular-nums ${
          duration > 0 ? "text-content-muted" : "font-medium text-danger-ink"
        }`}
      >
        {duration > 0 ? `${duration} min` : "invalid"}
      </span>
    </div>
  );
};

interface PeriodListSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  setPeriodType: (idx: number, type: PeriodType) => AppData;
  setPeriodLabel: (idx: number, label: string) => AppData;
  updateTimeSlot: (idx: number, field: "start" | "end", value: string) => AppData;
}

/**
 * One row per period, in day order. The previous card grid stacked four type
 * buttons inside every card, so twelve periods rendered forty-eight toggles and
 * lost the one thing that matters here — the sequence.
 */
export const PeriodListSection: React.FC<PeriodListSectionProps> = ({
  data,
  commit,
  setPeriodType,
  setPeriodLabel,
  updateTimeSlot,
}) => {
  const { dayStructure, timeSlots } = data.settings;

  return (
    <div>
      <div
        className="grid grid-cols-[2.5rem_minmax(7rem,1fr)_9.5rem_minmax(11rem,auto)_4rem] gap-3
                   border-b border-edge-subtle px-5 pb-2 pt-4 text-2xs text-content-muted"
      >
        <span aria-hidden>#</span>
        <span>Name</span>
        <span>Type</span>
        <span>Start and end</span>
        <span className="text-right">Length</span>
      </div>

      <div className="divide-y divide-edge-subtle pb-2">
        {dayStructure.map((period, idx) => (
          <PeriodRow
            key={idx}
            index={idx}
            label={period.label}
            type={period.type}
            start={timeSlots[idx]?.start || "00:00"}
            end={timeSlots[idx]?.end || "00:00"}
            onLabelCommit={(label) =>
              commit(`Renamed period ${idx + 1} to ${label}`, setPeriodLabel(idx, label))
            }
            onTypeChange={(type) =>
              commit(
                `Changed period ${idx + 1} to ${periodTypeMeta(type).label}`,
                setPeriodType(idx, type),
              )
            }
            onTimeChange={(field, value) =>
              commit(`Updated period ${idx + 1} ${field} time`, updateTimeSlot(idx, field, value))
            }
          />
        ))}
      </div>
    </div>
  );
};
