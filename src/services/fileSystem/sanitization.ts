import { AppData, FixedOccasion } from "../../types";

const normalizeOccasion = (val: unknown): string | null => {
  if (!val) return null;
  if (val === true) return "Reserved";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "name" in val) {
    return (val as { name: string }).name;
  }
  return null;
};

const normalizeOccasions = (grid: FixedOccasion[][] | undefined): FixedOccasion[][] => {
  if (!Array.isArray(grid)) return [];
  return grid.map((row) =>
    Array.isArray(row) ? row.map(normalizeOccasion) : []
  );
};

export const sanitizeAppData = (raw: any): AppData => {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid data: Not an object.");
  }

  if (!raw.settings) {
    throw new Error("Invalid data: Missing 'settings'.");
  }

  const settings = {
    ...raw.settings,
    fixedOccasions: normalizeOccasions(raw.settings.fixedOccasions),
  };

  const classes = Array.isArray(raw.classes)
    ? raw.classes.map((c: any) => ({
        ...c,
        ...(c.fixedSessions
          ? { fixedSessions: normalizeOccasions(c.fixedSessions) }
          : {}),
      }))
    : [];

  return {
    settings,
    subjects: Array.isArray(raw.subjects) ? raw.subjects : [],
    teachers: Array.isArray(raw.teachers) ? raw.teachers : [],
    rooms: Array.isArray(raw.rooms) ? raw.rooms : [],
    classes,
    jointClasses: Array.isArray(raw.jointClasses) ? raw.jointClasses : [],
    electives: Array.isArray(raw.electives) ? raw.electives : [],
    examRosters: Array.isArray(raw.examRosters) ? raw.examRosters : [],
    exams:
      Array.isArray(raw.examRosters) && raw.examRosters.length > 0
        ? []
        : Array.isArray(raw.exams)
          ? raw.exams
          : [],
    dutyLocations: Array.isArray(raw.dutyLocations) ? raw.dutyLocations : [],
    dutyAssignments: Array.isArray(raw.dutyAssignments)
      ? raw.dutyAssignments
      : [],
    dutyRosters: Array.isArray(raw.dutyRosters) ? raw.dutyRosters : [],
    schedule:
      typeof raw.schedule === "object" && raw.schedule ? raw.schedule : {},
    conflicts: Array.isArray(raw.conflicts) ? raw.conflicts : [],
    recentActivity: Array.isArray(raw.recentActivity) ? raw.recentActivity : [],
    lastGenerated: raw.lastGenerated || null,
  };
};
