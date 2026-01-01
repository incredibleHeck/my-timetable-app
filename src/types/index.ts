// ----------------------------------------------------------------------
// 1. BASIC CONFIGURATION & TIME
// ----------------------------------------------------------------------

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
}

// ----------------------------------------------------------------------
// 2. RESOURCES (SUBJECTS & TEACHERS)
// ----------------------------------------------------------------------

export interface Subject {
  id: string;
  name: string;
  color: string;
  // If true, this subject can only happen once globally per period
  isSingleResource?: boolean;
}

export interface Teacher {
  id: string;
  name: string;
  specialtyIds: string[];
  constraints: boolean[][]; // [day][period] true=blocked
}

// ----------------------------------------------------------------------
// 3. CLASSES, CURRICULUM & GROUPINGS
// ----------------------------------------------------------------------

export interface CurriculumItem {
  id: string;
  subjectId: string;
  periodsPerWeek: number;
  singles: number;
  doubles: number;
  assignedTeacherId?: string;
}

export interface ClassGroup {
  id: string;
  name: string;
  level?: string;
  curriculum: CurriculumItem[];

  // Custom Structure Overrides (Optional)
  periodCount?: number;
  structure?: (PeriodType | PeriodConfig)[];
  duration?: number;

  // Class-Specific Reservations
  fixedSessions?: FixedOccasion[][];
}

// Alias for compatibility if code imports "Class" instead of "ClassGroup"
export type Class = ClassGroup;

// Joint Classes (e.g. "Senior Math" combines Class 12A and 12B)
export interface JointClass {
  id: string;
  name: string;
  subjectId: string;
  classIds: string[];
}

// Elective Blocks (e.g., Elective Options)
export interface ElectiveBlock {
  id: string;
  name: string; // e.g. "Arts Option Block"
  classId: string;
  subjectIds: string[]; // e.g. [Art_ID, Music_ID, Drama_ID]
}

// ----------------------------------------------------------------------
// 4. SCHEDULING RESULTS
// ----------------------------------------------------------------------

export interface ScheduleSlot {
  subjectId: string;
  teacherId: string;
  classId: string;

  isFixed?: boolean; // If true, this slot is the 2nd half of a double period
  locked?: boolean; // ADDED: For the Drag & Drop Lock feature
}

// Map: ClassID -> DayIndex -> PeriodIndex -> Slot
export type ScheduleResult = Record<
  string,
  Record<number, Record<number, ScheduleSlot>>
>;

export interface Conflict {
  classId: string;
  className: string;
  subjectId?: string; // Made optional to be safe
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  day: number;
  period: number;
  duration?: number;
  reason: string;
  severity?: "HIGH" | "MEDIUM" | "LOW";
}

// ----------------------------------------------------------------------
// 5. GLOBAL APP STATE
// ----------------------------------------------------------------------

export interface AppData {
  settings: Settings;
  subjects: Subject[];
  teachers: Teacher[];
  classes: ClassGroup[];
  jointClasses: JointClass[];
  electives: ElectiveBlock[];
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
  | "CLASSES"
  | "WORKLOAD"
  | "GENERATOR";
