import React from "react";
import { Clock } from "lucide-react";
import { AppData } from "../../../types";

interface DaySummaryStripProps {
  data: AppData;
}

export const DaySummaryStrip: React.FC<DaySummaryStripProps> = ({ data }) => {
  const { timeSlots } = data.settings;

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
      <Clock size={14} className="text-blue-600 shrink-0" aria-hidden />
      <span>
        <span className="text-slate-500">Day starts</span>{" "}
        <strong className="text-slate-800">{timeSlots[0]?.start || "N/A"}</strong>
      </span>
      <span className="text-slate-300">|</span>
      <span>
        <span className="text-slate-500">Day ends</span>{" "}
        <strong className="text-slate-800">{timeSlots[timeSlots.length - 1]?.end || "N/A"}</strong>
      </span>
    </div>
  );
};
