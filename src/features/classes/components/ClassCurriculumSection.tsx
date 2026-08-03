import React from "react";
import { Minus, Plus, Zap } from "lucide-react";
import { AppData } from "../../../types";
import { CurriculumItem } from "../types";
import { Select } from "../../../components/ui";

interface ClassCurriculumSectionProps {
  data: AppData;
  cCurriculum: CurriculumItem[];
  setCCurriculum: (curr: CurriculumItem[] | ((prev: CurriculumItem[]) => CurriculumItem[])) => void;
}

export const ClassCurriculumSection: React.FC<ClassCurriculumSectionProps> = ({
  data,
  cCurriculum,
  setCCurriculum,
}) => {
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-2 shrink-0">
        <label className="text-xs font-bold text-content-muted uppercase">Curriculum</label>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2">
        {cCurriculum.map((item) => {
          const subject = data.subjects.find((s) => s.id === item.subjectId);
          if (!subject) return null;
          const eligibleTeachers = data.teachers.filter((t) => t.specialtyIds.includes(subject.id));

          const updateItem = (
            f: keyof CurriculumItem,
            v: string | number | boolean | null | undefined,
          ) => {
            setCCurriculum((prev) =>
              prev.map((p) =>
                p.subjectId === item.subjectId
                  ? {
                      ...p,
                      [f]: v,
                      periodsPerWeek:
                        f === "doubles"
                          ? (v as number) * 2 + p.singles
                          : f === "singles"
                            ? p.doubles * 2 + (v as number)
                            : p.periodsPerWeek,
                    }
                  : p,
              ),
            );
          };

          const isExempt = item.isWorkloadExempt;

          return (
            <div
              key={item.subjectId}
              className={`flex flex-col p-3 rounded border transition-colors ${
                item.periodsPerWeek > 0
                  ? "bg-white dark:bg-slate-800 border-slate-300 shadow-sm"
                  : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 opacity-70"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <div
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: subject.color }}
                  ></div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                    {subject.name}
                  </div>
                </div>
                <div className="text-xs font-bold text-content-muted">
                  Total: {item.periodsPerWeek}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => updateItem("doubles", Math.max(0, item.doubles - 1))}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-bold w-6 text-center border-x border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1">
                    {item.doubles}
                  </span>
                  <button
                    onClick={() => updateItem("doubles", item.doubles + 1)}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    <Plus size={12} />
                  </button>
                  <span className="text-2xs text-content-muted uppercase font-bold px-1.5 border-l border-slate-200 dark:border-slate-700">
                    Dbl
                  </span>
                </div>
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => updateItem("singles", Math.max(0, item.singles - 1))}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="text-xs font-bold w-6 text-center border-x border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1">
                    {item.singles}
                  </span>
                  <button
                    onClick={() => updateItem("singles", item.singles + 1)}
                    className="px-2 py-1 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold"
                  >
                    <Plus size={12} />
                  </button>
                  <span className="text-2xs text-content-muted uppercase font-bold px-1.5 border-l border-slate-200 dark:border-slate-700">
                    Sgl
                  </span>
                </div>
              </div>

              {item.periodsPerWeek > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  <Select
                    value={item.assignedTeacherId || ""}
                    onChange={(e) => updateItem("assignedTeacherId", e.target.value || null)}
                    options={[
                      { value: "", label: "Unassigned" },
                      ...eligibleTeachers.map((t) => ({
                        value: t.id,
                        label: t.name,
                      })),
                    ]}
                    className="text-xs py-1 flex-1"
                  />
                  <button
                    onClick={() => updateItem("isWorkloadExempt", !isExempt)}
                    title={isExempt ? "Include in Workload" : "Exempt from Workload"}
                    className={`p-1.5 rounded border transition-colors ${
                      isExempt
                        ? "bg-amber-100 border-amber-300 text-amber-700"
                        : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-content-muted hover:text-slate-600"
                    }`}
                  >
                    <Zap size={14} className={isExempt ? "fill-amber-500" : ""} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
