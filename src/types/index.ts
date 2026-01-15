// ----------------------------------------------------------------------
// 1. BASIC CONFIGURATION & TIME
// ----------------------------------------------------------------------

import { Teacher } from "../features/teachers/types";
import { Subject } from "../features/subjects/types";
import { Room } from "../features/rooms/types";
import { ClassGroup, JointClass, ElectiveBlock, CurriculumItem, Class } from "../features/classes/types";
import { ExamSession, ExamRoster } from "../features/exams/types";
import { DutyLocation, DutyAssignment, DutyRoster } from "../features/duty/types";
import { ScheduleResult, Conflict, ScheduleSlot } from "../features/generator/types";

// Re-exports for convenience and to avoid breaking existing imports
export type { Teacher };
export type { Subject };
export type { Room };
export type { ClassGroup, JointClass, ElectiveBlock, CurriculumItem, Class };
export type { ExamSession, ExamRoster };
export type { DutyLocation, DutyAssignment, DutyRoster };
export type { ScheduleResult, Conflict, ScheduleSlot };

export type PeriodType = "CLASS" | "BREAK" | "LUNCH" | "ASSEMBLY";

export interface PeriodConfig {
  type: PeriodType;
  label: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

// Helper type for Fixed Events (can be simple boolean, string name, or object)
export type FixedOccasion =
  | string
  | boolean
  | { name: string; color?: string }
  | null;

export interface Settings {
  // Core Structure
  periodsPerDay: number;
  dayStructure: PeriodConfig[];

  // Updated to allow objects (fixes the "Property name does not exist" error)
  fixedOccasions: FixedOccasion[][]; // [day][period]

  // School Identity
  schoolName?: string;
  academicYear?: string;

  // Timing & Automation
  timeSlots: TimeSlot[];
  maxConsecutivePeriods: number;
  schoolStartTime?: string;
  defaultClassDuration?: number;
  defaultBreakDuration?: number;
  defaultLunchDuration?: number;
  maxSubjectPeriodsPerDay?: number;
  maxTeacherPeriodsPerDay?: number;
}

// ----------------------------------------------------------------------
// 6. GLOBAL APP STATE
// ----------------------------------------------------------------------

export interface AppData {
  settings: Settings;
  subjects: Subject[];
  teachers: Teacher[];
  rooms: Room[]; // NEW: Room Management
  classes: ClassGroup[];
  jointClasses: JointClass[];
  electives: ElectiveBlock[];
  exams: ExamSession[]; // NEW
  examRosters?: ExamRoster[]; // NEW: Support for multiple exam rosters
  dutyLocations: DutyLocation[]; // NEW
  dutyAssignments: DutyAssignment[]; // LEGACY - to be migrated
  dutyRosters?: DutyRoster[]; // NEW: Support for multiple rosters
  schedule: ScheduleResult;
  conflicts: Conflict[];
  lastGenerated: string | null;
}

export interface Profile {
  id: string;
  name: string;
  data: AppData;
  createdAt?: string;
}

export type ViewState =
  | "DASHBOARD"
  | "CONFIG"
  | "SUBJECTS"
  | "TEACHERS"
  | "ROOMS"
  | "CLASSES"
  | "WORKLOAD"
  | "GENERATOR"
  | "EXAMS"
  | "DUTY";