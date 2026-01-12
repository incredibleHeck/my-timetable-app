import React from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Copy,
  Ban,
  AlertTriangle,
  CheckSquare,
  BookOpen,
  Library,
  Users,
  Search,
} from "lucide-react";
import { AppData } from "../../types";
import { Teacher } from "./types";
import { Button, Modal, Badge } from "../../components/ui";
import { TeacherEditorModal } from "./components/TeacherEditorModal";
import { useTeacherManagement } from "./hooks/useTeacherManagement";

interface ViewProps {
  data: AppData;
  onUpdate: (newData: AppData) => void;
}

export const TeachersView: React.FC<ViewProps> = ({ data, onUpdate }) => {
  // Use the new Hook
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

  const handleQuickAdd = (subjectId: string) => {
    const name = window.prompt("Enter Teacher Name to add to this Faculty:");
    if (name) {
      quickAddTeacherToFaculty(subjectId, name);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto p-8">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Faculty Management
          </h2>
          <p className="text-xs text-slate-500">
            Manage teachers, availability, and view departmental groupings.
          </p>
        </div>
        {activeTab === "LIST" && (
          <Button onClick={() => openModal()} icon={<Plus size={16} />}>
            Add Teacher
          </Button>
        )}
      </div>

      {/* TABS */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab("LIST")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "LIST"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Users size={16} /> Teacher Directory
        </button>
        <button
          onClick={() => setActiveTab("FACULTIES")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "FACULTIES"
              ? "border-amber-500 text-amber-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <Library size={16} /> Faculties
        </button>
      </div>

      {/* --- TAB 1: TEACHER DIRECTORY --- */}
      {activeTab === "LIST" && (
        <div className="space-y-4 animate-in slide-in-from-bottom-2">
          <div className="flex flex-col md:flex-row gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex-1 relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 font-medium"
                placeholder="Search by name..."
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
              />
            </div>
            <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
            <div className="flex-1 relative">
              <Library
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                className="w-full pl-9 pr-4 py-2 text-sm border-none focus:ring-0 text-slate-700 placeholder:text-slate-400 font-medium"
                placeholder="Filter by subject..."
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTeachers.map((t) => (
              <div
                key={t.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all group"
              >
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center font-bold text-slate-500 border border-slate-300 shadow-inner">
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className="font-bold text-slate-800 truncate text-base"
                      title={t.name}
                    >
                      {t.name}
                    </h3>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.specialtyIds.slice(0, 3).map((sid) => {
                        const s = data.subjects.find((sub) => sub.id === sid);
                        return s ? (
                          <Badge
                            key={sid}
                            style={{
                              backgroundColor: `${s.color}20`,
                              color: s.color,
                              borderColor: `${s.color}40`,
                            }}
                            className="text-[10px] py-0.5"
                          >
                            {s.name}
                          </Badge>
                        ) : null;
                      })}
                      {t.specialtyIds.length > 3 && (
                        <Badge className="text-[10px] py-0.5 bg-slate-100 text-slate-500">
                          +{t.specialtyIds.length - 3}
                        </Badge>
                      )}
                      {t.specialtyIds.length === 0 && (
                        <span className="text-[10px] text-slate-400 italic">
                          No specialties
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                  <div className="text-xs text-slate-400 font-medium">
                    {t.constraints &&
                    t.constraints.flat().filter(Boolean).length > 0 ? (
                      <span className="flex items-center text-amber-600">
                        <Ban size={12} className="mr-1" /> Restrictions Active
                      </span>
                    ) : (
                      <span className="flex items-center text-emerald-600">
                        <CheckSquare size={12} className="mr-1" /> Fully
                        Available
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => duplicateTeacher(t)}
                      className="p-2 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-colors"
                      title="Duplicate"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => openModal(t)}
                      className="p-2 hover:bg-slate-100 rounded-md text-slate-400 hover:text-amber-600 transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => initiateDelete(t)}
                      className="p-2 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={() => openModal()}
              className="rounded-xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/50 transition-all flex flex-col items-center justify-center p-6 min-h-[160px] group"
            >
              <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-amber-100 text-slate-400 group-hover:text-amber-500 flex items-center justify-center mb-3 transition-colors">
                <Plus size={24} />
              </div>
              <span className="font-bold text-sm text-slate-500 group-hover:text-amber-600">
                Add New Teacher
              </span>
            </button>
          </div>
        </div>
      )}

      {/* --- TAB 2: FACULTIES --- */}
      {activeTab === "FACULTIES" && (
        <div className="animate-in slide-in-from-right-4">
          <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-800 text-sm">
            <span className="font-bold block mb-1">Faculty Overview</span>
            Teachers are automatically grouped here based on the subjects they
            are set to teach.
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sortedSubjects.map((subject) => {
              const facultyMembers = data.teachers
                .filter((t) => t.specialtyIds.includes(subject.id))
                .sort((a, b) => a.name.localeCompare(b.name));
              return (
                <div
                  key={subject.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row min-h-[100px]"
                >
                  <div
                    className="p-4 bg-slate-50 border-b sm:border-b-0 sm:border-r border-slate-200 flex justify-between items-center sm:flex-col sm:justify-center sm:w-36 shrink-0"
                    style={{ borderTop: `4px solid ${subject.color}` }}
                  >
                    <div className="sm:text-center">
                        <h3 className="font-bold text-slate-800 text-sm">
                        {subject.name}
                        </h3>
                        <p className="text-[9px] text-slate-500 uppercase tracking-wide">
                            {facultyMembers.length} Staff
                        </p>
                    </div>
                    <button
                        onClick={() => handleQuickAdd(subject.id)}
                        className="p-1 rounded-full hover:bg-white text-slate-400 hover:text-amber-600 transition-colors mt-2 hidden sm:block"
                        title="Quick Add Teacher"
                    >
                        <Plus size={16} />
                    </button>
                  </div>
                  <div className="p-3 flex flex-wrap gap-2 items-center flex-1">
                    {facultyMembers.length > 0 ? (
                        facultyMembers.map((t) => (
                          <div
                            key={t.id}
                            className="flex items-center gap-2 p-1.5 bg-white rounded-lg border border-slate-100 hover:border-amber-200 transition-all shadow-sm group"
                          >
                            <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {t.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .substring(0, 2)}
                            </div>
                            <span className="text-xs font-medium text-slate-700 whitespace-nowrap">
                              {t.name}
                            </span>
                          </div>
                        ))
                    ) : (
                      <div className="w-full py-2 text-center text-[10px] text-slate-400 italic">
                        No teachers assigned.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
        title="Confirm Deletion"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Delete Teacher
            </Button>
          </div>
        }
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-lg">
              Delete "{teacherToDelete?.name}"?
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Are you sure? This removes them from all classes.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};
