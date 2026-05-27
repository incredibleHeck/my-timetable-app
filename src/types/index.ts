// ----------------------------------------------------------------------
// 1. BASIC CONFIGURATION & TIME
// ----------------------------------------------------------------------

import { Teacher } from "../features/teachers/types";
import { Subject } from "../features/subjects/types";
import { Room } from "../features/rooms/types";
import { ClassGroup, JointClass, ElectiveBlock, CurriculumItem, Class } from "../features/classes/types";
import { ExamSession, ExamRoster } from "../features/exams/types";
import { DutyLocation, DutyAssignment, DutyRoster } from "../features/duty/types";
import { ScoringWeightOverrides } from "../features/generator/scheduler/constants";

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
  daysPerWeek?: number;
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
  /** School-wide weekly cap for workload analysis (per profile) */
  maxTeachingPeriodsPerWeek?: number;
  /** Hard cap on core-subject periods per class per day (optional) */
  maxCorePeriodsPerDay?: number;
  /** Spread each subject across the week: max ceil(N/D)+1 periods per day */
  enforceSubjectDaySpread?: boolean;
  /** Override default soft scoring weights used during construction */
  scoringWeightOverrides?: ScoringWeightOverrides;
  /** Exam timetable grid: session split and default drop times */
  examGrid?: {
    sessionCutoff?: string;
    session1DefaultTime?: string;
    session2DefaultTime?: string;
  };
}

// ----------------------------------------------------------------------
// 6. GLOBAL APP STATE
// ----------------------------------------------------------------------

export type ActivityType = "SCHEDULING" | "ACADEMIC" | "SYSTEM";

export interface Activity {
  id: string;
  type: ActivityType;
  message: string;
  timestamp: string;
}

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
  dutyAssignments?: DutyAssignment[]; // LEGACY - migrated to dutyRosters
  dutyRosters?: DutyRoster[]; // NEW: Support for multiple rosters
  schedule: ScheduleResult;
  conflicts: Conflict[];
  lastGenerated: string | null;
  recentActivity: Activity[];
}

export type { Profile } from "../types/profile";

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