import React, { useEffect, useState } from "react";
import { AppData, Settings } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";
import { ConfigPanel, SettingRow, SettingRows, controlClass } from "./ConfigPanel";

interface DurationFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}

/**
 * Minutes field that commits on blur. Committing per keystroke rebuilt the whole
 * day's bell times — and pushed an undo entry — for every digit typed.
 */
const DurationField: React.FC<DurationFieldProps> = ({ id, label, value, min, max, onCommit }) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(max, Math.max(min, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <label htmlFor={id} className="text-xs text-content-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={`${controlClass} w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
    </span>
  );
};

interface BellScheduleSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  handleDurationChange: (field: keyof Settings, value: string | number) => AppData;
  recalculateAllSlotTimes: () => AppData;
}

export const BellScheduleSection: React.FC<BellScheduleSectionProps> = ({
  data,
  commit,
  handleDurationChange,
  recalculateAllSlotTimes,
}) => {
  const {
    schoolStartTime,
    defaultClassDuration: classDur,
    defaultBreakDuration: breakDur,
    defaultLunchDuration: lunchDur,
  } = data.settings;

  const commitDuration = (field: keyof Settings, value: number, label: string) =>
    commit(`Updated ${label} to ${value} min`, handleDurationChange(field, value));

  return (
    <ConfigPanel
      title="Bell schedule defaults"
      description="Period start and end times are derived from these values. Changing any of them rebuilds the whole day; individual periods can still be edited by hand below."
    >
      <SettingRows>
        <SettingRow
          title="First bell"
          description="When the first period of every day begins."
          htmlFor="school-start-time"
          control={
            <input
              id="school-start-time"
              type="time"
              value={schoolStartTime || "08:00"}
              onChange={(e) =>
                commit(
                  `Updated Start time: ${e.target.value}`,
                  handleDurationChange("schoolStartTime", e.target.value),
                )
              }
              className={`${controlClass} w-28`}
            />
          }
        />

        <SettingRow
          title="Period lengths"
          description="Applied to each period according to its type. Assembly uses the class length."
          control={
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <DurationField
                id="duration-class"
                label="Class"
                value={classDur || 50}
                min={10}
                max={120}
                onCommit={(v) => commitDuration("defaultClassDuration", v, "Class Duration")}
              />
              <DurationField
                id="duration-break"
                label="Break"
                value={breakDur || 15}
                min={5}
                max={60}
                onCommit={(v) => commitDuration("defaultBreakDuration", v, "Break Duration")}
              />
              <DurationField
                id="duration-lunch"
                label="Lunch"
                value={lunchDur || 60}
                min={20}
                max={120}
                onCommit={(v) => commitDuration("defaultLunchDuration", v, "Lunch Duration")}
              />
              <span className="text-xs text-content-muted">min</span>
            </div>
          }
        />

        <SettingRow
          title="Rebuild bell times"
          description="Recalculates every period's start and end from the values above, discarding times edited by hand."
          control={
            <button
              type="button"
              onClick={() =>
                commit("Recalculated all slot times from defaults", recalculateAllSlotTimes())
              }
              className="h-9 rounded-md border border-edge bg-surface px-3 text-sm font-medium text-content-secondary
                         transition-colors hover:border-edge-strong hover:text-content
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                         focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Rebuild
            </button>
          }
        />
      </SettingRows>
    </ConfigPanel>
  );
};
