import { AppData, PeriodConfig, PeriodType } from "../../../../types";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  isSwap?: boolean;
  severity?: "HIGH" | "MEDIUM" | "LOW";
};

export interface ValidationContext {
  data: AppData;
  targetDay: number;
  targetPeriod: number;
  teacherId: string;
  classId: string;
  subjectId: string;
  roomId?: string;
  duration: number;
  // Computed helpers
  maxPeriods: number;
  structure: (PeriodConfig | PeriodType)[];
  classSchedule: any[]; // The specific schedule for the target class
  allClassSchedules: Map<string, any[]>; // For overlap checking
}
