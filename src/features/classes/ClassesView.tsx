import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Clock,
  Copy,
  Layers,
  Link2,
  X,
  AlertTriangle,
} from "lucide-react";
import { AppData } from "../../types";
import { ClassGroup, JointClass, ElectiveBlock } from "./types";
import { Button, Modal } from "../../components/ui";
import { generateId } from "../../utils/utils";
import { ClassEditorModal } from "./components/ClassEditorModal";
import { JointClassModal, ElectiveBlockModal } from "./components/GroupModals";
import { ClassAssignmentsPanel } from "./components/ClassAssignmentsPanel";
import { useClassMetrics } from "./hooks/useClassMetrics";
import { useProfile } from "../../contexts/ProfileContext";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const ClassesView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  const { addActivity } = useProfile();
  const [activeTab, setActiveTab] = useState<
    "LIST" | "LINKED" | "ELECTIVES" | "ASSIGNMENTS"
  >("LIST");

  const { getLoadMetrics } = useClassMetrics(data);

  // Modals State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassGroup | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isElectiveModalOpen, setIsElectiveModalOpen] = useState(false);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [classToDelete, setClassToDelete] = useState<ClassGroup | null>(null);

  // ------------------------------------------------------------------
  //  CLASS HANDLERS
  // ------------------------------------------------------------------
  const openModal = (cls?: ClassGroup) => {
    setEditingClass(cls || null);
    setModalOpen(true);
  };

  const handleDuplicate = (cls: ClassGroup) => {
    const newClass: ClassGroup = JSON.parse(JSON.stringify(cls));
    newClass.id = generateId();
    newClass.name = `${cls.name} (Copy)`;
    newClass.curriculum.forEach((c) => (c.id = generateId()));
    addActivity("ACADEMIC", `Duplicated Class: ${cls.name}`);
    onUpdate({ ...data, classes: [...data.classes, newClass] });
  };

  const handleSaveClass = (newClass: ClassGroup) => {
    let newClasses = [...data.classes];
    if (editingClass) {
      addActivity("ACADEMIC", `Updated Class: ${newClass.name}`);
      newClasses = newClasses.map((c) =>
        c.id === editingClass.id ? newClass : c
      );
    } else {
      addActivity("ACADEMIC", `Added Class: ${newClass.name}`);
      newClasses.push(newClass);
    }
    onUpdate({ ...data, classes: newClasses });
  };

  const initiateDelete = (cls: ClassGroup) => {
    setClassToDelete(cls);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!classToDelete) return;
    addActivity("ACADEMIC", `Deleted Class: ${classToDelete.name}`);
    const newClasses = data.classes.filter((c) => c.id !== classToDelete.id);
    const newJoints = data.jointClasses
      .map((j) => ({
        ...j,
        classIds: j.classIds.filter((id) => id !== classToDelete.id),
      }))
      .filter((j) => j.classIds.length >= 2);
    const newElectives = (data.electives || [])
      .map((e) => ({
        ...e,
        classIds: e.classIds.filter((id) => id !== classToDelete.id),
      }))
      .filter((e) => e.classIds.length > 0);
    onUpdate({
      ...data,
      classes: newClasses,
      jointClasses: newJoints,
      electives: newElectives,
    });
    setDeleteModalOpen(false);
    setClassToDelete(null);
  };

  // ------------------------------------------------------------------
  //  GROUP HANDLERS
  // ------------------------------------------------------------------
  const handleSaveLink = (newJoint: JointClass) => {
    addActivity("ACADEMIC", `Created Joint Class: ${newJoint.name}`);
    onUpdate({ ...data, jointClasses: [...data.jointClasses, newJoint] });
  };

  const handleSaveElective = (newElec: ElectiveBlock) => {
    const safeElectives = data.electives || [];
    addActivity("ACADEMIC", `Created Elective Block: ${newElec.name}`);
    onUpdate({ ...data, electives: [...safeElectives, newElec] });
  };

  const handleRemoveJoint = (id: string) => {
    const joint = data.jointClasses.find(j => j.id === id);
    addActivity("ACADEMIC", `Deleted Joint Class: ${joint?.name}`);
    onUpdate({
      ...data,
      jointClasses: data.jointClasses.filter((j) => j.id !== id),
    });
  }
  const handleRemoveElective = (id: string) => {
    const elec = (data.electives || []).find(e => e.id === id);
    addActivity("ACADEMIC", `Deleted Elective Block: ${elec?.name}`);
    onUpdate({
      ...data,
      electives: (data.electives || []).filter((e) => e.id !== id),
    });
  }

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
          onClick={() => setActiveTab("LINKED")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "LINKED"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Linked Classes
        </button>
        <button
          onClick={() => setActiveTab("ELECTIVES")}
          className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "ELECTIVES"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Elective Blocks
        </button>
      </div>

      {/* --- TAB 1: LIST --- */}
      {activeTab === "LIST" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-bottom-2">
          {data.classes.map((c) => {
            const { assigned, capacity } = getLoadMetrics(c);
            const loadPercent = capacity > 0 ? (assigned / capacity) * 100 : 0;
            const isOverloaded = assigned > capacity;
            const isFull = assigned === capacity;

            return (
              <div
                key={c.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group relative"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        {c.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <Clock size={12} /> {c.duration} mins
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
                      {c.name.substring(0, 2).toUpperCase()}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Periods/Day</span>
                      <span className="font-bold text-slate-700">
                        {c.periodCount}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Subjects</span>
                      <span className="font-bold text-slate-700">
                        {c.curriculum.length}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Weekly Load</span>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOverloaded
                                ? "bg-red-500"
                                : isFull
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(loadPercent, 100)}%` }}
                          />
                        </div>
                        <span
                          className={`font-bold ${
                            isOverloaded
                              ? "text-red-600"
                              : isFull
                              ? "text-amber-600"
                              : "text-slate-700"
                          }`}
                        >
                          {assigned}/{capacity}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <Button
                      onClick={() => openModal(c)}
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs"
                    >
                      Edit
                    </Button>
                    <button
                      onClick={() => handleDuplicate(c)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Duplicate Class"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => initiateDelete(c)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete Class"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            onClick={() => openModal()}
            className="min-h-[200px] rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50 transition-all flex flex-col items-center justify-center p-6 text-slate-400 hover:text-amber-600"
          >
            <Plus size={32} className="mb-2" />{" "}
            <span className="font-bold">Add Class</span>
          </button>
        </div>
      )}

      {/* --- TAB 3: LINKED (Joint) --- */}
      {activeTab === "LINKED" && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="text-sm text-blue-800">
              <span className="font-bold">Horizontal Linking:</span> Schedule{" "}
              <b>Multiple Classes</b> to have the <b>Same Subject</b> at the{" "}
              <b>Same Time</b>.
            </div>
            <Button onClick={() => setIsLinkModalOpen(true)} size="sm">
              New Link
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.jointClasses.map((joint) => (
              <div
                key={joint.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group"
              >
                <button
                  onClick={() => handleRemoveJoint(joint.id)}
                  className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Link2 size={16} className="text-blue-500" /> {joint.name}
                </h4>
                <div className="text-xs font-bold text-slate-600 mb-2 px-2 py-1 bg-slate-100 rounded inline-block">
                  {data.subjects.find((s) => s.id === joint.subjectId)?.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {joint.classIds.map((cid) => (
                    <span key={cid} className="text-[10px] border px-1 rounded">
                      {data.classes.find((c) => c.id === cid)?.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 4: ELECTIVES (Blocks) --- */}
      {activeTab === "ELECTIVES" && (
        <div className="space-y-4 animate-in slide-in-from-right-4">
          <div className="flex justify-between items-center bg-purple-50 p-4 rounded-xl border border-purple-100">
            <div className="text-sm text-purple-800">
              <span className="font-bold">Vertical Blocking:</span> Schedule{" "}
              <b>Multiple Subjects</b> for <b>One Class</b> at the{" "}
              <b>Same Time</b> (Options/Electives).
            </div>
            <Button onClick={() => setIsElectiveModalOpen(true)} size="sm">
              New Block
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data.electives || []).map((elec) => (
              <div
                key={elec.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group"
              >
                <button
                  onClick={() => handleRemoveElective(elec.id)}
                  className="absolute top-3 right-3 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={16} />
                </button>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Layers size={16} className="text-purple-500" /> {elec.name}
                </h4>
                <div className="text-xs font-bold text-slate-500 mb-3">
                  Classes:{" "}
                  <span className="text-slate-800">
                    {elec.classIds
                      .map((cid) => data.classes.find((c) => c.id === cid)?.name)
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                </div>
                <div className="space-y-1">
                  {elec.subjectIds.map((sid) => {
                    const subj = data.subjects.find((s) => s.id === sid);
                    return (
                      <div
                        key={sid}
                        className="flex items-center gap-2 text-xs"
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: subj?.color }}
                        ></div>
                        <span>{subj?.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB 5: ASSIGNMENTS --- */}
      {activeTab === "ASSIGNMENTS" && (
        <ClassAssignmentsPanel data={data} onUpdate={onUpdate} />
      )}

      {/* --- MODALS --- */}
      <ClassEditorModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editingClass={editingClass}
        data={data}
        onSave={handleSaveClass}
      />

      <JointClassModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        subjects={data.subjects}
        classes={data.classes}
        teachers={data.teachers}
        onSave={handleSaveLink}
      />

      <ElectiveBlockModal
        isOpen={isElectiveModalOpen}
        onClose={() => setIsElectiveModalOpen(false)}
        subjects={data.subjects}
        classes={data.classes}
        onSave={handleSaveElective}
      />

      {/* DELETE CONFIRMATION MODAL */}
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
                It will also remove this class from any Joint Classes or
                Elective Blocks it belongs to.
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
            <Button variant="danger" onClick={confirmDelete}>
              Delete Class
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
