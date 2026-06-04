import { useState, useMemo, useEffect } from "react";
import { AppData, ExamRoster } from "../../../types";
import { generateId } from "../../../utils/utils";

export const useExamRosters = (data: AppData, onUpdate: (newData: AppData) => void) => {
  const [activeRosterId, setActiveRosterId] = useState<string | null>(null);

  useEffect(() => {
    let updated = false;
    let rosters = [...(data.examRosters || [])];

    if (data.exams?.length > 0 && rosters.length === 0) {
      const legacyRoster: ExamRoster = {
        id: generateId(),
        name: "Imported Timetable",
        exams: data.exams,
        createdAt: new Date().toISOString(),
      };
      rosters = [legacyRoster];
      updated = true;
    }

    if (rosters.length === 0) {
      const defaultRoster: ExamRoster = {
        id: generateId(),
        name: "Standard Timetable",
        exams: [],
        createdAt: new Date().toISOString(),
      };
      rosters = [defaultRoster];
      updated = true;
    }

    if (updated) {
      onUpdate({
        ...data,
        examRosters: rosters,
        exams: [],
      });
    }

    if (!activeRosterId && rosters.length > 0) {
      setActiveRosterId(rosters[0].id);
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
