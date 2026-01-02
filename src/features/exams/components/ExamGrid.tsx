import React, { useMemo } from "react";
import { AppData, ExamSession } from "../../../types";
import { Badge } from "../../../components/ui";
import { AlertTriangle, Clock } from "lucide-react";

interface Props {
  data: AppData;
  exams: ExamSession[]; // Use the filtered list from parent
  onEdit: (exam: ExamSession) => void;
  checkConflicts: (exam: ExamSession) => string[];
}

export const ExamGrid: React.FC<Props> = ({ data, exams, onEdit, checkConflicts }) => {
  // Group exams by date and sort by time
  const groupedExams = useMemo(() => {
    const map: Record<string, ExamSession[]> = {};
    exams.forEach((e) => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    
    return Object.keys(map)
      .sort()
      .map((date) => ({
        date,
        sessions: map[date].sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [exams]);

  // Determine the max number of exams on any day to set column count
  const maxExamsInADay = useMemo(() => {
    let max = 0;
    groupedExams.forEach(g => {
      if (g.sessions.length > max) max = g.sessions.length;
    });
    return Math.max(max, 1);
  }, [groupedExams]);

  const getEndTime = (startTime: string, duration: number) => {
    const [h, m] = startTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m + duration);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  if (exams.length === 0) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 print:border-none print:shadow-none">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 print:bg-white">
              <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r w-32 print:text-slate-900">
                Exam Date
              </th>
              {Array.from({ length: maxExamsInADay }).map((_, i) => (
                <th
                  key={i}
                  className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[220px] print:text-slate-900"
                >
                  {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`} Exam
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedExams.map(({ date, sessions }) => (
              <tr key={date} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4 border-r whitespace-nowrap bg-slate-50/30 group-hover:bg-slate-50 transition-colors">
                  <div className="font-bold text-slate-700 text-sm">
                    {new Date(date).toLocaleDateString(undefined, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </td>
                {Array.from({ length: maxExamsInADay }).map((_, i) => {
                  const exam = sessions[i];
                  if (!exam) return <td key={i} className="p-4 bg-slate-50/5" />;

                  const subject = data.subjects.find((s) => s.id === exam.subjectId);
                  const endTime = getEndTime(exam.startTime, exam.duration);
                  const conflicts = checkConflicts(exam);
                  const hasConflict = conflicts.length > 0;

                  return (
                    <td key={i} className="p-2 align-top">
                      <div
                        onClick={() => onEdit(exam)}
                        className={`p-3 rounded-lg border-l-4 shadow-sm bg-white border cursor-pointer hover:shadow-md hover:border-amber-300 transition-all group/cell relative ${
                          hasConflict ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
                        }`}
                        style={{ borderLeftColor: subject?.color || "#cbd5e1" }}
                      >
                        {hasConflict && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg animate-bounce">
                            <AlertTriangle size={10} />
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-xs text-slate-800 truncate pr-2">
                            {subject?.name}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                            {exam.startTime} - {endTime}
                          </span>
                        </div>
                        
                        <div className="mt-2 flex items-center justify-between">
                           <div className="text-[8px] text-slate-400 flex items-center gap-1 italic">
                             <Clock size={8} /> {exam.duration}m
                           </div>
                           <span className="text-[8px] font-bold text-slate-300 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                             Click to Edit
                           </span>
                        </div>
                      </div>
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