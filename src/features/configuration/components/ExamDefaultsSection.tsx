import React from "react";
import { Clock } from "lucide-react";
import { AppData } from "../../../types";
import { ConfigCommitFn } from "../hooks/useConfigCommit";

interface ExamDefaultsSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  updateExamGrid: (patch: Partial<NonNullable<AppData["settings"]["examGrid"]>>) => AppData;
}

export const ExamDefaultsSection: React.FC<ExamDefaultsSectionProps> = ({
  data,
  commit,
  updateExamGrid,
}) => (
  <div className="w-full">
    <div className="flex justify-between items-end mb-3">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        Exam Timetable Defaults
      </p>
    </div>
    <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-amber-600" aria-hidden />
        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Exam grid</h4>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
        Sessions per day (grid columns) and default drop times for each session. Also used when
        building exams in Exam Timetable.
      </p>
      <div className="flex items-center gap-3">
        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
          Sessions per day
        </span>
        {[1, 2].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => {
              const nextData = updateExamGrid({ sessionsPerDay: n });
              commit(`Exam sessions per day set to ${n}`, nextData);
            }}
            className={`px-3 py-1 rounded border text-xs font-bold ${
              (data.settings.examGrid?.sessionsPerDay ?? 2) === n
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(
          [
            ["sessionCutoff", "Session cutoff", "11:30"],
            ["session1DefaultTime", "Session 1 default", "09:00"],
            ["session2DefaultTime", "Session 2 default", "14:00"],
          ] as const
        ).map(([key, label, fallback]) => (
          <label key={key} className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-slate-500 dark:text-slate-400">{label}</span>
            <input
              type="time"
              className="border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-sm focus:border-amber-500 outline-none"
              value={data.settings.examGrid?.[key] || fallback}
              onChange={(e) => {
                const nextData = updateExamGrid({ [key]: e.target.value });
                commit(`Updated exam grid ${label}`, nextData);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  </div>
);
