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
// 2. RESOURCES (SUBJECTS, TEACHERS & ROOMS)
// ----------------------------------------------------------------------

export interface Room {
  id: string;
  name: string;
  capacity: number;
  type: string; // e.g. "Lab", "Classroom", "Gym"
}

export interface Subject {
  id: string;
  name: string;
  color: string;
  // If true, this subject can only happen once globally per period
  isSingleResource?: boolean;
  isExaminable?: boolean; // NEW: If true, this subject is included in exam generation by default
  // Room requirements
  preferredRoomIds?: string[]; // Specific rooms
  requiredRoomType?: string; // e.g. "Lab"

  // NEW: Exam Configuration Defaults
  examPaperCount?: number; // Default 1 if undefined
  examPaperDurations?: number[]; // e.g. [120, 90] for Paper 1 & 2
}

export interface Teacher {
  id: string;
  name: string;
  specialtyIds: string[];
  constraints: boolean[][]; // [day][period] true=blocked
  targetLoad?: number; // Desired periods per week
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
  // Forced simultaneous scheduling
  allowedPeriods?: { day: number; period: number }[];
}

// ----------------------------------------------------------------------
// 4. SCHEDULING RESULTS
// ----------------------------------------------------------------------

export interface ScheduleSlot {
  subjectId: string;
  teacherId: string;
  classId: string;
  roomId?: string; // Assigned Room

  isFixed?: boolean; // If true, this slot is the 2nd half of a double period
  locked?: boolean; // ADDED: For the Drag & Drop Lock feature
  electiveBlockId?: string; // ADDED: Represents an Elective Block
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
// 5. EXAMS & DUTIES (NEW)
// ----------------------------------------------------------------------

export type ExamStatus = "DRAFT" | "PUBLISHED" | "COMPLETED";

export interface ExamSession {
  id: string;
  subjectId: string;
  classIds: string[];

  // Scheduling
  date: string; // ISO Date YYYY-MM-DD
  startTime: string; // e.g. "09:00"
  duration: number; // minutes

  // Resources
  // Room is now optional to allow "Curriculum First" creation, then "Room Allocation" later
  roomId?: string;
  invigilatorIds?: string[]; // CHANGED: Support for multiple teachers per session

  // Multi-Paper Support
  paperNumber: number; // 1, 2, 3...
  paperLabel?: string; // e.g. "Paper 1 (Theory)"

  // State
  status: ExamStatus;
  locked?: boolean; // If true, Auto-Scheduler ignores this
}

export interface DutyLocation {
  id: string;
  name: string;
}

export interface DutyAssignment {
  id: string;
  locationId: string;
  teacherId: string;
  day: number;
  period: number;
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
  dutyLocations: DutyLocation[]; // NEW
  dutyAssignments: DutyAssignment[]; // NEW
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
