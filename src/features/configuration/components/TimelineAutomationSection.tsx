import React from "react";
import { Calculator, RotateCcw } from "lucide-react";
import { AppData, Settings } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";

interface TimelineAutomationSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  handleDurationChange: (field: keyof Settings, value: string | number) => AppData;
  recalculateAllSlotTimes: () => AppData;
}

export const TimelineAutomationSection: React.FC<TimelineAutomationSectionProps> = ({
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

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={18} className="text-amber-600" aria-hidden />
        <h4 className="font-bold text-slate-700 text-sm">Smart Timeline Automation</h4>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div>
          <label
            htmlFor="school-start-time"
            className="block text-[10px] font-bold text-slate-500 uppercase mb-1"
          >
            Start of Day
          </label>
          <input
            id="school-start-time"
            type="time"
            value={schoolStartTime || "08:00"}
            onChange={(e) => {
              const val = e.target.value;
              commit(`Updated Start time: ${val}`, handleDurationChange("schoolStartTime", val));
            }}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Class (Mins)
          </label>
          <input
            type="number"
            min="10"
            max="120"
            value={classDur || 50}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!Number.isNaN(val))
                commit(
                  `Updated Class Duration: ${val}m`,
                  handleDurationChange("defaultClassDuration", val),
                );
            }}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Break (Mins)
          </label>
          <input
            type="number"
            min="5"
            max="60"
            value={breakDur || 15}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!Number.isNaN(val))
                commit(
                  `Updated Break Duration: ${val}m`,
                  handleDurationChange("defaultBreakDuration", val),
                );
            }}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Lunch (Mins)
          </label>
          <input
            type="number"
            min="20"
            max="120"
            value={lunchDur || 60}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!Number.isNaN(val))
                commit(
                  `Updated Lunch Duration: ${val}m`,
                  handleDurationChange("defaultLunchDuration", val),
                );
            }}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:border-amber-500 outline-none"
          />
        </div>
        <div className="flex flex-col justify-end">
          <button
            type="button"
            onClick={() =>
              commit("Recalculated all slot times from defaults", recalculateAllSlotTimes())
            }
            className="flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold py-2.5 rounded-lg transition-colors"
            title="Recalculate every period start/end from start time and class, break, and lunch durations"
          >
            <RotateCcw size={14} aria-hidden /> Recalculate all slot times
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-3 italic">
        <span className="font-bold text-amber-600">Tip:</span> Changing these numbers automatically
        recalculates all slot times below. You can still manually edit specific slots if needed.
      </p>
    </div>
  );
};
