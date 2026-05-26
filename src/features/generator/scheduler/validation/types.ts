import { AppData, PeriodConfig, PeriodType, TimeSlot } from "../../../../types";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  isSwap?: boolean;
  severity?: "HIGH" | "MEDIUM" | "LOW";
  /** When true, violation is a quality warning (post-generate audit), not blocking. */
  qualityWarning?: boolean;
  /** 
   * Penalty points for this violation.
   * Hard constraints = 1000+ pts
   * Soft constraints (Gaps, Variety) = 10-50 pts
   */
  penaltyPoints: number; 
  /** For Min-Conflicts: How many units are blocking this slot? */
  conflictCount: number; 
};

export interface ValidationContext {
  // Core Data
  data: AppData;

  // Target of the validation
  targetDay: number;
  targetPeriod: number;
  teacherId: string;
  classId: string;
  subjectId: string;
  roomId?: string;
  duration: number;

  // Computed Context (Helpers for performance)
  maxPeriods: number;
  structure: (PeriodConfig | PeriodType)[];

  /** The calculated time ranges (start/end) for the class being validated */
  classSchedule: TimeSlot[];

  /** Map of ALL calculated class schedules for O(1) overlap checks */
  allClassSchedules: Map<string, TimeSlot[]>;

  /** Slots to ignore during validation (e.g. source of a move/swap). Format: "day-period" */
  ignoredSlots: Set<string>;
}
