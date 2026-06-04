import React, { useState, useMemo } from "react";
import { AppData } from "../../../types";
import { Badge, Button, Select } from "../../../components/ui";
import { Check, Plus } from "lucide-react";
import { useHistory } from "../../../contexts/HistoryContext";

interface Props {
  data: AppData;
  onUpdate: (d: AppData) => void;
}

export const ClassAssignmentsPanel: React.FC<Props> = ({ data, onUpdate }) => {
  const { pushToHistory } = useHistory();
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
  }, [data.classes]);

  const sortedTeachers = useMemo(() => {
    return [...data.teachers].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.teachers]);

  const handleAssign = () => {
    setMessage(null);
    if (!selectedClassId || !selectedTeacherId) return;

    const cls = data.classes.find((c) => c.id === selectedClassId);
    const teacher = data.teachers.find((t) => t.id === selectedTeacherId);

    if (!cls || !teacher) return;

    // 1. Identify common subjects
    const teacherSubjects = teacher.specialtyIds;
    const classSubjects = cls.curriculum.map((c) => c.subjectId);

    // Intersection
    const matchingSubjectIds = teacherSubjects.filter((sid) => classSubjects.includes(sid));

    if (matchingSubjectIds.length === 0) {
      setMessage({
        text: `Error: ${teacher.name} does not teach any subjects present in ${cls.name}'s curriculum.`,
        type: "error",
      });
      return;
    }

    // 2. Perform Update
    let assignedCount = 0;
    const newCurriculum = cls.curriculum.map((c) => {
      // Only assign if it's a matching subject AND has periods (is active)
      if (matchingSubjectIds.includes(c.subjectId) && c.periodsPerWeek > 0) {
        assignedCount++;
        return { ...c, assignedTeacherId: teacher.id };
      }
      return c;
    });

    if (assignedCount === 0) {
      setMessage({
        text: `Warning: Subject match found, but 0 periods are allocated in curriculum.`,
        type: "error",
      });
      return;
    }

    const newClass = { ...cls, curriculum: newCurriculum };
    const newClasses = data.classes.map((c) => (c.id === cls.id ? newClass : c));

    pushToHistory(data);
    onUpdate({ ...data, classes: newClasses });

    // 3. Feedback
    const subjNames = matchingSubjectIds
      .map((sid) => data.subjects.find((s) => s.id === sid)?.name)
      .join(", ");

    setMessage({
      text: `Successfully assigned ${teacher.name} to ${cls.name} for: ${subjNames}`,
      type: "success",
    });

    // Reset selection
    setSelectedTeacherId("");
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4">
      {/* 1. ASSIGNMENT ACTION AREA */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Plus size={20} className="text-amber-500" />
          Quick Assign Teacher
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Select a class and a teacher. The system will automatically link the teacher to the class
          for any subjects they are qualified to teach (based on their Faculty/Specialty).
        </p>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              1. Select Class
            </label>
            <Select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              options={[
                { value: "", label: "Choose a Class..." },
                ...sortedClasses.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              2. Select Teacher
            </label>
            <Select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              options={[
                { value: "", label: "Choose a Teacher..." },
                ...sortedTeachers.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
          <div className="w-full md:w-auto">
            <Button
              onClick={handleAssign}
              disabled={!selectedClassId || !selectedTeacherId}
              className="w-full md:w-auto"
            >
              Assign to Class
            </Button>
          </div>
        </div>

        {message && (
          <div
            className={`mt-4 p-3 rounded text-sm font-medium flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message.type === "success" ? <Check size={16} /> : null}
            {message.text}
          </div>
        )}
      </div>

      {/* 2. OVERVIEW GRID (Migrated from TeachersView) */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">Current Assignments Overview</h3>
          <Badge className="bg-slate-100 text-slate-600">{data.classes.length} Classes</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedClasses.map((cls) => {
            const assignments = cls.curriculum
              .filter((c) => c.assignedTeacherId && c.periodsPerWeek > 0)
              .map((c) => ({
                teacher: data.teachers.find((t) => t.id === c.assignedTeacherId),
                subject: data.subjects.find((s) => s.id === c.subjectId),
                periods: c.periodsPerWeek,
              }))
              .filter((x) => x.teacher && x.subject)
              .sort((a, b) => (a.teacher?.name || "").localeCompare(b.teacher?.name || ""));

            return (
              <div
                key={cls.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row"
              >
                <div className="p-4 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 flex justify-between items-center sm:flex-col sm:justify-center sm:w-28 shrink-0">
                  <div className="sm:text-center">
                    <h3 className="font-bold text-slate-800 text-sm">{cls.name}</h3>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                      {assignments.length} Staff
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-400 text-[10px] mt-2 hidden sm:flex">
                    {cls.name.substring(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="p-3 flex flex-wrap gap-2 items-center flex-1">
                  {assignments.length > 0 ? (
                    assignments.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-100 hover:border-amber-200 transition-all shadow-sm group"
                      >
                        <div
                          className="w-1 h-5 rounded-full"
                          style={{ backgroundColor: item.subject?.color }}
                        ></div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-700 whitespace-nowrap">
                            {item.teacher?.name}
                          </p>
                          <p className="text-[9px] text-slate-500 whitespace-nowrap">
                            {item.subject?.name}
                          </p>
                        </div>
                        <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-1 rounded ml-1">
                          {item.periods}p
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="w-full py-2 text-center text-[10px] text-slate-400 italic">
                      No teachers assigned.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
