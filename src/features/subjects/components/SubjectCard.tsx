import React from "react";
import { Trash2, Edit2, BookOpen, Users, Gem, FileText } from "lucide-react";
import { Subject } from "../types";
import { resolveSubjectIsCore } from "../../generator/scheduler/logic/subject-core";

interface SubjectCardProps {
  subject: Subject;
  classCount: number;
  teacherCount: number;
  onEdit: () => void;
  onDelete: () => void;
  onShowTeachers: () => void;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  subject: subj,
  classCount,
  teacherCount,
  onEdit,
  onDelete,
  onShowTeachers,
}) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col">
    <div className="h-3 w-full relative" style={{ backgroundColor: subj.color }}>
      {subj.isSingleResource && (
        <div
          className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 shadow-sm"
          title="Single Resource"
          aria-label="Single Resource"
        >
          <Gem size={10} className="text-purple-600" />
        </div>
      )}
      {subj.isExaminable !== false && (
        <div
          className={`absolute top-1 ${subj.isSingleResource ? "right-6" : "right-1"} bg-white/90 rounded-full p-0.5 shadow-sm`}
          title="Examinable"
          aria-label="Examinable"
        >
          <FileText size={10} className="text-accent-ink" />
        </div>
      )}
    </div>

    <div className="p-4 flex-1 flex flex-col items-center text-center">
      {/* Colour-as-identity: the subject colour is the ring (plus the strip
          above); the initials use a neutral token so they stay readable. */}
      <div
        className="w-12 h-12 rounded-full mb-3 flex items-center justify-center text-lg font-bold shadow-sm relative text-content"
        style={{
          backgroundColor: `${subj.color}15`,
          border: `2px solid ${subj.color}`,
        }}
      >
        {subj.name.substring(0, 2).toUpperCase()}
        {subj.isSingleResource && (
          <div className="absolute -bottom-1 -right-1 bg-purple-100 border border-purple-200 text-purple-800 dark:text-purple-200 text-2xs font-bold px-1 rounded-full">
            1x
          </div>
        )}
      </div>
      <h3
        className="font-bold text-slate-800 dark:text-slate-100 mb-1 truncate w-full px-2"
        title={subj.name}
      >
        {subj.name}
      </h3>
      <div className="flex flex-wrap justify-center gap-1 mb-2">
        {subj.isSingleResource && (
          <span className="text-2xs font-bold text-purple-600 bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">
            Single Resource
          </span>
        )}
        {/* Core status decides morning priority, so it belongs on the card. */}
        {resolveSubjectIsCore(subj) && (
          <span
            className="text-2xs font-bold text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full"
            title="Core subject — scheduled earlier in the day"
          >
            Core
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 w-full mt-auto">
        <div
          className={`text-2xs py-1 px-2 rounded flex items-center justify-center gap-1 ${
            classCount > 0
              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              : "bg-slate-50 dark:bg-slate-900 text-slate-300"
          }`}
        >
          <BookOpen size={10} />
          {classCount > 0 ? `${classCount} Classes` : "Unused"}
        </div>
        <div
          onClick={() => {
            if (teacherCount > 0) onShowTeachers();
          }}
          className={`text-2xs py-1 px-2 rounded flex items-center justify-center gap-1 ${
            teacherCount > 0
              ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 transition-colors"
              : "bg-slate-50 dark:bg-slate-900 text-slate-300"
          }`}
        >
          <Users size={10} />
          {teacherCount > 0 ? `${teacherCount} Teachers` : "No Specialists"}
        </div>
      </div>
    </div>

    <div className="flex border-t border-slate-100 dark:border-slate-700">
      <button
        onClick={onEdit}
        className="flex-1 py-3 text-slate-600 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold flex items-center justify-center transition-colors"
      >
        <Edit2 size={14} className="mr-1" /> Edit
      </button>
      <div className="w-px bg-slate-100 dark:bg-slate-800"></div>
      <button
        onClick={onDelete}
        className="flex-1 py-3 text-content-muted hover:text-danger-ink hover:bg-red-50 text-xs font-semibold flex items-center justify-center transition-colors"
      >
        <Trash2 size={14} className="mr-1" /> Del
      </button>
    </div>
  </div>
);
