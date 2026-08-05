import React, { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { AppData } from "../../types";
import { ClassGroup } from "./types";
import { Button, Modal } from "../../components/ui";
import { useClassActions } from "./hooks/useClassActions";
import { useClassMetrics } from "./hooks/useClassMetrics";
import { ClassList } from "./components/ClassList";
import { ClassGroups } from "./components/ClassGroups";
import { ClassEditorModal } from "./components/ClassEditorModal";
import { ClassAssignmentsPanel } from "./components/ClassAssignmentsPanel";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

type TabType = "LIST" | "ASSIGNMENTS" | "GROUPS";

const TABS = [
  { id: "LIST", label: "Class List" },
  { id: "ASSIGNMENTS", label: "Assignments" },
  { id: "GROUPS", label: "Groups & Blocks" },
] as const;

export const ClassesView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<TabType>("LIST");

  const { handleSaveClass, handleDuplicate, confirmDelete } = useClassActions(data, onUpdate);
  const { getLoadMetrics } = useClassMetrics(data);

  const [editorState, setEditorState] = useState<{ isOpen: boolean; cls: ClassGroup | null }>({
    isOpen: false,
    cls: null,
  });
  const [deleteState, setDeleteState] = useState<{ isOpen: boolean; cls: ClassGroup | null }>({
    isOpen: false,
    cls: null,
  });

  const openEditor = (cls: ClassGroup | null = null) => setEditorState({ isOpen: true, cls });
  const closeEditor = () => setEditorState({ isOpen: false, cls: null });
  const closeDelete = () => setDeleteState({ isOpen: false, cls: null });

  const handleConfirmDelete = () => {
    if (deleteState.cls) confirmDelete(deleteState.cls);
    closeDelete();
  };

  /** Counts that tell you whether the roster needs attention, not just its size. */
  const summary = useMemo(() => {
    let overloaded = 0;
    let unstaffed = 0;
    for (const cls of data.classes) {
      const { assigned, capacity } = getLoadMetrics(cls);
      if (assigned > capacity) overloaded++;
      if (cls.curriculum.some((c) => c.periodsPerWeek > 0 && !c.assignedTeacherId)) unstaffed++;
    }
    return { total: data.classes.length, overloaded, unstaffed };
  }, [data.classes, getLoadMetrics]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6 pb-16 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content">Classes</h2>
          <p className="mt-1 text-xs text-content-muted">
            <span className="tabular-nums">{summary.total}</span> class groups
            {summary.overloaded > 0 && (
              <>
                {" · "}
                <span className="tabular-nums text-danger-ink">{summary.overloaded}</span> over
                capacity
              </>
            )}
            {summary.unstaffed > 0 && (
              <>
                {" · "}
                <span className="tabular-nums text-accent-ink">{summary.unstaffed}</span> with
                unstaffed subjects
              </>
            )}
          </p>
        </div>
        <Button onClick={() => openEditor(null)} icon={<Plus size={16} />}>
          New Class
        </Button>
      </header>

      <div
        role="tablist"
        aria-label="Class views"
        className="inline-flex h-9 items-center rounded-md border border-edge bg-surface p-0.5"
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
              className={`h-8 whitespace-nowrap rounded px-3 text-sm transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
        <ClassList
          data={data}
          onEdit={openEditor}
          onDuplicate={handleDuplicate}
          onDelete={(cls) => setDeleteState({ isOpen: true, cls })}
          onAdd={() => openEditor(null)}
        />
      )}

      {activeTab === "ASSIGNMENTS" && <ClassAssignmentsPanel data={data} onUpdate={onUpdate} />}

      {activeTab === "GROUPS" && <ClassGroups data={data} onUpdate={onUpdate} />}

      <ClassEditorModal
        isOpen={editorState.isOpen}
        onClose={closeEditor}
        editingClass={editorState.cls}
        data={data}
        onSave={(cls, original) => {
          handleSaveClass(cls, original);
          closeEditor();
        }}
      />

      <Modal
        isOpen={deleteState.isOpen}
        onClose={closeDelete}
        title="Delete class"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="secondary" onClick={closeDelete}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleConfirmDelete}>
              Delete Class
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 shrink-0 text-danger-ink" size={18} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm text-content">
              Delete <span className="font-medium">{deleteState.cls?.name}</span>?
            </p>
            <p className="mt-1 text-xs text-content-muted">
              Its curriculum and its home room go with it, and the class is dropped from any joint
              class or elective block it belongs to. This cannot be undone.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
