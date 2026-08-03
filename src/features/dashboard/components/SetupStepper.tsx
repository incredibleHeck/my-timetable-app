import React, { useState } from "react";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { AppData, ViewState } from "../../../types";

interface SetupStepperProps {
  data: AppData;
  onNavigate: (view: ViewState) => void;
}

interface Step {
  id: string;
  label: string;
  description: string;
  view: ViewState;
  isComplete: (d: AppData) => boolean;
}

const STEPS: Step[] = [
  {
    id: "config",
    label: "Global Configuration",
    description: "Set your school's periods, days and timing",
    view: "CONFIG",
    isComplete: (d) => d.settings.periodsPerDay > 0,
  },
  {
    id: "subjects",
    label: "Add Subjects",
    description: "Define your curriculum subjects and colors",
    view: "SUBJECTS",
    isComplete: (d) => d.subjects.length > 0,
  },
  {
    id: "teachers",
    label: "Add Teachers",
    description: "Register faculty and assign specialties",
    view: "TEACHERS",
    isComplete: (d) => d.teachers.length > 0,
  },
  {
    id: "classes",
    label: "Setup Classes",
    description: "Create class groups and assign curriculum",
    view: "CLASSES",
    isComplete: (d) => d.classes.length > 0 && d.classes.some((c) => c.curriculum.length > 0),
  },
  {
    id: "generate",
    label: "Generate Timetable",
    description: "Run the auto-scheduler to build your schedule",
    view: "GENERATOR",
    isComplete: (d) => !!d.lastGenerated,
  },
];

export const SetupStepper: React.FC<SetupStepperProps> = ({ data, onNavigate }) => {
  const [dismissed, setDismissed] = useState(false);

  const completedCount = STEPS.filter((s) => s.isComplete(data)).length;
  const allDone = completedCount === STEPS.length;

  if (dismissed || allDone) return null;

  const progressPct = (completedCount / STEPS.length) * 100;

  return (
    <div className="relative rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors"
        aria-label="Dismiss setup guide"
      >
        <X size={16} />
      </button>

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
            Getting Started
          </span>
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Set up your profile
        </h3>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-amber-700 shrink-0">
            {completedCount}/{STEPS.length} steps
          </span>
        </div>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
        {STEPS.map((step, idx) => {
          const done = step.isComplete(data);
          const isNext = !done && STEPS.slice(0, idx).every((s) => s.isComplete(data));
          return (
            <button
              key={step.id}
              onClick={() => onNavigate(step.view)}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all group ${
                done
                  ? "bg-emerald-50 border-emerald-200 opacity-80"
                  : isNext
                    ? "bg-white dark:bg-slate-800 border-amber-300 shadow-sm hover:shadow-md hover:border-amber-400"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-80"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                {done ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <Circle size={16} className={isNext ? "text-amber-400" : "text-slate-300"} />
                )}
                {isNext && (
                  <ChevronRight
                    size={14}
                    className="text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                )}
              </div>
              <span
                className={`text-xs font-bold leading-tight ${
                  done
                    ? "text-emerald-700"
                    : isNext
                      ? "text-slate-800 dark:text-slate-100"
                      : "text-slate-400"
                }`}
              >
                {step.label}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 leading-tight hidden sm:block">
                {step.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
