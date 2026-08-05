import { useState, useEffect } from "react";
import { AppData, PeriodType, FixedOccasion } from "../../../types";
import { ClassGroup, CurriculumItem } from "../types";
import { generateId } from "../../../utils/utils";

interface UseClassFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingClass: ClassGroup | null;
  data: AppData;
  onSave: (cls: ClassGroup, original: ClassGroup | null) => void;
}

export const useClassForm = ({
  isOpen,
  onClose,
  editingClass,
  data,
  onSave,
}: UseClassFormProps) => {
  const [cName, setCName] = useState("");
  const [cDefaultRoomId, setCDefaultRoomId] = useState<string | null>(null);
  const [cDuration, setCDuration] = useState(50);
  const [cBreakDuration, setCBreakDuration] = useState(20);
  const [cLunchDuration, setCLunchDuration] = useState(60);
  const [cPeriodCount, setCPeriodCount] = useState(data.settings.periodsPerDay);
  const [cStructure, setCStructure] = useState<PeriodType[]>([]);
  const [cCurriculum, setCCurriculum] = useState<CurriculumItem[]>([]);

  // New State for Class-Specific Reservations
  const [cFixedSessions, setCFixedSessions] = useState<FixedOccasion[][]>([]);
  const [activeSlot, setActiveSlot] = useState<{ d: number; p: number } | null>(null);
  const [slotLabel, setSlotLabel] = useState("");

  const [modalSubTab, setModalSubTab] = useState<"BASICS" | "STRUCTURE">("BASICS");

  // Hydrate state when modal opens or editingClass changes
  useEffect(() => {
    if (isOpen) {
      setCName(editingClass?.name || "");
      setCDefaultRoomId(editingClass?.defaultRoomId || editingClass?.classroomId || null);
      setCDuration(editingClass?.duration || data.settings.defaultClassDuration || 50);
      setCBreakDuration(editingClass?.breakDuration || data.settings.defaultBreakDuration || 20);
      setCLunchDuration(editingClass?.lunchDuration || data.settings.defaultLunchDuration || 60);
      const targetCount = editingClass?.periodCount || data.settings.periodsPerDay;
      setCPeriodCount(targetCount);

      // 1. Structure Logic
      const defaultStruct = data.settings.dayStructure.map((s) => s.type || "CLASS");
      let initialStruct =
        editingClass?.structure && editingClass.structure.length > 0
          ? editingClass.structure.map((s) => (typeof s === "object" ? s.type : s) || "CLASS")
          : [...defaultStruct];

      // Resize Structure
      if (initialStruct.length < targetCount) {
        const diff = targetCount - initialStruct.length;
        initialStruct = [...initialStruct, ...Array(diff).fill("CLASS")];
      } else if (initialStruct.length > targetCount) {
        initialStruct = initialStruct.slice(0, targetCount);
      }
      setCStructure(initialStruct);

      // 2. Fixed Sessions Logic
      const initialFixed = Array(5)
        .fill(null)
        .map(() => Array(targetCount).fill(null));

      if (editingClass?.fixedSessions) {
        editingClass.fixedSessions.forEach((row, d) => {
          if (d < 5) {
            row.forEach((val, p) => {
              if (p < targetCount) initialFixed[d][p] = val;
            });
          }
        });
      }
      setCFixedSessions(initialFixed);

      // 3. Curriculum Logic
      const existingCurr = editingClass?.curriculum || [];
      const fullCurr = [...data.subjects]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
        .map((subj) => {
          const existing = existingCurr.find((c) => c.subjectId === subj.id);
          return existing
            ? { ...existing }
            : {
                id: generateId(),
                subjectId: subj.id,
                periodsPerWeek: 0,
                doubles: 0,
                singles: 0,
                assignedTeacherId: undefined,
                isWorkloadExempt: false,
              };
        });
      setCCurriculum(fullCurr as CurriculumItem[]);
      setModalSubTab("BASICS");
    }
  }, [isOpen, editingClass, data.settings, data.subjects]);

  const handlePeriodCountChange = (val: number) => {
    setCPeriodCount(val);

    // Resize Structure
    if (val > cStructure.length) {
      setCStructure([...cStructure, ...Array(val - cStructure.length).fill("CLASS")]);
    } else {
      setCStructure(cStructure.slice(0, val));
    }

    // Resize Fixed Sessions
    const newFixed = cFixedSessions.map((row) => {
      if (val > row.length) return [...row, ...Array(val - row.length).fill(null)];
      return row.slice(0, val);
    });
    setCFixedSessions(newFixed);
  };

  const saveSlotLabel = () => {
    if (!activeSlot) return;
    const copy = [...cFixedSessions];
    if (!copy[activeSlot.d]) copy[activeSlot.d] = [];

    copy[activeSlot.d][activeSlot.p] = slotLabel || null;
    setCFixedSessions(copy);
    setActiveSlot(null);
    setSlotLabel("");
  };

  const handleSave = () => {
    if (!cName) return;
    const activeCurriculum = cCurriculum.filter((c) => c.periodsPerWeek > 0);

    const finalStructure = cStructure.map((type, i) => {
      const globalLabel = data.settings.dayStructure[i]?.label;
      const globalType = data.settings.dayStructure[i]?.type;

      let label = globalLabel || `${i + 1}`;
      if (type !== globalType) {
        if (type === "BREAK") label = "Break";
        else if (type === "LUNCH") label = "Lunch";
        else label = `${i + 1}`;
      }

      return { type, label };
    });

    // Spread the existing class first. This form owns eight fields, but a
    // ClassGroup also carries `level` and `studentCount` — neither of which is
    // editable anywhere in the UI, and both of which are read by the scheduler
    // (room capacity checks) and the exam generator (year grouping). Rebuilding
    // the record from form state alone discarded them on every edit.
    const newClass: ClassGroup = {
      ...editingClass,
      id: editingClass ? editingClass.id : generateId(),
      name: cName,
      defaultRoomId: cDefaultRoomId || "",
      periodCount: cPeriodCount,
      duration: cDuration,
      breakDuration: cBreakDuration,
      lunchDuration: cLunchDuration,
      structure: finalStructure,
      fixedSessions: cFixedSessions,
      curriculum: activeCurriculum,
    };
    onSave(newClass, editingClass);
    onClose();
  };

  return {
    cName,
    setCName,
    cDefaultRoomId,
    setCDefaultRoomId,
    cDuration,
    setCDuration,
    cBreakDuration,
    setCBreakDuration,
    cLunchDuration,
    setCLunchDuration,
    cPeriodCount,
    setCPeriodCount,
    cStructure,
    setCStructure,
    cCurriculum,
    setCCurriculum,
    cFixedSessions,
    setCFixedSessions,
    activeSlot,
    setActiveSlot,
    slotLabel,
    setSlotLabel,
    modalSubTab,
    setModalSubTab,
    handlePeriodCountChange,
    saveSlotLabel,
    handleSave,
  };
};
