import React, { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { AppData } from "../../types";
import { ClassGroup } from "./types";
import { Button, Modal } from "../../components/ui";
import { useClassActions } from "./hooks/useClassActions";
import { ClassList } from "./components/ClassList";
import { ClassGroups } from "./components/ClassGroups";
import { ClassEditorModal } from "./components/ClassEditorModal";
import { ClassAssignmentsPanel } from "./components/ClassAssignmentsPanel";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

type TabType = "LIST" | "GROUPS" | "ASSIGNMENTS";

export const ClassesView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<TabType>("LIST");

  // Logic Hook
  const { handleSaveClass, handleDuplicate, confirmDelete } = useClassActions(data, onUpdate);

  // Modal States
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    cls: ClassGroup | null;
  }>({
    isOpen: false,
    cls: null,
  });

  const [deleteState, setDeleteState] = useState<{
    isOpen: boolean;
    cls: ClassGroup | null;
  }>({
    isOpen: false,
    cls: null,
  });

  // Handlers
  const openEditor = (cls: ClassGroup | null = null) => setEditorState({ isOpen: true, cls });
  const closeEditor = () => setEditorState({ isOpen: false, cls: null });

  const openDelete = (cls: ClassGroup) => setDeleteState({ isOpen: true, cls });
  const closeDelete = () => setDeleteState({ isOpen: false, cls: null });

  const handleConfirmDelete = () => {
    if (deleteState.cls) confirmDelete(deleteState.cls);
    closeDelete();
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Class Management</h2>
          <p className="text-xs text-slate-500">
            Configure classes, curriculum, and advanced grouping.
          </p>
        </div>
        <Button onClick={() => openEditor(null)} icon={<Plus size={16} />}>
          New Class
        </Button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <TabButton
          label="Class List"
          active={activeTab === "LIST"}
          onClick={() => setActiveTab("LIST")}
        />
        <TabButton
          label="Assignments"
          active={activeTab === "ASSIGNMENTS"}
          onClick={() => setActiveTab("ASSIGNMENTS")}
        />
        <TabButton
          label="Groups & Blocks"
          active={activeTab === "GROUPS"}
          onClick={() => setActiveTab("GROUPS")}
        />
      </div>

      {/* CONTENT AREA */}
      {activeTab === "LIST" && (
        <ClassList
          data={data}
          onEdit={openEditor}
          onDuplicate={handleDuplicate}
          onDelete={openDelete}
          onAdd={() => openEditor(null)}
        />
      )}

      {activeTab === "GROUPS" && <ClassGroups data={data} onUpdate={onUpdate} />}

      {activeTab === "ASSIGNMENTS" && <ClassAssignmentsPanel data={data} onUpdate={onUpdate} />}

      {/* MODALS */}
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

      <DeleteClassModal
        isOpen={deleteState.isOpen}
        classGroup={deleteState.cls}
        onClose={closeDelete}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

// --- SUB-COMPONENTS TO REDUCE BLOAT ---

const TabButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
      active
        ? "border-amber-500 text-amber-600"
        : "border-transparent text-slate-500 hover:text-slate-700"
    }`}
  >
    {label}
  </button>
);

const DeleteClassModal: React.FC<{
  isOpen: boolean;
  classGroup: ClassGroup | null;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ isOpen, classGroup, onClose, onConfirm }) => {
  if (!classGroup) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Deletion">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">Delete "{classGroup.name}"?</p>
            <p className="text-sm text-slate-500 mt-2">
              This will remove the class, its curriculum assignments, and its associated
              system-managed Home Room.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Delete Class
          </Button>
        </div>
      </div>
    </Modal>
  );
};
