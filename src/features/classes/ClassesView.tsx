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

export const ClassesView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<
    "LIST" | "GROUPS" | "ASSIGNMENTS"
  >("LIST");

  const { handleSaveClass, handleDuplicate, confirmDelete } = useClassActions(data, onUpdate);

  // Modals State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);

  const openModal = (cls?: ClassGroup) => {
    setEditingClass(cls || null);
    setModalOpen(true);
  };

  const initiateDelete = (cls: ClassGroup) => {
    setClassToDelete(cls);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (classToDelete) {
      confirmDelete(classToDelete);
      setDeleteModalOpen(false);
      setClassToDelete(null);
    }
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
        <Button onClick={() => openModal()} icon={<Plus size={16} />}>
          New Class
        </Button>
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("LIST")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "LIST"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Class List
        </button>
        <button
          onClick={() => setActiveTab("ASSIGNMENTS")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "ASSIGNMENTS"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Assignments
        </button>
        <button
          onClick={() => setActiveTab("GROUPS")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "GROUPS"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Groups & Blocks
        </button>
      </div>

      {/* CONTENT */}
      {activeTab === "LIST" && (
        <ClassList 
          data={data}
          onEdit={openModal}
          onDuplicate={handleDuplicate}
          onDelete={initiateDelete}
          onAdd={() => openModal()}
        />
      )}

      {activeTab === "GROUPS" && (
        <ClassGroups 
          data={data}
          onUpdate={onUpdate}
        />
      )}

      {activeTab === "ASSIGNMENTS" && (
        <ClassAssignmentsPanel data={data} onUpdate={onUpdate} />
      )}

      {/* MODALS */}
      <ClassEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingClass={editingClass}
        data={data}
        onSave={(cls, original) => handleSaveClass(cls, original)}
      />

      {/* DELETE CONFIRMATION */}
      <Modal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirm Deletion"
      >
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-lg">
                Delete "{classToDelete?.name}"?
              </p>
              <p className="text-sm text-slate-500 mt-2">
                This will remove the class and all its curriculum assignments.
                It will also remove its associated system-managed Home Room.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete Class
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};