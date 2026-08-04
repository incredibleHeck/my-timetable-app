import { useState } from "react";
import { AppData, ActivityType } from "../../../types";
import { Subject } from "../types";
import { generateId } from "../../../utils/utils";
import { COLOR_PALETTE } from "../../../utils/constants";
import { resolveSubjectIsCore } from "../../generator/scheduler/logic/subject-core";

type AddActivity = (type: ActivityType, message: string, dataToUpdate?: AppData) => void;

/**
 * Owns the add/edit subject modal state and persistence. Extracted from
 * SubjectsView so the view stays presentational; behaviour is unchanged.
 */
export const useSubjectForm = (data: AppData, addActivity: AddActivity) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0].hex);
  const [isSingleResource, setIsSingleResource] = useState(false);
  const [isExaminable, setIsExaminable] = useState(true);
  const [isCore, setIsCore] = useState(false);
  const [requiredRoomId, setRequiredRoomId] = useState<string | null>(null);

  const openModal = (subj?: Subject) => {
    setEditingSubject(subj || null);
    setName(subj?.name || "");
    const usedColors = data.subjects.filter((s) => s.id !== subj?.id).map((s) => s.color);
    const defaultHex =
      COLOR_PALETTE.find((c) => !usedColors.includes(c.hex))?.hex || COLOR_PALETTE[0].hex;
    setColor(subj?.color || defaultHex);
    setIsSingleResource(subj?.isSingleResource || false);
    setIsExaminable(subj?.isExaminable !== undefined ? subj.isExaminable : true);
    // Show what the scheduler will actually do, not just what was saved.
    //
    // `isCore` is often unset, and the solver then infers it from the subject's
    // name — so English, Mathematics and Science were being given morning
    // priority while this box sat unticked. Worse, `save` always writes the box's
    // value, so editing a subject's colour silently demoted it. Seeding from the
    // resolved value makes the box honest and the inference editable: untick it
    // and `false` is stored explicitly, which the resolver then respects.
    setIsCore(resolveSubjectIsCore(subj));
    setRequiredRoomId(subj?.requiredRoomId || null);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const save = () => {
    if (!name) return;
    const newSubj: Subject = {
      id: editingSubject ? editingSubject.id : generateId(),
      name,
      color,
      isSingleResource,
      isExaminable,
      isCore,
      requiredRoomId: requiredRoomId || undefined,
    };

    let newSubjects = [...data.subjects];
    const msg = editingSubject
      ? `Updated Subject: ${newSubj.name}`
      : `Added Subject: ${newSubj.name}`;
    if (editingSubject) {
      newSubjects = newSubjects.map((s) => (s.id === editingSubject.id ? newSubj : s));
    } else {
      newSubjects.push(newSubj);
    }
    addActivity("ACADEMIC", msg, { ...data, subjects: newSubjects });
    setModalOpen(false);
  };

  return {
    modalOpen,
    editingSubject,
    name,
    setName,
    color,
    setColor,
    isSingleResource,
    setIsSingleResource,
    isExaminable,
    setIsExaminable,
    isCore,
    setIsCore,
    requiredRoomId,
    setRequiredRoomId,
    openModal,
    closeModal,
    save,
  };
};

export type SubjectFormState = ReturnType<typeof useSubjectForm>;
