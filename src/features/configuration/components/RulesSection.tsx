import React from "react";
import { ShieldAlert, BarChart3 } from "lucide-react";
import { AppData } from "../../../types";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import { ConfigCommitFn } from "../hooks/useConfigCommit";

interface RulesSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  updateMaxConsecutive: (val: number) => AppData;
  updateMaxSubjectPeriods: (val: number) => AppData;
  updateMaxTeacherPeriods: (val: number) => AppData;
  updateMaxTeachingPeriodsPerWeek: (val: number) => AppData;
  updateSolverTimeout: (val: number) => AppData;
}

export const RulesSection: React.FC<RulesSectionProps> = ({
  data,
  commit,
  updateMaxConsecutive,
  updateMaxSubjectPeriods,
  updateMaxTeacherPeriods,
  updateMaxTeachingPeriodsPerWeek,
  updateSolverTimeout,
}) => {
  const {
    maxConsecutivePeriods: maxConsecutive,
    maxSubjectPeriodsPerDay: maxSubject,
    maxTeacherPeriodsPerDay: maxTeacher,
    maxTeachingPeriodsPerWeek: maxWeekly,
    solverTimeoutMinutes,
  } = data.settings;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          Rules & Constraints
        </p>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Used by Auto-Generator and Workload Analysis when validating timetables.
      </p>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex items-start gap-2">
          <ShieldAlert size={18} className="text-amber-600 shrink-0 mt-1" aria-hidden />
          <NumberStepper
            label="Fatigue Guard"
            value={maxConsecutive || 4}
            min={2}
            max={8}
            helpText={`Prevents teachers from having more than ${maxConsecutive || 4} consecutive class periods.`}
            onChange={(val) =>
              commit(`Updated Fatigue Guard to ${val} periods`, updateMaxConsecutive(val))
            }
          />
        </div>

        <div className="flex items-start gap-2">
          <ShieldAlert size={18} className="text-blue-600 shrink-0 mt-1" aria-hidden />
          <NumberStepper
            label="Subject Daily Limit"
            value={maxSubject || 2}
            min={1}
            max={4}
            helpText="Maximum times one subject can be taught to a class in a single day."
            onChange={(val) =>
              commit(`Updated Subject Daily Limit to ${val}`, updateMaxSubjectPeriods(val))
            }
          />
        </div>

        <div className="flex items-start gap-2">
          <ShieldAlert size={18} className="text-violet-600 shrink-0 mt-1" aria-hidden />
          <NumberStepper
            label="Teacher Daily Load"
            value={maxTeacher || 6}
            min={1}
            max={15}
            helpText="Maximum periods a teacher can be assigned across all classes per day."
            onChange={(val) =>
              commit(`Updated Teacher Daily Load to ${val}`, updateMaxTeacherPeriods(val))
            }
          />
        </div>

        <div className="flex items-start gap-2">
          <BarChart3 size={18} className="text-indigo-600 shrink-0 mt-1" aria-hidden />
          <NumberStepper
            label="Max Teaching Periods / Week"
            value={maxWeekly ?? 24}
            min={1}
            max={40}
            helpText="School-wide weekly capacity for workload utilization percentages."
            onChange={(val) =>
              commit(
                `Updated Max Teaching Periods Per Week to ${val}`,
                updateMaxTeachingPeriodsPerWeek(val),
              )
            }
          />
        </div>

        <div className="flex items-start gap-2">
          <ShieldAlert size={18} className="text-emerald-600 shrink-0 mt-1" aria-hidden />
          <NumberStepper
            label="Solver Timeout (Minutes)"
            value={solverTimeoutMinutes ?? 1}
            min={1}
            max={10}
            helpText="Maximum time allowed for the auto-generator algorithm."
            onChange={(val) =>
              commit(`Updated Solver Timeout to ${val} minutes`, updateSolverTimeout(val))
            }
          />
        </div>
      </div>
    </div>
  );
};
