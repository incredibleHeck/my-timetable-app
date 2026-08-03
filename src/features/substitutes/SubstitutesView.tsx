import React, { useMemo, useState } from "react";
import { AppData } from "../../types";
import { Card } from "../../components/ui";
import { UserX, CalendarDays, Check, AlertTriangle, ArrowRight, Info } from "lucide-react";
import { buildCoverPlan } from "./logic/substituteFinder";
import { getFormattedTimeRange } from "../../utils/timeUtils";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Map a raw period index to a teaching-period label like "P3" (breaks skipped). */
const buildPeriodLabels = (data: AppData): Map<number, string> => {
  const labels = new Map<number, string>();
  let classCount = 0;
  data.settings.dayStructure.forEach((p, idx) => {
    if (p.type === "CLASS") {
      classCount++;
      labels.set(idx, `P${classCount}`);
    } else {
      labels.set(idx, p.label || p.type);
    }
  });
  return labels;
};

export const SubstitutesView: React.FC<ViewProps> = ({ data }) => {
  const teachers = useMemo(
    () => [...data.teachers].sort((a, b) => a.name.localeCompare(b.name)),
    [data.teachers],
  );
  const dayCount = Math.min(data.settings.daysPerWeek ?? 5, DAY_NAMES.length);

  const [absentTeacherId, setAbsentTeacherId] = useState("");
  const [day, setDay] = useState(0);
  const [assignments, setAssignments] = useState<Record<number, string>>({});

  const periodLabels = useMemo(() => buildPeriodLabels(data), [data]);

  const plan = useMemo(() => {
    if (!absentTeacherId) return [];
    return buildCoverPlan(data, absentTeacherId, day, assignments);
  }, [data, absentTeacherId, day, assignments]);

  const assignedCount = plan.filter((entry) => assignments[entry.lesson.period]).length;
  const unassignedCount = plan.length - assignedCount;

  const resetFor = (nextTeacher: string, nextDay: number) => {
    setAbsentTeacherId(nextTeacher);
    setDay(nextDay);
    setAssignments({});
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto p-8">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <UserX size={20} className="text-amber-500" />
          <h2 className="text-xl font-bold text-slate-800">Cover Planner</h2>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Mark a teacher absent for a day to see their lessons and assign qualified, available
          substitutes. Suggestions are ranked by subject match and current daily load.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Absent teacher
          </span>
          <select
            value={absentTeacherId}
            onChange={(e) => resetFor(e.target.value, day)}
            className="min-w-[200px] px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-amber-400 text-slate-700 bg-white"
          >
            <option value="">Select a teacher…</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Day</span>
          <select
            value={day}
            onChange={(e) => resetFor(absentTeacherId, Number(e.target.value))}
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-amber-400 text-slate-700 bg-white"
          >
            {Array.from({ length: dayCount }, (_, i) => (
              <option key={i} value={i}>
                {DAY_NAMES[i]}
              </option>
            ))}
          </select>
        </label>

        {absentTeacherId && plan.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-xs">
            <CalendarDays size={14} className="text-slate-400" />
            <span className="text-slate-500">
              <strong className="text-slate-700">{plan.length}</strong> lesson
              {plan.length !== 1 ? "s" : ""}
            </span>
            <span className="text-emerald-600 font-semibold">{assignedCount} covered</span>
            {unassignedCount > 0 && (
              <span className="text-amber-600 font-semibold">{unassignedCount} open</span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      {!absentTeacherId ? (
        <Card className="p-12 text-center border-slate-100">
          <div className="inline-flex p-3 rounded-xl bg-slate-100 text-slate-400 mb-3">
            <Info size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Select a teacher to begin</h3>
          <p className="text-sm text-slate-500 mt-1">
            Choose who is absent and on which day to build a cover plan.
          </p>
        </Card>
      ) : plan.length === 0 ? (
        <Card className="p-12 text-center border-slate-100">
          <div className="inline-flex p-3 rounded-xl bg-emerald-50 text-emerald-500 mb-3">
            <Check size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-700">Nothing to cover</h3>
          <p className="text-sm text-slate-500 mt-1">
            This teacher has no scheduled lessons on {DAY_NAMES[day]}.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {plan.map(({ lesson, candidates }) => {
            const chosenId = assignments[lesson.period];
            const timeLabel = getFormattedTimeRange(data.settings.timeSlots?.[lesson.period]);
            const qualifiedCount = candidates.filter((c) => c.qualified && !c.atDailyCap).length;

            return (
              <Card key={lesson.period} className="p-4 border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Lesson info */}
                  <div className="flex items-center gap-3 md:w-72 shrink-0">
                    <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-slate-100 text-slate-600 shrink-0">
                      <span className="text-sm font-black">{periodLabels.get(lesson.period)}</span>
                      {timeLabel && <span className="text-[8px] text-slate-400">{timeLabel}</span>}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {lesson.subjectName}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {lesson.className}
                        {lesson.roomName ? ` · ${lesson.roomName}` : ""}
                      </p>
                    </div>
                  </div>

                  <ArrowRight size={16} className="hidden md:block text-slate-300 shrink-0" />

                  {/* Cover selector */}
                  <div className="flex-1 min-w-0">
                    {candidates.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-red-600 font-semibold">
                        <AlertTriangle size={14} /> No available teacher for this period
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <select
                          value={chosenId ?? ""}
                          onChange={(e) =>
                            setAssignments((prev) => {
                              const next = { ...prev };
                              if (e.target.value) next[lesson.period] = e.target.value;
                              else delete next[lesson.period];
                              return next;
                            })
                          }
                          className={`flex-1 min-w-0 px-3 py-2 text-sm border rounded-lg outline-none focus:border-amber-400 bg-white ${
                            chosenId
                              ? "border-emerald-300 text-slate-800"
                              : "border-slate-200 text-slate-500"
                          }`}
                        >
                          <option value="">
                            {qualifiedCount > 0
                              ? `Choose cover — ${qualifiedCount} qualified & free`
                              : "Choose cover — no qualified match"}
                          </option>
                          {candidates.map((c) => (
                            <option key={c.teacherId} value={c.teacherId}>
                              {c.teacherName}
                              {c.qualified ? " ✓ subject" : " · other subject"}
                              {` · ${c.dayLoad} today`}
                              {c.atDailyCap ? " · at cap" : ""}
                            </option>
                          ))}
                        </select>
                        {chosenId ? (
                          <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 whitespace-nowrap">
                            <Check size={14} /> Covered
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">
                            Open
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
