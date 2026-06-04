import { useState, useMemo } from "react";
import { AppData } from "../../../types";
import { Teacher } from "../types";
import { generateId } from "../../../utils/utils";
import { useProfile } from "../../../contexts/ProfileContext";

export const useTeacherManagement = (data: AppData, _onUpdate: (d: AppData) => void) => {
  const { addActivity } = useProfile();
  const [activeTab, setActiveTab] = useState<"LIST" | "FACULTIES">("LIST");

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
        const matchesName = t.name.toLowerCase().includes(nameFilter.toLowerCase());
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

  // --- ACTIONS ---
  const openModal = (teacher?: Teacher) => {
    setEditingTeacher(teacher || null);
    setModalOpen(true);
  };

  const handleSaveTeacher = (newT: Teacher) => {
    const newTeachers = editingTeacher
      ? data.teachers.map((t) => (t.id === editingTeacher.id ? newT : t))
      : [...data.teachers, newT];

    const nextData = { ...data, teachers: newTeachers };
    const msg = editingTeacher ? `Updated Teacher: ${newT.name}` : `Added Teacher: ${newT.name}`;
    addActivity("ACADEMIC", msg, nextData);
  };

  const duplicateTeacher = (t: Teacher) => {
    const copy: Teacher = {
      ...t,
      id: generateId(),
      name: `${t.name} (Copy)`,
      constraints: JSON.parse(JSON.stringify(t.constraints || [])),
    };
    const nextData = { ...data, teachers: [...data.teachers, copy] };
    addActivity("ACADEMIC", `Duplicated Teacher: ${t.name}`, nextData);
  };

  const initiateDelete = (t: Teacher) => {
    setTeacherToDelete(t);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (!teacherToDelete) return;
    const id = teacherToDelete.id;

    // Remove teacher and strip assignments from classes
    const nextData = {
      ...data,
      teachers: data.teachers.filter((t) => t.id !== id),
      classes: data.classes.map((c) => ({
        ...c,
        curriculum: c.curriculum.map((i) =>
          i.assignedTeacherId === id ? { ...i, assignedTeacherId: undefined } : i,
        ),
      })),
    };

    addActivity("ACADEMIC", `Deleted Teacher: ${teacherToDelete.name}`, nextData);

    setDeleteModalOpen(false);
    setTeacherToDelete(null);
  };

  const quickAddTeacherToFaculty = (subjectId: string, name: string) => {
    if (!name.trim()) return;

    const existingTeacher = data.teachers.find((t) => t.name.toLowerCase() === name.toLowerCase());

    let newTeachers = [...data.teachers];
    let msg = "";

    if (existingTeacher) {
      if (!existingTeacher.specialtyIds.includes(subjectId)) {
        newTeachers = data.teachers.map((t) =>
          t.id === existingTeacher.id ? { ...t, specialtyIds: [...t.specialtyIds, subjectId] } : t,
        );
        const subj = data.subjects.find((s) => s.id === subjectId);
        msg = `Added ${existingTeacher.name} to ${subj?.name} faculty`;
      }
    } else {
      // Create new teacher
      const maxP = Math.max(
        data.settings.periodsPerDay,
        ...data.classes.map((c) => c.periodCount || 0),
      );
      const newT: Teacher = {
        id: generateId(),
        name: name.trim(),
        specialtyIds: [subjectId],
        constraints: Array(5)
          .fill(null)
          .map(() => Array(maxP).fill(false)),
      };
      newTeachers.push(newT);
      const subj = data.subjects.find((s) => s.id === subjectId);
      msg = `Added Teacher: ${newT.name} (${subj?.name})`;
    }

    if (msg) {
      const nextData = { ...data, teachers: newTeachers };
      addActivity("ACADEMIC", msg, nextData);
    }
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

    // Actions
    openModal,
    handleSaveTeacher,
    duplicateTeacher,
    initiateDelete,
    confirmDelete,
    quickAddTeacherToFaculty,
  };
};
