import { useState, useMemo } from "react";
import { AppData, ViewState } from "../../../types";
import { FileService } from "../../../services/fileSystem";
import { useWorkloadStats } from "../../workload/hooks/useWorkloadStats";
import { useToast } from "../../../components/ui/Toast";

export const useDashboard = (data: AppData, onUpdate: (d: AppData) => void) => {
  const { showToast } = useToast();
  const { workloadStats } = useWorkloadStats(data);

  // --- STATE ---
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  // --- 1. METRICS ---
  const metrics = useMemo(() => {
    const teacherCount = data.teachers.length;
    const classCount = data.classes.length;
    const subjectCount = data.subjects.length;

    const overloadedCount = workloadStats.filter((s) => s.utilizationPct > 100).length;
    const avgUtilization =
      workloadStats.length > 0
        ? Math.round(
            workloadStats.reduce((acc, s) => acc + s.utilizationPct, 0) / workloadStats.length,
          )
        : 0;

    let totalSlots = 0;
    let filledSlots = 0;

    data.classes.forEach((cls) => {
      const pCount = cls.periodCount || data.settings.periodsPerDay;
      const structure =
        cls.structure && cls.structure.length > 0 ? cls.structure : data.settings.dayStructure;

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
    const saturation = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

    return {
      teacherCount,
      classCount,
      subjectCount,
      saturation,
      filledSlots,
      overloadedCount,
      avgUtilization,
    };
  }, [data, workloadStats]);

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
      const message = `Class ${names.join(", ")} ${
        emptyClasses.length > 3 ? `and ${emptyClasses.length - 3} more ` : ""
      } ${emptyClasses.length === 1 ? "has" : "have"} no curriculum.`;

      issues.push({
        type: "error",
        message,
        action: "Fix",
        view: "CLASSES",
      });
    }

    // 2. Unused teachers (using de-duplicated stats)
    const unusedTeachers = workloadStats.filter((s) => s.assignedPeriods === 0);

    if (unusedTeachers.length > 0 && data.classes.length > 0) {
      const names = unusedTeachers.slice(0, 3).map((s) => s.t.name);
      const moreText = unusedTeachers.length > 3 ? ` and ${unusedTeachers.length - 3} more` : "";
      const verb = unusedTeachers.length === 1 ? "is" : "are";
      const message = `Teacher ${names.join(", ")}${moreText} ${verb} currently unassigned.`;

      issues.push({
        type: "warning",
        message,
        action: "Assign",
        view: "CLASSES",
      });
    }

    // 3. Overloaded teachers
    const overloaded = workloadStats.filter((s) => s.utilizationPct > 100);
    if (overloaded.length > 0) {
      issues.push({
        type: "error",
        message: `${overloaded.length} teachers are overloaded (>100% utilization).`,
        action: "Review",
        view: "WORKLOAD",
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
  }, [data.classes, data.subjects, data.conflicts, workloadStats]);

  // --- 3. FILE SYSTEM LOGIC ---
  const handleExportBackup = async () => {
    await FileService.saveProject(data, "timetable_backup");
  };

  const handleImportBackup = async (file: File) => {
    try {
      const newData = await FileService.parseJsonFile(file);
      onUpdate(newData); // Updates the entire app state
      showToast("Backup restored successfully!", "success");
      return true;
    } catch (error) {
      console.error(error);
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to load backup: ${errMsg}`, "error");
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
    metrics,
    healthIssues,
    // File System
    handleExportBackup,
    handleImportBackup,
  };
};
