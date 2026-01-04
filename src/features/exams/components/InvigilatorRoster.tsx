import React, { useMemo } from "react";
import { AppData, ExamSession, ClassGroup, Teacher } from "../../../types";
import { Users, Calendar } from "lucide-react";

interface Props {
  data: AppData;
  exams: ExamSession[];
}

export const InvigilatorRoster: React.FC<Props> = ({ data, exams }) => {
  const { classes, teachers } = data;

  // 1. Get Unique Sorted Dates
  const uniqueDates = useMemo(() => {
    return Array.from(new Set(exams.map((e) => e.date))).sort();
  }, [exams]);

  // 2. Get Sorted Classes
  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }, [classes]);

  // 3. Helper to format date
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  // 4. Resolve Names Helper
  const getInvigilatorsForCell = (classId: string, date: string) => {
    // Find all exams for this class on this date
    const cellExams = exams.filter(
      (e) => e.date === date && e.classIds.includes(classId)
    );

    if (cellExams.length === 0) return null;

    // We want a list of unique names from all exams this class writes today
    const allTeacherIds = cellExams.flatMap((e) => e.invigilatorIds || []);
    const uniqueIds = Array.from(new Set(allTeacherIds));

    return uniqueIds
      .map((id) => teachers.find((t) => t.id === id)?.name)
      .filter(Boolean);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-amber-500" />
            Master Invigilation Roster
          </h3>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-0.5">
            Class vs Date Allocation
          </p>
        </div>
        <div className="text-[10px] bg-amber-100 text-amber-700 px-2 py-1 rounded font-bold uppercase">
          {uniqueDates.length} Exam Days
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-50 shadow-sm">
            <tr>
              <th className="p-3 border-b border-r border-slate-200 bg-slate-100 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest min-w-[120px] sticky left-0 z-30">
                Class / Date
              </th>
              {uniqueDates.map((date) => (
                <th
                  key={date}
                  className="p-3 border-b border-r border-slate-200 text-center text-[10px] font-bold text-slate-600 uppercase tracking-wider min-w-[140px]"
                >
                  <div className="flex flex-col items-center">
                    <Calendar size={12} className="mb-1 text-slate-400" />
                    {formatDate(date)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedClasses.map((cls) => (
              <tr key={cls.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="p-3 border-b border-r border-slate-200 font-bold text-xs text-slate-700 bg-white sticky left-0 z-10 group-hover:bg-slate-50">
                  {cls.name}
                </td>
                {uniqueDates.map((date) => {
                  const names = getInvigilatorsForCell(cls.id, date);
                  return (
                    <td
                      key={date}
                      className={`p-2 border-b border-r border-slate-200 text-center align-middle h-20 ${
                        !names ? "bg-slate-50/30" : "bg-white"
                      }`}
                    >
                      {names ? (
                        <div className="flex flex-col items-center gap-1">
                          {names.map((name, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[10px] font-bold shadow-sm w-full"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[9px] text-slate-300 italic">No Exams</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
