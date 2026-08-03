import React, { useState, useMemo } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { AppData } from "../../types";
import { Subject } from "./types";
import { Button, Modal } from "../../components/ui";
import { useSubjectUsage } from "./hooks/useSubjectUsage";
import { useSubjectForm } from "./hooks/useSubjectForm";
import { useProfile } from "../../contexts/ProfileContext";
import { SubjectCard } from "./components/SubjectCard";
import { SubjectEditorModal } from "./components/SubjectEditorModal";
import { SubjectTeacherListModal } from "./components/SubjectTeacherListModal";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const SubjectsView: React.FC<ViewProps> = ({ data }) => {
  const { addActivity } = useProfile();
  const { getSubjectUsage } = useSubjectUsage(data);
  const form = useSubjectForm(data, addActivity);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [subjectForTeacherList, setSubjectForTeacherList] = useState<Subject | null>(null);

  const sortedSubjects = useMemo(() => {
    return [...data.subjects].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.subjects]);

  const initiateDelete = (subj: Subject) => {
    setSubjectToDelete(subj);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!subjectToDelete) return;
    const id = subjectToDelete.id;

    try {
      const updatedSubjects = data.subjects.filter((s) => s.id !== id);
      const updatedTeachers = data.teachers.map((t) => ({
        ...t,
        specialtyIds: t.specialtyIds.filter((sid) => sid !== id),
      }));
      const updatedClasses = data.classes.map((c) => ({
        ...c,
        curriculum: c.curriculum.filter((curr) => curr.subjectId !== id),
      }));

      const nextData = {
        ...data,
        subjects: updatedSubjects,
        teachers: updatedTeachers,
        classes: updatedClasses,
      };
      addActivity("ACADEMIC", `Deleted Subject: ${subjectToDelete.name}`, nextData);
    } catch (e) {
      console.error(e);
    }

    setDeleteModalOpen(false);
    setSubjectToDelete(null);
  };

  const usageToDelete = subjectToDelete
    ? getSubjectUsage(subjectToDelete.id)
    : { classCount: 0, teacherCount: 0 };

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-6 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Subject Library</h2>
          <p className="text-xs text-content-muted">
            Manage academic disciplines and track their usage.
          </p>
        </div>
        <Button onClick={() => form.openModal()} icon={<Plus size={16} />}>
          New Subject
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {sortedSubjects.map((subj) => {
          const stats = getSubjectUsage(subj.id);
          return (
            <SubjectCard
              key={subj.id}
              subject={subj}
              classCount={stats.classCount}
              teacherCount={stats.teacherCount}
              onEdit={() => form.openModal(subj)}
              onDelete={() => initiateDelete(subj)}
              onShowTeachers={() => setSubjectForTeacherList(subj)}
            />
          );
        })}

        <button
          onClick={() => form.openModal()}
          className="bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 dark:bg-amber-900/30 transition-all flex flex-col items-center justify-center p-6 group h-full min-h-[200px]"
        >
          <div className="w-14 h-14 rounded-full bg-slate-200 dark:bg-slate-700 group-hover:bg-amber-100 dark:bg-amber-900/40 text-content-muted group-hover:text-accent-ink flex items-center justify-center mb-3 transition-colors shadow-inner">
            <Plus size={28} />
          </div>
          <span className="font-bold text-content-muted group-hover:text-accent-ink">
            Add Subject
          </span>
        </button>
      </div>

      <SubjectEditorModal form={form} data={data} />

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete Subject?"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Keep It
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Yes, Delete Everything
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-danger-ink shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">
              Are you sure you want to delete "{subjectToDelete?.name}"?
            </p>

            {usageToDelete.classCount > 0 || usageToDelete.teacherCount > 0 ? (
              <div className="mt-3 bg-red-50 dark:bg-red-900/30 border border-red-100 p-3 rounded-lg text-sm text-red-800 dark:text-red-200">
                <p className="font-bold mb-1">Warning: Active Dependencies</p>
                <ul className="list-disc list-inside space-y-1">
                  {usageToDelete.teacherCount > 0 && (
                    <li>
                      Removed from <b>{usageToDelete.teacherCount}</b> teacher profiles.
                    </li>
                  )}
                  {usageToDelete.classCount > 0 && (
                    <li>
                      Removed from <b>{usageToDelete.classCount}</b> class curriculums.
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs opacity-80">This action cannot be undone.</p>
              </div>
            ) : (
              <p className="text-sm text-content-muted mt-2">
                This subject is not currently in use. It is safe to delete.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {subjectForTeacherList && (
        <SubjectTeacherListModal
          subject={subjectForTeacherList}
          teachers={data.teachers}
          onClose={() => setSubjectForTeacherList(null)}
        />
      )}
    </div>
  );
};
