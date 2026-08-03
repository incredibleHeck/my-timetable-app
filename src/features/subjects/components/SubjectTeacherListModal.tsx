import React from "react";
import { X } from "lucide-react";
import { Button } from "../../../components/ui";
import { Subject } from "../types";
import { Teacher } from "../../teachers/types";

interface SubjectTeacherListModalProps {
  subject: Subject;
  teachers: Teacher[];
  onClose: () => void;
}

export const SubjectTeacherListModal: React.FC<SubjectTeacherListModalProps> = ({
  subject,
  teachers,
  onClose,
}) => (
  <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Teachers for {subject.name}
            </h3>
            <p className="text-xs text-content-muted mt-1">
              Staff members specializing in this subject
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-content-muted hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {teachers
            .filter((t) => t.specialtyIds.includes(subject.id))
            .map((teacher) => (
              <div
                key={teacher.id}
                className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center font-bold text-sm">
                  {teacher.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                    {teacher.name}
                  </div>
                  {teacher.email && (
                    <div className="text-xs text-content-muted">{teacher.email}</div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
      <div className="bg-slate-50 dark:bg-slate-900 px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  </div>
);
