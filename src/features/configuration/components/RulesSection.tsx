import React from "react";
import { ShieldAlert, Clock } from "lucide-react";
import { AppData } from "../../../types";

interface RulesSectionProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
  addActivity: (type: "SCHEDULING" | "ACADEMIC" | "SYSTEM", message: string, nextData?: AppData) => void;
  updateMaxConsecutive: (val: number) => AppData;
  updateMaxSubjectPeriods: (val: number) => AppData;
  updateMaxTeacherPeriods: (val: number) => AppData;
}

export const RulesSection: React.FC<RulesSectionProps> = ({
  data,
  onUpdate,
  addActivity,
  updateMaxConsecutive,
  updateMaxSubjectPeriods,
  updateMaxTeacherPeriods,
}) => {
  const {
    maxConsecutivePeriods: maxConsecutive,
    maxSubjectPeriodsPerDay: maxSubject,
    maxTeacherPeriodsPerDay: maxTeacher,
    timeSlots,
  } = data.settings;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Rules & Constraints
        </p>
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Fatigue Guard */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={18} className="text-amber-600" />
            <h4 className="font-bold text-slate-700 text-sm">Fatigue Guard</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Prevents burnout by ensuring teachers don't have more than{" "}
            <strong>{maxConsecutive || 4}</strong> classes in a row.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const val = Math.max(2, (maxConsecutive || 4) - 1);
                const nextData = updateMaxConsecutive(val);
                addActivity("SYSTEM", `Updated Fatigue Guard to ${val} periods`, nextData);
              }}
              className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
            >
              -
            </button>
            <span className="text-lg font-bold text-slate-800 w-8 text-center">
              {maxConsecutive || 4}
            </span>
            <button
              onClick={() => {
                const val = Math.min(8, (maxConsecutive || 4) + 1);
                const nextData = updateMaxConsecutive(val);
                addActivity("SYSTEM", `Updated Fatigue Guard to ${val} periods`, nextData);
              }}
              className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
            >
              +
            </button>
          </div>
        </div>

        {/* Subject Limit */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={18} className="text-amber-600" />
            <h4 className="font-bold text-slate-700 text-sm">Subject Daily Limit</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Limits how many times a single subject can be taught to a class in one day.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const val = Math.max(1, (maxSubject || 2) - 1);
                const nextData = updateMaxSubjectPeriods(val);
                addActivity("SYSTEM", `Updated Subject Daily Limit to ${val}`, nextData);
              }}
              className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
            >
              -
            </button>
            <span className="text-lg font-bold text-slate-800 w-8 text-center">{maxSubject || 2}</span>
            <button
              onClick={() => {
                const val = Math.min(4, (maxSubject || 2) + 1);
                const nextData = updateMaxSubjectPeriods(val);
                addActivity("SYSTEM", `Updated Subject Daily Limit to ${val}`, nextData);
              }}
              className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
            >
              +
            </button>
          </div>
        </div>

        {/* Teacher Limit */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={18} className="text-amber-600" />
            <h4 className="font-bold text-slate-700 text-sm">Teacher Daily Load</h4>
          </div>
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Limits the total number of periods a teacher can be assigned across all classes per day.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const val = Math.max(1, (maxTeacher || 6) - 1);
                const nextData = updateMaxTeacherPeriods(val);
                addActivity("SYSTEM", `Updated Teacher Daily Load to ${val}`, nextData);
              }}
              className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
            >
              -
            </button>
            <span className="text-lg font-bold text-slate-800 w-8 text-center">{maxTeacher || 6}</span>
            <button
              onClick={() => {
                const val = Math.min(15, (maxTeacher || 6) + 1);
                const nextData = updateMaxTeacherPeriods(val);
                addActivity("SYSTEM", `Updated Teacher Daily Load to ${val}`, nextData);
              }}
              className="w-8 h-8 rounded bg-white border border-slate-300 font-bold hover:bg-slate-100"
            >
              +
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-blue-600" />
            <h4 className="font-bold text-slate-700 text-sm">Summary</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Day Starts</span>
              <span className="font-bold text-slate-800">{timeSlots[0]?.start || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Day Ends</span>
              <span className="font-bold text-slate-800">
                {timeSlots[timeSlots.length - 1]?.end || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
