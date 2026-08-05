import React, { useState, useMemo } from "react";
import { AlertTriangle, Plus } from "lucide-react";
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

  const sortedSubjects = useMemo(
    () => [...data.subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [data.subjects],
  );

  const roomNameById = useMemo(
    () => new Map((data.rooms || []).map((r) => [r.id, r.name])),
    [data.rooms],
  );

  /** Subjects nobody teaches and nobody studies are the ones worth acting on. */
  const unusedCount = useMemo(() => {
    const claimed = new Set([
      ...data.teachers.flatMap((t) => t.specialtyIds),
      ...data.classes.flatMap((c) => c.curriculum.map((curr) => curr.subjectId)),
    ]);
    return data.subjects.filter((s) => !claimed.has(s.id)).length;
  }, [data.subjects, data.teachers, data.classes]);

  const initiateDelete = (subj: Subject) => {
    setSubjectToDelete(subj);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!subjectToDelete) return;
    const id = subjectToDelete.id;

    const nextData = {
      ...data,
      subjects: data.subjects.filter((s) => s.id !== id),
      teachers: data.teachers.map((t) => ({
        ...t,
        specialtyIds: t.specialtyIds.filter((sid) => sid !== id),
      })),
      classes: data.classes.map((c) => ({
        ...c,
        curriculum: c.curriculum.filter((curr) => curr.subjectId !== id),
      })),
    };
    addActivity("ACADEMIC", `Deleted Subject: ${subjectToDelete.name}`, nextData);

    setDeleteModalOpen(false);
    setSubjectToDelete(null);
  };

  const usageToDelete = subjectToDelete
    ? getSubjectUsage(subjectToDelete.id)
    : { classCount: 0, teacherCount: 0 };
  const hasDependencies = usageToDelete.classCount > 0 || usageToDelete.teacherCount > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 pb-16 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content">Subject Library</h2>
          <p className="mt-1 text-xs text-content-muted">
            <span className="tabular-nums">{data.subjects.length}</span> subjects
            {unusedCount > 0 && (
              <>
                {" · "}
                <span className="tabular-nums">{unusedCount}</span> not yet used by any class or
                teacher
              </>
            )}
          </p>
        </div>
        <Button onClick={() => form.openModal()} icon={<Plus size={16} />}>
          New Subject
        </Button>
      </header>

      {sortedSubjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-edge px-5 py-12 text-center">
          <p className="text-sm text-content">No subjects yet.</p>
          <p className="mt-1 text-xs text-content-muted">
            Subjects are the building blocks of every class curriculum — add your first to get
            started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sortedSubjects.map((subj) => {
            const stats = getSubjectUsage(subj.id);
            return (
              <SubjectCard
                key={subj.id}
                subject={subj}
                classCount={stats.classCount}
                teacherCount={stats.teacherCount}
                requiredRoomName={
                  subj.requiredRoomId ? roomNameById.get(subj.requiredRoomId) : undefined
                }
                onEdit={() => form.openModal(subj)}
                onDelete={() => initiateDelete(subj)}
                onShowTeachers={() => setSubjectForTeacherList(subj)}
              />
            );
          })}
        </div>
      )}

      <SubjectEditorModal form={form} data={data} />

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete subject"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete Subject
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-danger-ink" size={18} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-content">
              Delete <span className="font-medium">{subjectToDelete?.name}</span>?
            </p>
            {hasDependencies ? (
              <>
                <p className="mt-1 text-xs text-content-muted">This also removes it from:</p>
                <ul className="mt-1.5 space-y-1 text-xs text-content-secondary">
                  {usageToDelete.classCount > 0 && (
                    <li className="flex gap-1.5">
                      <span aria-hidden>·</span>
                      <span>
                        <span className="font-medium tabular-nums">{usageToDelete.classCount}</span>{" "}
                        class {usageToDelete.classCount === 1 ? "curriculum" : "curriculums"}, along
                        with any lessons already scheduled for it
                      </span>
                    </li>
                  )}
                  {usageToDelete.teacherCount > 0 && (
                    <li className="flex gap-1.5">
                      <span aria-hidden>·</span>
                      <span>
                        <span className="font-medium tabular-nums">
                          {usageToDelete.teacherCount}
                        </span>{" "}
                        teacher {usageToDelete.teacherCount === 1 ? "record" : "records"}
                      </span>
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-content-muted">This cannot be undone.</p>
              </>
            ) : (
              <p className="mt-1 text-xs text-content-muted">
                No class or teacher currently uses it, so nothing else changes.
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
