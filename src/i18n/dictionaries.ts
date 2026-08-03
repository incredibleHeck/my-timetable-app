// Flat key -> string dictionaries. Add a new locale by exporting another
// object with the same keys and registering it in `dictionaries` below.

export const en = {
  "nav.dashboard": "Dashboard",
  "nav.configuration": "Configuration",
  "nav.teachers": "Teachers",
  "nav.rooms": "Rooms",
  "nav.subjects": "Subjects",
  "nav.classes": "Classes",
  "nav.generator": "Auto-Generator",
  "nav.workload": "Workload Analysis",
  "nav.exams": "Exam Timetable",
  "nav.duty": "Duty Roster",
  "nav.substitutes": "Cover Planner",
  "nav.newProfile": "New Profile",

  "section.general": "General",
  "section.system": "System",
  "section.academicData": "Academic Data",
  "section.scheduling": "Scheduling",
  "section.operations": "Operations",
  "section.profiles": "Profiles",

  "common.save": "Save",
  "common.saveAs": "Save As...",
  "common.saveToDevice": "Save to Device",
  "common.unsavedChanges": "Unsaved Changes",
  "common.webMode": "Web Mode",
  "common.saved": "Saved",
  "common.saving": "Saving...",
  "common.active": "Active",

  "theme.toggle": "Toggle light / dark theme",
} as const;

export type TranslationKey = keyof typeof en;

export const dictionaries: Record<string, Record<string, string>> = {
  en,
};

export type Locale = keyof typeof dictionaries;
