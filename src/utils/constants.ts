// PASTE INTO: src/utils/constants.ts

import { AppData, PeriodConfig, Profile } from "../types"; // UPDATED IMPORT
import { generateId } from "./utils";

// --- PRO COLOR PALETTE (Hex + Name) ---
// Used by SubjectsView for tooltips
export const COLOR_PALETTE = [
  // Reds & Pinks
  { hex: "#ef4444", name: "Bright Red" },
  { hex: "#b91c1c", name: "Deep Crimson" },
  { hex: "#ec4899", name: "Hot Pink" },
  { hex: "#be185d", name: "Dark Magenta" },
  { hex: "#f43f5e", name: "Rose" },
  { hex: "#9f1239", name: "Burgundy" },

  // Oranges & Browns
  { hex: "#f97316", name: "Bright Orange" },
  { hex: "#c2410c", name: "Burnt Orange" },
  { hex: "#f59e0b", name: "Amber" },
  { hex: "#b45309", name: "Bronze" },
  { hex: "#854d0e", name: "Golden Brown" },
  { hex: "#A0522D", name: "Sienna" },
  { hex: "#8B4513", name: "Saddle Brown" },

  // Yellows
  { hex: "#eab308", name: "Mustard" },
  { hex: "#ca8a04", name: "Dark Gold" },

  // Greens
  { hex: "#84cc16", name: "Lime" },
  { hex: "#4d7c0f", name: "Olive Green" },
  { hex: "#22c55e", name: "True Green" },
  { hex: "#15803d", name: "Forest Green" },
  { hex: "#10b981", name: "Emerald" },
  { hex: "#047857", name: "Deep Pine" },

  // Teals & Cyans
  { hex: "#14b8a6", name: "Teal" },
  { hex: "#0f766e", name: "Dark Teal" },
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#0e7490", name: "Cerulean" },

  // Blues
  { hex: "#0ea5e9", name: "Sky Blue" },
  { hex: "#0369a1", name: "Ocean Blue" },
  { hex: "#3b82f6", name: "Royal Blue" },
  { hex: "#1d4ed8", name: "Cobalt" },
  { hex: "#1e40af", name: "Midnight Blue" },
  { hex: "#6366f1", name: "Indigo" },
  { hex: "#4338ca", name: "Deep Indigo" },

  // Purples & Violets
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#6d28d9", name: "Deep Violet" },
  { hex: "#a855f7", name: "Purple" },
  { hex: "#7e22ce", name: "Grape" },
  { hex: "#d946ef", name: "Fuchsia" },
  { hex: "#a21caf", name: "Plum" },

  // Grays & Muted
  { hex: "#64748b", name: "Slate Gray" },
  { hex: "#334155", name: "Dark Slate" },
  { hex: "#71717a", name: "Zinc" },
  { hex: "#3f3f46", name: "Charcoal" },
  { hex: "#78716c", name: "Warm Stone" },
  { hex: "#44403c", name: "Dark Stone" },

  // Distinct Others
  { hex: "#2dd4bf", name: "Aquamarine" },
  { hex: "#fb7185", name: "Soft Coral" },
  { hex: "#a78bfa", name: "Lavender" },
  { hex: "#fbbf24", name: "Marigold" },
];

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const DEFAULT_PERIODS = 8;
export const STORAGE_KEY = "timetable_app_v1";

export const DEFAULT_STRUCTURE: PeriodConfig[] = [
  { type: "CLASS", label: "1" },
  { type: "CLASS", label: "2" },
  { type: "BREAK", label: "Recess" },
  { type: "CLASS", label: "3" },
  { type: "CLASS", label: "4" },
  { type: "LUNCH", label: "Lunch" },
  { type: "CLASS", label: "5" },
  { type: "CLASS", label: "6" },
];

const generateDefaultTimeSlots = () => {
  const slots = [];
  let currentHour = 8;
  let currentMinute = 0;

  for (const block of DEFAULT_STRUCTURE) {
    let duration = 50; // Default Class
    if (block.type === "BREAK") duration = 20;
    if (block.type === "LUNCH") duration = 60;

    const start = `${String(currentHour).padStart(2, "0")}:${String(
      currentMinute
    ).padStart(2, "0")}`;

    // Add duration
    let totalMins = currentHour * 60 + currentMinute + duration;
    currentHour = Math.floor(totalMins / 60);
    currentMinute = totalMins % 60;

    const end = `${String(currentHour).padStart(2, "0")}:${String(
      currentMinute
    ).padStart(2, "0")}`;
    slots.push({ start, end });
  }
  return slots;
};

export const DEFAULT_DATA: AppData = {
  settings: {
    periodsPerDay: DEFAULT_PERIODS,
    dayStructure: [...DEFAULT_STRUCTURE],
    fixedOccasions: Array(5)
      .fill(null)
      .map(() => Array(DEFAULT_PERIODS).fill("")),

    // Pro Defaults
    schoolName: "My Awesome School",
    academicYear: new Date().getFullYear().toString(),
    timeSlots: generateDefaultTimeSlots(),
    maxConsecutivePeriods: 4,

    // Automation Defaults
    schoolStartTime: "08:00",
    defaultClassDuration: 50,
    defaultBreakDuration: 20,
    defaultLunchDuration: 60,
  },
  subjects: [],
  teachers: [],
  classes: [],
  jointClasses: [],
  electives: [],
  schedule: {},
  conflicts: [],
  lastGenerated: null,
};

export const DEFAULT_PROFILE: Profile = {
  id: "default",
  name: "Default Profile",
  data: DEFAULT_DATA,
};
