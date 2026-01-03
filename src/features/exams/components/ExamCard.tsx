import React from "react";
import {
  Calendar,
  Clock,
  Users,
  Trash2,
  Edit2,
  MapPin,
  Lock,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  ExamSession,
  Subject,
  Teacher,
  ClassGroup,
  Room,
} from "../../../types";
import { Card } from "../../../components/ui";

interface Props {
  exam: ExamSession;
  subject?: Subject;
  teachers: Teacher[]; // CHANGED: Pass all teachers to look up multiple IDs
  room?: Room;
  classes: ClassGroup[];
  conflicts: string[];
  onEdit: () => void;
  onDelete: () => void;
}

export const ExamCard: React.FC<Props> = ({
  exam,
  subject,
  teachers,
  room,
  classes,
  conflicts,
  onEdit,
  onDelete,
}) => {
  // Format class names for display (e.g. "10A, 10B")
  const classNames = classes
    .filter((c) => exam.classIds.includes(c.id))
    .map((c) => c.name)
    .join(", ");

  const isLocked = exam.locked;

  // Resolve invigilator names
  const invigilatorNames = (exam.invigilatorIds || [])
    .map(id => teachers.find(t => t.id === id)?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <Card
      className={`p-4 flex flex-col gap-3 hover:shadow-md transition-shadow relative overflow-hidden group border-l-4 ${
        conflicts.length > 0 ? "border-l-red-500" : "border-l-transparent"
      }`}
    >
      {/* Subject Color Strip (if no conflict) */}
      {conflicts.length === 0 && (
        <div
          className="absolute top-0 left-0 w-1 h-full"
          style={{ backgroundColor: subject?.color || "#cbd5e1" }}
        />
      )}

      {/* Header: Subject Name & Paper Label */}
      <div className="flex justify-between items-start pl-2">
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 text-sm leading-tight">
            {subject?.name || "Unknown Subject"}
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {exam.paperLabel || `Paper ${exam.paperNumber}`}
            </span>
            {isLocked && <Lock size={12} className="text-slate-400" />}
          </div>
        </div>

        {/* Action Buttons (Visible on Hover) */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-amber-600 rounded transition-colors"
            title="Edit Exam"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
            title="Delete Exam"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Meta Information Grid */}
      <div className="grid grid-cols-2 gap-y-2 text-xs pl-2">
        {/* Date */}
        <div className="flex items-center gap-2 text-slate-600">
          <Calendar size={14} className="text-slate-400" />
          <span className="font-medium">
            {new Date(exam.date).toLocaleDateString()}
          </span>
        </div>

        {/* Time & Duration */}
        <div className="flex items-center gap-2 text-slate-600">
          <Clock size={14} className="text-slate-400" />
          <span className="font-medium">
            {exam.startTime}{" "}
            <span className="text-slate-400">({exam.duration}m)</span>
          </span>
        </div>

        {/* Room Assignment */}
        <div className="flex items-center gap-2 col-span-2">
          <MapPin
            size={14}
            className={exam.roomId ? "text-slate-400" : "text-amber-400"}
          />
          {exam.roomId && room ? (
            <span className="text-slate-700 font-medium">{room.name}</span>
          ) : (
            <span className="text-amber-600 font-medium italic">
              No Room Assigned
            </span>
          )}
        </div>

        {/* Invigilator Assignment */}
        <div className="flex items-start gap-2 col-span-2">
          <Users
            size={14}
            className={invigilatorNames ? "text-slate-400 mt-0.5" : "text-amber-400 mt-0.5"}
          />
          <span
            className={`text-[11px] leading-tight ${
              !invigilatorNames ? "text-amber-600 italic" : "text-slate-600 font-medium"
            }`}
          >
            {invigilatorNames || "Unassigned Invigilators"}
          </span>
        </div>

        {/* Participating Classes */}
        {classNames && (
          <div className="col-span-2 mt-1 pt-2 border-t border-slate-100 flex items-start gap-2">
            <FileText size={14} className="text-slate-300 mt-0.5 shrink-0" />
            <span
              className="text-slate-400 leading-tight line-clamp-1"
              title={classNames}
            >
              {classNames}
            </span>
          </div>
        )}
      </div>

      {/* Conflict Display */}
      {conflicts.length > 0 && (
        <div className="mt-1 bg-red-50 border border-red-100 p-2 rounded flex flex-col gap-1 text-[10px] text-red-700 ml-2">
          {conflicts.map((err, i) => (
            <div key={i} className="flex items-start gap-1">
              <AlertTriangle size={10} className="mt-0.5 shrink-0" />
              <span className="leading-tight">{err}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
