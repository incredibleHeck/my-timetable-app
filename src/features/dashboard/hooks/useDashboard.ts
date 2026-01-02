import { useState, useEffect, useMemo, useCallback } from "react";
import { AppData, ViewState } from "../../../types";
import { FileService } from "../../../services/fileSystem";
import { sanitizeAppData } from "../../../utils/utils";

export const useDashboard = (
  data: AppData,
  onUpdate: (d: AppData) => void,
  onProfileChange?: (name: string) => void
) => {
  // --- STATE ---
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [savedProfiles, setSavedProfiles] = useState<string[]>([]);

  // --- 1. METRICS ---
  const metrics = useMemo(() => {
    const teacherCount = data.teachers.length;
    const classCount = data.classes.length;
    const subjectCount = data.subjects.length;

    let totalSlots = 0;
    let filledSlots = 0;

    data.classes.forEach((cls) => {
      const pCount = cls.periodCount || data.settings.periodsPerDay;
      const structure =
        cls.structure && cls.structure.length > 0
          ? cls.structure
          : data.settings.dayStructure;

      for (let d = 0; d < 5; d++) {
        for (let p = 0; p < pCount; p++) {
          let pType = "CLASS";
          if (p < structure.length) {
            const item = structure[p];
            pType = typeof item === "object" ? item.type : item;
          }
          if (pType !== "CLASS") continue;

          totalSlots++;
          const hasLesson = data.schedule[cls.id]?.[d]?.[p];

          // Fix potential undefined access for optional arrays
          const hasGlobalFixed = data.settings.fixedOccasions?.[d]?.[p];
          const hasClassFixed = cls.fixedSessions?.[d]?.[p];

          if (hasLesson || hasGlobalFixed || hasClassFixed) filledSlots++;
        }
      }
    });
    const saturation =
      totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;
    return { teacherCount, classCount, subjectCount, saturation, filledSlots };
  }, [data]);

  // --- 2. HEALTH ---
  const healthIssues = useMemo(() => {
    const issues: {
      type: "error" | "warning";
      message: string;
      action: string;
      view: ViewState;
    }[] = [];

    // 1. Classes with no subjects
    const emptyClasses = data.classes.filter((c) => c.curriculum.length === 0);
    if (emptyClasses.length > 0) {
      const names = emptyClasses.slice(0, 3).map((c) => c.name);
      let message = `Class ${names.join(", ")} ${
        emptyClasses.length > 3 ? `and ${emptyClasses.length - 3} more ` : ""
      } ${emptyClasses.length === 1 ? "has" : "have"} no curriculum.`;
      
      issues.push({
        type: "error",
        message,
        action: "Fix",
        view: "CLASSES",
      });
    }

    // 2. Unused teachers
    const unusedTeachers = data.teachers.filter(
      (t) =>
        !data.classes.some((c) =>
          c.curriculum.some((curr) => curr.assignedTeacherId === t.id)
        )
    );
    if (unusedTeachers.length > 0 && data.classes.length > 0) {
      const names = unusedTeachers.slice(0, 3).map((t) => t.name);
      let message = `Teacher ${names.join(", ")} ${
        unusedTeachers.length > 3 ? `and ${unusedTeachers.length - 3} more ` : ""
      } ${unusedTeachers.length === 1 ? "is" : "are"} currently unassigned.`;

      issues.push({
        type: "warning",
        message,
        action: "Assign",
        view: "CLASSES",
      });
    }

    if (data.subjects.length === 0)
      issues.push({
        type: "error",
        message: "No subjects defined.",
        action: "Add",
        view: "SUBJECTS",
      });

    return { issues, conflicts: data.conflicts.length };
  }, [data]);

  // --- 3. LOCAL STORAGE PROFILE LOGIC ---
  const refreshProfiles = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      const profiles = keys
        .filter((k) => k.startsWith("scheduler_data_"))
        .map((k) => k.replace("scheduler_data_", ""));
      setSavedProfiles(profiles);
    } catch (e) {
      console.error("Error accessing local storage", e);
      setSavedProfiles([]);
    }
  }, []);

  // Refresh whenever modal opens
  useEffect(() => {
    if (loadModalOpen) {
      refreshProfiles();
    }
  }, [loadModalOpen, refreshProfiles]);

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    try {
      const key = `scheduler_data_${newProfileName.trim()}`;
      localStorage.setItem(key, JSON.stringify(data));
      if (onProfileChange) onProfileChange(newProfileName.trim());
      setCreateModalOpen(false);
      setNewProfileName("");
      alert(`Profile "${newProfileName}" saved to local storage!`);
    } catch (e) {
      alert("Failed to save. Storage might be full.");
    }
  };

  const handleLoadProfile = (name: string) => {
    try {
      const key = `scheduler_data_${name}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const loadedData = sanitizeAppData(JSON.parse(saved));
        onUpdate(loadedData); // VITAL: Updates App State
        if (onProfileChange) onProfileChange(name);
        setLoadModalOpen(false);
      } else {
        alert("Profile not found.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load profile. Data corrupted.");
    }
  };

  const handleDeleteProfile = (name: string) => {
    if (confirm(`Delete "${name}" from local storage?`)) {
      localStorage.removeItem(`scheduler_data_${name}`);
      refreshProfiles();
    }
  };

  // --- 4. FILE SYSTEM LOGIC (NEW) ---
  const handleExportBackup = async () => {
    await FileService.saveProject(data, "timetable_backup");
  };

  const handleImportBackup = async (file: File) => {
    try {
      const newData = await FileService.parseJsonFile(file);
      onUpdate(newData); // Updates the entire app state
      alert("Backup restored successfully!");
      return true;
    } catch (error: any) {
      console.error(error);
      alert(`Failed to load backup: ${error.message || "Unknown error"}`);
      return false;
    }
  };

  return {
    createModalOpen,
    setCreateModalOpen,
    loadModalOpen,
    setLoadModalOpen,
    newProfileName,
    setNewProfileName,
    savedProfiles,
    metrics,
    healthIssues,
    // Local Storage
    handleCreateProfile,
    handleLoadProfile,
    handleDeleteProfile,
    // File System
    handleExportBackup,
    handleImportBackup,
  };
};
