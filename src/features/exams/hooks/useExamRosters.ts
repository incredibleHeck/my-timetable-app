import { useState, useMemo, useEffect, useRef } from "react";
import { AppData, ExamRoster } from "../../../types";
import { generateId } from "../../../utils/utils";

export const useExamRosters = (data: AppData, onUpdate: (newData: AppData) => void) => {
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);
  // Seed a starter roster once per mount. Without this guard the effect could
  // not tell "brand-new profile" from "user just deleted the last timetable",
  // so deleting the only roster silently regenerated a default and delete
  // appeared to do nothing.
  const seededRef = useRef(false);

  useEffect(() => {
    let rosters = [...(data.examRosters || [])];

    // One-time migration of a legacy flat exam list into a roster.
    if (data.exams?.length > 0 && rosters.length === 0 && !seededRef.current) {
      const legacyRoster: ExamRoster = {
        id: generateId(),
        name: "Imported Timetable",
        exams: data.exams,
        createdAt: new Date().toISOString(),
      };
      rosters = [legacyRoster];
      seededRef.current = true;
      onUpdate({ ...data, examRosters: rosters, exams: [] });
      setActiveRosterId(legacyRoster.id);
      return;
    }

    // Give a profile that has never had a roster a starting point — but only
    // once, so a deliberate delete of the last roster is respected.
    if (rosters.length === 0 && !seededRef.current) {
      const defaultRoster: ExamRoster = {
        id: generateId(),
        name: "Standard Timetable",
        exams: [],
        createdAt: new Date().toISOString(),
      };
      seededRef.current = true;
      onUpdate({ ...data, examRosters: [defaultRoster], exams: [] });
      setActiveRosterId(defaultRoster.id);
      return;
    }

    if (rosters.length > 0) {
      seededRef.current = true;
      if (!activeRosterId || !rosters.some((r) => r.id === activeRosterId)) {
        setActiveRosterId(rosters[0].id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.examRosters, data.exams]);

  const activeRoster = useMemo(() => {
    if (!data.examRosters || data.examRosters.length === 0) return null;
    return data.examRosters.find((r) => r.id === activeRosterId) || data.examRosters[0];
  }, [data.examRosters, activeRosterId]);

  const activeData = useMemo(() => {
    return { ...data, exams: activeRoster?.exams || [] };
  }, [data, activeRoster]);

  const handleUpdateActiveRoster = (updatedActiveData: AppData) => {
    if (!activeRoster) return;
    const newRosters = data.examRosters?.map((r) =>
      r.id === activeRoster.id ? { ...r, exams: updatedActiveData.exams } : r,
    );
    onUpdate({ ...data, examRosters: newRosters, exams: [] });
  };

  const createNewRoster = () => {
    const newRoster: ExamRoster = {
      id: generateId(),
      name: `New Timetable ${data.examRosters?.length ? data.examRosters.length + 1 : 1}`,
      exams: [],
      createdAt: new Date().toISOString(),
    };
    onUpdate({ ...data, examRosters: [...(data.examRosters || []), newRoster] });
    setActiveRosterId(newRoster.id);
  };

  const deleteRoster = (id: string) => {
    if (!confirm("Are you sure you want to delete this timetable?")) return;
    const filtered = data.examRosters?.filter((r) => r.id !== id) || [];
    onUpdate({ ...data, examRosters: filtered });
    if (activeRosterId === id) {
      setActiveRosterId(filtered[0]?.id || null);
    }
  };

  const renameRoster = (name: string) => {
    if (!activeRoster) return;
    const newRosters = data.examRosters?.map((r) =>
      r.id === activeRoster.id ? { ...r, name } : r,
    );
    onUpdate({ ...data, examRosters: newRosters });
  };

  return {
    activeRosterId,
    setActiveRosterId,
    activeRoster,
    activeData,
    handleUpdateActiveRoster,
    createNewRoster,
    deleteRoster,
    renameRoster,
  };
};
