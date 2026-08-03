import React from "react";
import { Clock } from "lucide-react";
import { AppData } from "../../../types";

interface DaySummaryStripProps {
  data: AppData;
}

export const DaySummaryStrip: React.FC<DaySummaryStripProps> = ({ data }) => {
  const { timeSlots } = data.settings;

  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3">
      <Clock size={14} className="text-blue-600 shrink-0" aria-hidden />
      <span>
        <span className="text-content-muted">Day starts</span>{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {timeSlots[0]?.start || "N/A"}
        </strong>
      </span>
      <span className="text-slate-300">|</span>
      <span>
        <span className="text-content-muted">Day ends</span>{" "}
        <strong className="text-slate-800 dark:text-slate-100">
          {timeSlots[timeSlots.length - 1]?.end || "N/A"}
        </strong>
      </span>
    </div>
  );
};
