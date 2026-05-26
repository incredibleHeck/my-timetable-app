import { AppData, PeriodConfig } from "../types";
import { generateId } from "./utils";
import { generateDefaultTimeSlots } from "./timeUtils";

// --- PRO COLOR PALETTE (Hex + Name) ---
// Used by SubjectsView for tooltips
export const COLOR_PALETTE = [
  // --- REDS (4) ---
  { hex: "#ef4444", name: "Bright Red" },
  { hex: "#7f1d1d", name: "Deep Maroon" },
  { hex: "#dc143c", name: "Crimson" },
  { hex: "#fa8072", name: "Salmon" },

  // --- PINKS (4) ---
  { hex: "#ec4899", name: "Hot Pink" },
  { hex: "#fbcfe8", name: "Pastel Pink" },
  { hex: "#be185d", name: "Magenta" },
  { hex: "#da70d6", name: "Orchid" }, // Distinct Purple-Pink

  // --- ORANGES (4) ---
  { hex: "#f97316", name: "Bright Orange" },
  { hex: "#c2410c", name: "Rust" },
  { hex: "#fdba74", name: "Peach" },
  { hex: "#ff7f50", name: "Coral" },

  // --- YELLOWS (3) ---
  { hex: "#facc15", name: "Lemon Yellow" },
  { hex: "#ca8a04", name: "Mustard" },
  { hex: "#ffd700", name: "Gold" },

  // --- GREENS (5) ---
  { hex: "#22c55e", name: "True Green" },
  { hex: "#84cc16", name: "Lime" },
  { hex: "#14532d", name: "Forest Green" },
  { hex: "#556b2f", name: "Olive" },
  { hex: "#00ff7f", name: "Spring Green" }, // High-Vis Neon

  // --- TEALS & CYANS (5) ---
  { hex: "#06b6d4", name: "Cyan" },
  { hex: "#115e59", name: "Deep Teal" },
  { hex: "#2dd4bf", name: "Aquamarine" },
  { hex: "#5f9ea0", name: "Cadet Blue" }, // Grayish Teal
  { hex: "#40e0d0", name: "Turquoise" },

  // --- BLUES (5) ---
  { hex: "#2563eb", name: "Royal Blue" },
  { hex: "#0ea5e9", name: "Sky Blue" },
  { hex: "#1e3a8a", name: "Navy" },
  { hex: "#4682b4", name: "Steel Blue" }, // Gray-Blue
  { hex: "#818cf8", name: "Periwinkle" }, // Soft Indigo-Blue

  // --- PURPLES (5) ---
  { hex: "#8b5cf6", name: "Violet" },
  { hex: "#581c87", name: "Deep Indigo" },
  { hex: "#d8b4fe", name: "Lavender" },
  { hex: "#a21caf", name: "Plum" },
  { hex: "#d946ef", name: "Fuchsia" }, // Neon Purple

  // --- BROWNS (4) ---
  { hex: "#451a03", name: "Chocolate" },
  { hex: "#854d0e", name: "Bronze" },
  { hex: "#d2b48c", name: "Tan" },
  { hex: "#a0522d", name: "Sienna" },

  // --- GRAYS (4) ---
  { hex: "#94a3b8", name: "Silver" },
  { hex: "#475569", name: "Slate" },
  { hex: "#1c1917", name: "Charcoal" },
  { hex: "#d1d5db", name: "Light Gray" },

  // --- DISTINCT ACCENTS (5) ---
  { hex: "#6ee7b7", name: "Mint" }, // Soft Green
  { hex: "#808000", name: "Army Green" }, // Brown-Green
  { hex: "#93c5fd", name: "Baby Blue" }, // Very Light Blue
  { hex: "#fb923c", name: "Apricot" }, // Soft Orange
  { hex: "#0891b2", name: "Ocean" }, // Rich Blue-Green
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
    timeSlots: generateDefaultTimeSlots(DEFAULT_STRUCTURE),
    maxConsecutivePeriods: 4,

    // Automation Defaults
    schoolStartTime: "08:00",
    defaultClassDuration: 50,
    defaultBreakDuration: 20,
    defaultLunchDuration: 60,
    maxSubjectPeriodsPerDay: 2,
    maxTeacherPeriodsPerDay: 6,
  },
  subjects: [],
  teachers: [],
  rooms: [],
  classes: [],
  jointClasses: [],
  electives: [],
  exams: [],
  dutyLocations: [],
  dutyAssignments: [],
  dutyRosters: [], // ADDED
  schedule: {},
  conflicts: [],
  lastGenerated: null,
  recentActivity: [],
};


