import React, { useMemo, useState } from "react";
import { AlertTriangle, Library, Plus, Search } from "lucide-react";
import { AppData } from "../../types";
import { Button, Modal, Input, controlClass } from "../../components/ui";
import { TeacherEditorModal } from "./components/TeacherEditorModal";
import { TeacherDirectory } from "./components/TeacherDirectory";
import { FacultyList } from "./components/FacultyList";
import { useTeacherManagement } from "./hooks/useTeacherManagement";
import { useWorkloadStats } from "../workload/hooks/useWorkloadStats";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

const TABS = [
  { id: "LIST", label: "Directory" },
  { id: "FACULTIES", label: "Faculties" },
] as const;

export const TeachersView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const {
    activeTab,
    setActiveTab,
    nameFilter,
    setNameFilter,
    subjectFilter,
    setSubjectFilter,
    modalOpen,
    setModalOpen,
    editingTeacher,
    deleteModalOpen,
    setDeleteModalOpen,
    teacherToDelete,
    filteredTeachers,
    sortedSubjects,
    openModal,
    handleSaveTeacher,
    duplicateTeacher,
    initiateDelete,
    confirmDelete,
    quickAddTeacherToFaculty,
  } = useTeacherManagement(data, onUpdate);

  const { workloadStats } = useWorkloadStats(data);
  const workloadByTeacherId = useMemo(
    () => new Map(workloadStats.map((s) => [s.t.id, s])),
    [workloadStats],
  );

  const [quickAddSubjectId, setQuickAddSubjectId] = useState<string | null>(null);
  const [quickAddName, setQuickAddName] = useState("");

  const confirmQuickAdd = () => {
    if (quickAddSubjectId && quickAddName.trim()) {
      quickAddTeacherToFaculty(quickAddSubjectId, quickAddName.trim());
    }
    setQuickAddSubjectId(null);
    setQuickAddName("");
  };

  /** Summary counts describe the roster, so they read from all teachers, not the filtered set. */
  const summary = useMemo(() => {
    const unassigned = data.teachers.filter(
      (t) => (workloadByTeacherId.get(t.id)?.assignedPeriods ?? 0) === 0,
    ).length;
    const restricted = data.teachers.filter(
      (t) => (t.constraints || []).flat().filter(Boolean).length > 0,
    ).length;
    return { total: data.teachers.length, unassigned, restricted };
  }, [data.teachers, workloadByTeacherId]);

  const isFiltered = Boolean(nameFilter || subjectFilter);

  const quickAddSubjectName = data.subjects.find((s) => s.id === quickAddSubjectId)?.name;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 pb-16 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content">Teachers</h2>
          <p className="mt-1 text-xs text-content-muted">
            <span className="tabular-nums">{summary.total}</span> on the roster
            {summary.unassigned > 0 && (
              <>
                {" · "}
                <span className="tabular-nums text-accent-ink">{summary.unassigned}</span> with no
                assigned periods
              </>
            )}
            {summary.restricted > 0 && (
              <>
                {" · "}
                <span className="tabular-nums">{summary.restricted}</span> with blocked slots
              </>
            )}
          </p>
        </div>
        <Button onClick={() => openModal()} icon={<Plus size={16} />}>
          Add Teacher
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Teacher views"
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-edge bg-surface p-0.5"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`h-8 rounded px-3 text-sm transition-colors focus-visible:outline-none
                            focus-visible:ring-2 focus-visible:ring-accent ${
                              isActive
                                ? "bg-surface-inset font-medium text-content dark:bg-slate-700"
                                : "text-content-muted hover:text-content"
                            }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "LIST" && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
              <Search
                size={14}
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
              />
              <input
                aria-label="Search teachers by name"
                className={`${controlClass} w-full pl-8`}
                placeholder="Search by name"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <div className="relative min-w-[10rem] flex-1 sm:max-w-[14rem]">
              <Library
                size={14}
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-content-muted"
              />
              <input
                aria-label="Filter teachers by subject"
                className={`${controlClass} w-full pl-8`}
                placeholder="Filter by subject"
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {activeTab === "LIST" && (
        <div className="space-y-2">
          {isFiltered && (
            <p className="text-xs text-content-muted">
              Showing <span className="tabular-nums">{filteredTeachers.length}</span> of{" "}
              <span className="tabular-nums">{summary.total}</span>
              <button
                type="button"
                onClick={() => {
                  setNameFilter("");
                  setSubjectFilter("");
                }}
                className="ml-2 rounded text-accent-ink underline-offset-4 hover:underline
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Clear filters
              </button>
            </p>
          )}
          <TeacherDirectory
            data={data}
            teachers={filteredTeachers}
            workloadByTeacherId={workloadByTeacherId}
            onEdit={openModal}
            onDuplicate={duplicateTeacher}
            onDelete={initiateDelete}
            emptyMessage={
              <div className="rounded-lg border border-dashed border-edge px-5 py-10 text-center">
                <p className="text-sm text-content">
                  {isFiltered ? "No teachers match these filters." : "No teachers yet."}
                </p>
                <p className="mt-1 text-xs text-content-muted">
                  {isFiltered
                    ? "Try a different name or subject."
                    : "Add your staff to start assigning them to classes."}
                </p>
              </div>
            }
          />
        </div>
      )}

      {activeTab === "FACULTIES" && (
        <FacultyList
          data={data}
          subjects={sortedSubjects}
          onEditTeacher={openModal}
          onQuickAdd={(subjectId) => {
            setQuickAddSubjectId(subjectId);
            setQuickAddName("");
          }}
        />
      )}

      <TeacherEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingTeacher={editingTeacher}
        data={data}
        onSave={handleSaveTeacher}
      />

      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Delete teacher"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete Teacher
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-danger-ink" size={18} aria-hidden />
          <div>
            <p className="text-sm text-content">
              Delete <span className="font-medium">{teacherToDelete?.name}</span>?
            </p>
            <p className="mt-1 text-xs text-content-muted">
              They are removed from the roster and unassigned from every class that currently names
              them. Lessons stay in place without a teacher.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={quickAddSubjectId !== null}
        onClose={() => setQuickAddSubjectId(null)}
        title="Add teacher to faculty"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={() => setQuickAddSubjectId(null)}>
              Cancel
            </Button>
            <Button onClick={confirmQuickAdd} disabled={!quickAddName.trim()}>
              Add Teacher
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-content-muted">
            Adds <span className="font-medium text-content-secondary">{quickAddSubjectName}</span>{" "}
            to this teacher&apos;s subjects. An existing teacher with the same name joins the
            faculty instead of being duplicated.
          </p>
          <Input
            label="Teacher name"
            value={quickAddName}
            onChange={(e) => setQuickAddName(e.target.value)}
            placeholder="Enter teacher name"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && confirmQuickAdd()}
          />
        </div>
      </Modal>
    </div>
  );
};
