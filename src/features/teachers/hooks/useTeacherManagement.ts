import { useState, useMemo } from "react";
import { AppData, Teacher } from "../../../types";
import { generateId } from "../../../utils/utils";

export const useTeacherManagement = (
  data: AppData,
  onUpdate: (d: AppData) => void
) => {
  const [activeTab, setActiveTab] = useState<"LIST" | "FACULTIES" | "CLASSES">(
    "LIST"
  );

  // Search / Filter State
  const [nameFilter, setNameFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Delete Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

  // --- MEMOIZED DATA ---
  const filteredTeachers = useMemo(() => {
    return data.teachers
      .filter((t) => {
        const matchesName = t.name
          .toLowerCase()
          .includes(nameFilter.toLowerCase());
        if (!subjectFilter) return matchesName;
        const matchesSubject = t.specialtyIds.some((sid) => {
          const subj = data.subjects.find((s) => s.id === sid);
          return subj?.name.toLowerCase().includes(subjectFilter.toLowerCase());
        });
        return matchesName && matchesSubject;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.teachers, data.subjects, nameFilter, subjectFilter]);

  const sortedSubjects = useMemo(() => {
    return [...data.subjects].sort((a, b) => a.name.localeCompare(b.name));
  }, [data.subjects]);

  const sortedClasses = useMemo(() => {
    return [...data.classes].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true })
    );
  }, [data.classes]);

  // --- ACTIONS ---
  const openModal = (teacher?: Teacher) => {
    setEditingTeacher(teacher || null);
    setModalOpen(true);
  };

  const handleSaveTeacher = (newT: Teacher) => {
    const newTeachers = editingTeacher
      ? data.teachers.map((t) => (t.id === editingTeacher.id ? newT : t))
      : [...data.teachers, newT];
    onUpdate({ ...data, teachers: newTeachers });
  };

  const duplicateTeacher = (t: Teacher) => {
    const copy: Teacher = {
      ...t,
      id: generateId(),
      name: `${t.name} (Copy)`,
      constraints: JSON.parse(JSON.stringify(t.constraints || [])),
    };
    onUpdate({ ...data, teachers: [...data.teachers, copy] });
  };

  const initiateDelete = (t: Teacher) => {
    setTeacherToDelete(t);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!teacherToDelete) return;
    const id = teacherToDelete.id;
    // Remove teacher and strip assignments from classes
    onUpdate({
      ...data,
      teachers: data.teachers.filter((t) => t.id !== id),
      classes: data.classes.map((c) => ({
        ...c,
        curriculum: c.curriculum.map((i) =>
          i.assignedTeacherId === id
            ? { ...i, assignedTeacherId: undefined }
            : i
        ),
      })),
    });
    setDeleteModalOpen(false);
    setTeacherToDelete(null);
  };

  return {
    // State
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

    // Data
    filteredTeachers,
    sortedSubjects,
    sortedClasses,

    // Actions
    openModal,
    handleSaveTeacher,
    duplicateTeacher,
    initiateDelete,
    confirmDelete,
  };
};
