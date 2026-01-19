import React from "react";
import { School, Coffee, Utensils, ArrowRight } from "lucide-react";
import { AppData } from "../../../types";

interface ScheduleChainSectionProps {
  data: AppData;
  editingLabelIdx: number | null;
  setEditingLabelIdx: (idx: number | null) => void;
  tempLabel: string;
  setTempLabel: (label: string) => void;
  handleStructureChange: (idx: number) => AppData;
  updateTimeSlot: (idx: number, field: "start" | "end", value: string) => AppData;
  saveCustomLabel: () => AppData | undefined;
}

export const ScheduleChainSection: React.FC<ScheduleChainSectionProps> = ({
  data,
  editingLabelIdx,
  setEditingLabelIdx,
  tempLabel,
  setTempLabel,
  handleStructureChange,
  updateTimeSlot,
  saveCustomLabel,
}) => {
  const { dayStructure, timeSlots } = data.settings;

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
            className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-lg hover:border-amber-400 transition-colors group min-w-[200px]"
          >
            {/* Type Toggle */}
            <div
              onClick={() => handleStructureChange(idx)}
              className={`
                w-20 h-12 flex flex-col items-center justify-center rounded cursor-pointer border-2 font-bold text-[10px] select-none shadow-sm transition-transform active:scale-95 shrink-0
                ${period.type === "CLASS" ? "bg-white border-slate-200 text-slate-700" : ""}
                ${period.type === "BREAK" ? "bg-amber-50 border-amber-300 text-amber-700" : ""}
                ${period.type === "LUNCH" ? "bg-orange-50 border-orange-300 text-orange-700" : ""}
              `}
            >
              {period.type === "CLASS" && <School size={14} />}
              {period.type === "BREAK" && <Coffee size={14} />}
              {period.type === "LUNCH" && <Utensils size={14} />}
              <span className="mt-0.5">{period.type}</span>
            </div>

            {/* Label & Time Editor */}
            <div className="flex-1 flex flex-col justify-center min-w-0">
              {/* Label Editor */}
              <div className="flex items-center mb-1">
                {editingLabelIdx === idx ? (
                  <input
                    className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-amber-300 rounded px-1 py-0.5 w-full focus:outline-none"
                    value={tempLabel}
                    onChange={(e) => setTempLabel(e.target.value)}
                    autoFocus
                    onBlur={saveCustomLabel}
                    onKeyDown={(e) => e.key === "Enter" && saveCustomLabel()}
                  />
                ) : (
                  <div
                    onClick={() => {
                      setEditingLabelIdx(idx);
                      setTempLabel(period.label);
                    }}
                    className="text-[10px] font-bold text-slate-500 uppercase cursor-pointer hover:text-amber-600 truncate"
                  >
                    {period.label}
                  </div>
                )}
              </div>

              {/* Time Inputs */}
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700 focus:border-amber-500 outline-none w-16"
                  value={timeSlots[idx]?.start || "00:00"}
                  onChange={(e) => updateTimeSlot(idx, "start", e.target.value)}
                />
                <ArrowRight size={10} className="text-slate-300 shrink-0" />
                <input
                  type="time"
                  className="bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700 focus:border-amber-500 outline-none w-16"
                  value={timeSlots[idx]?.end || "00:00"}
                  onChange={(e) => updateTimeSlot(idx, "end", e.target.value)}
                />
              </div>
              <div className="text-[8px] text-slate-400 mt-0.5">
                {Math.round(
                  (new Date(`1970-01-01T${timeSlots[idx]?.end}`).getTime() -
                    new Date(`1970-01-01T${timeSlots[idx]?.start}`).getTime()) /
                    60000
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
