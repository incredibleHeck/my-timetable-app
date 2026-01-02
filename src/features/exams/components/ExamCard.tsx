import React from "react";
import { Calendar, Clock, Users, Trash2, Edit2, AlertTriangle } from "lucide-react";
import { ExamSession, Subject, Teacher, ClassGroup } from "../../../types";
import { Card, Badge } from "../../../components/ui";

interface Props {
  exam: ExamSession;
  subject?: Subject;
  teacher?: Teacher;
  classes: ClassGroup[];
  conflicts: string[];
  onEdit: () => void;
  onDelete: () => void;
}

export const ExamCard: React.FC<Props> = ({
  exam,
  subject,
  teacher,
  classes,
  conflicts,
  onEdit,
  onDelete,
}) => {
  return (
    <Card className="p-5 flex flex-col gap-4 hover:shadow-md transition-shadow relative overflow-hidden group">
      <div
        className="absolute top-0 left-0 w-1.5 h-full"
        style={{ backgroundColor: subject?.color }}
      />

      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 leading-tight">{subject?.name}</h3>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-y-3 text-xs">
        <div className="flex items-center gap-2 text-slate-500">
          <Calendar size={14} className="text-slate-400" />
          <span className="font-medium">{new Date(exam.date).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Clock size={14} className="text-slate-400" />
          <span className="font-medium">
            {exam.startTime} ({exam.duration}m)
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-500 col-span-2">
          <Users size={14} className="text-slate-400" />
          <span className="font-medium truncate">
            Invigilator: {teacher?.name || "Unassigned"}
          </span>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="bg-red-50 border border-red-100 p-2 rounded flex flex-col gap-1">
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-red-600 font-bold">
              <AlertTriangle size={10} /> {c}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
