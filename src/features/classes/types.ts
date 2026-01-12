import { FixedOccasion, PeriodType, PeriodConfig } from "../../types";

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
  studentCount?: number;
  curriculum: CurriculumItem[];

  // Custom Structure Overrides (Optional)
  periodCount?: number;
  structure?: (PeriodType | PeriodConfig)[];
  duration?: number;

  // Class-Specific Reservations
  fixedSessions?: FixedOccasion[][];
}

// Alias for compatibility
export type Class = ClassGroup;

export interface JointClass {
  id: string;
  name: string;
  subjectId: string;
  classIds: string[];
}

export interface ElectiveBlock {
  id: string;
  name: string;
  classId: string;
  subjectIds: string[];
  // Forced simultaneous scheduling
  allowedPeriods?: { day: number; period: number }[];
}
