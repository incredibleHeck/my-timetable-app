import { AppData } from "../../types";

export const sanitizeAppData = (raw: any): AppData => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid data: Not an object.");
  }

  if (!raw.settings) {
    throw new Error("Invalid data: Missing 'settings'.");
  }

  return {
    settings: raw.settings,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    teachers: Array.isArray(raw.teachers) ? raw.teachers : [],
    rooms: Array.isArray(raw.rooms) ? raw.rooms : [],
    classes: Array.isArray(raw.classes) ? raw.classes : [],
    jointClasses: Array.isArray(raw.jointClasses) ? raw.jointClasses : [],
    electives: Array.isArray(raw.electives) ? raw.electives : [],
    exams: Array.isArray(raw.exams) ? raw.exams : [],
    dutyLocations: Array.isArray(raw.dutyLocations) ? raw.dutyLocations : [],
    dutyAssignments: Array.isArray(raw.dutyAssignments)
      ? raw.dutyAssignments
      : [],
    schedule:
      typeof raw.schedule === "object" && raw.schedule ? raw.schedule : {},
    conflicts: Array.isArray(raw.conflicts) ? raw.conflicts : [],
    recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
    lastGenerated: raw.lastGenerated || null,
  };
};
