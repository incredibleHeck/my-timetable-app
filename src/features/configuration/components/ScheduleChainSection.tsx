import React from "react";
import { School, Coffee, Utensils, Users, ArrowRight } from "lucide-react";
import { AppData, PeriodType } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";

const PERIOD_TYPES: PeriodType[] = ["CLASS", "BREAK", "LUNCH", "ASSEMBLY"];

const TYPE_ICONS: Record<PeriodType, React.ReactNode> = {
  CLASS: <School size={12} aria-hidden />,
  BREAK: <Coffee size={12} aria-hidden />,
  LUNCH: <Utensils size={12} aria-hidden />,
  ASSEMBLY: <Users size={12} aria-hidden />,
};

interface ScheduleChainSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  editingLabelIdx: number | null;
  setEditingLabelIdx: (idx: number | null) => void;
  tempLabel: string;
  setTempLabel: (label: string) => void;
  setPeriodType: (idx: number, type: PeriodType) => AppData;
  updateTimeSlot: (idx: number, field: "start" | "end", value: string) => AppData;
  saveCustomLabel: () => AppData | undefined;
}

export const ScheduleChainSection: React.FC<ScheduleChainSectionProps> = ({
  data,
  commit,
  editingLabelIdx,
  setEditingLabelIdx,
  tempLabel,
  setTempLabel,
  setPeriodType,
  updateTimeSlot,
  saveCustomLabel,
}) => {
  const { dayStructure, timeSlots } = data.settings;

  const handleSaveLabel = () => {
    const nextData = saveCustomLabel();
    if (nextData) commit("Updated period label", nextData);
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Interactive Schedule Chain
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        {dayStructure.map((period, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 bg-white border border-slate-200 p-3 rounded-lg hover:border-amber-400 transition-colors group min-w-[220px]"
          >
            <div
              className="flex flex-col gap-0.5 shrink-0"
              role="group"
              aria-label={`Period ${idx + 1} type`}
            >
              {PERIOD_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={period.type === type}
                  onClick={() => {
                    if (period.type === type) return;
                    const nextData = setPeriodType(idx, type);
                    commit(`Updated period ${idx + 1} to ${type}`, nextData);
                  }}
                  className={`
                    flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition-colors
                    ${
                      period.type === type
                        ? type === "CLASS"
                          ? "bg-white border-slate-400 text-slate-800"
                          : type === "BREAK"
                            ? "bg-amber-50 border-amber-400 text-amber-800"
                            : type === "LUNCH"
                              ? "bg-orange-50 border-orange-400 text-orange-800"
                              : "bg-violet-50 border-violet-400 text-violet-800"
                        : "bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300"
                    }
                  `}
                >
                  {TYPE_ICONS[type]}
                  <span>{type}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col justify-center min-w-0">
              <div className="flex items-center mb-1">
                {editingLabelIdx === idx ? (
                  <input
                    className="text-sm font-bold text-slate-700 bg-slate-100 border border-amber-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:border-amber-500"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    autoFocus
                    onBlur={handleSaveLabel}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveLabel()}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingLabelIdx(idx);
                      setTempLabel(period.label);
                    }}
                    className="text-sm font-bold text-slate-500 uppercase text-left cursor-pointer hover:text-amber-600 truncate"
                  >
                    {period.label}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <input
                  type="time"
                  aria-label={`Period ${idx + 1} start`}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 focus:border-amber-500 outline-none w-[5.5rem]"
                  value={timeSlots[idx]?.start || "00:00"}
                  onChange={(e) => {
                    const nextData = updateTimeSlot(idx, "start", e.target.value);
                    commit(`Updated period ${idx + 1} start time`, nextData);
                  }}
                />
                <ArrowRight size={12} className="text-slate-300 shrink-0" aria-hidden />
                <input
                  type="time"
                  aria-label={`Period ${idx + 1} end`}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-700 focus:border-amber-500 outline-none w-[5.5rem]"
                  value={timeSlots[idx]?.end || "00:00"}
                  onChange={(e) => {
                    const nextData = updateTimeSlot(idx, "end", e.target.value);
                    commit(`Updated period ${idx + 1} end time`, nextData);
                  }}
                />
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {Math.round(
                  (new Date(`1970-01-01T${timeSlots[idx]?.end}`).getTime() -
                    new Date(`1970-01-01T${timeSlots[idx]?.start}`).getTime()) /
                    60000,
                )}
                m
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
