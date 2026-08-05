import React from "react";
import { AppData } from "../../../types";
import { NumberStepper } from "../../../components/ui/NumberStepper";
import { ConfigCommitFn } from "../hooks/useConfigCommit";
import { ConfigPanel, SettingRow, SettingRows } from "./ConfigPanel";

interface RulesSectionProps {
  data: AppData;
  commit: ConfigCommitFn;
  updateMaxConsecutive: (val: number) => AppData;
  updateMaxSubjectPeriods: (val: number) => AppData;
  updateMaxTeacherPeriods: (val: number) => AppData;
  updateMaxTeachingPeriodsPerWeek: (val: number) => AppData;
  updateSolverTimeout: (val: number) => AppData;
}

/**
 * Limits are stated as what they cap, not as branded names: "Fatigue Guard" told
 * nobody which number it guarded. Each row says whose limit it is, so the icons
 * that used to distinguish them — the same shield in five colours — are gone.
 */
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
    <div className="space-y-4">
      <ConfigPanel
        title="Scheduling limits"
        description="Enforced by the auto-generator and checked by workload analysis. Individual teachers and classes can tighten these further in their own settings."
      >
        <SettingRows>
          <SettingRow
            title="Consecutive periods per teacher"
            description="How many classes in a row a teacher may be given before a gap is required."
            control={
              <NumberStepper
                label="Consecutive periods per teacher"
                value={maxConsecutive || 4}
                min={2}
                max={8}
                unit="periods"
                onChange={(val) =>
                  commit(`Updated consecutive period limit to ${val}`, updateMaxConsecutive(val))
                }
              />
            }
          />
          <SettingRow
            title="Same subject per class, per day"
            description="How often one subject may repeat for a class within a single day."
            control={
              <NumberStepper
                label="Same subject per class per day"
                value={maxSubject || 2}
                min={1}
                max={4}
                unit="periods"
                onChange={(val) =>
                  commit(`Updated subject daily limit to ${val}`, updateMaxSubjectPeriods(val))
                }
              />
            }
          />
          <SettingRow
            title="Teaching periods per teacher, per day"
            description="Total periods a teacher can be assigned across all classes in one day."
            control={
              <NumberStepper
                label="Teaching periods per teacher per day"
                value={maxTeacher || 6}
                min={1}
                max={15}
                unit="periods"
                onChange={(val) =>
                  commit(`Updated teacher daily load to ${val}`, updateMaxTeacherPeriods(val))
                }
              />
            }
          />
          <SettingRow
            title="Teaching periods per teacher, per week"
            description="A full weekly load. Workload utilisation percentages are measured against this figure."
            control={
              <NumberStepper
                label="Teaching periods per teacher per week"
                value={maxWeekly ?? 24}
                min={1}
                max={40}
                unit="periods"
                onChange={(val) =>
                  commit(
                    `Updated weekly teaching limit to ${val}`,
                    updateMaxTeachingPeriodsPerWeek(val),
                  )
                }
              />
            }
          />
        </SettingRows>
      </ConfigPanel>

      <ConfigPanel title="Auto-generator">
        <SettingRows>
          <SettingRow
            title="Time limit"
            description="How long the solver may search before returning the best timetable it has found. Longer runs place more lessons on tightly constrained data."
            control={
              <NumberStepper
                label="Solver time limit"
                value={solverTimeoutMinutes ?? 1}
                min={1}
                max={10}
                unit="min"
                onChange={(val) =>
                  commit(`Updated solver time limit to ${val} minutes`, updateSolverTimeout(val))
                }
              />
            }
          />
        </SettingRows>
      </ConfigPanel>
    </div>
  );
};
