export interface ScheduleSlot {
  subjectId: string;
  teacherId: string;
  classId: string;
  roomId?: string;

  isFixed?: boolean;
  locked?: boolean;
  electiveBlockId?: string;

  /** ID of the AllocationUnit that created this slot (for Solver/Repair tracking) */
  unitId?: string;
}

export type ScheduleResult = Record<string, Record<number, Record<number, ScheduleSlot>>>;

export interface Conflict {
  classId: string;
  className: string;
  subjectId?: string;
  subjectName?: string;
  teacherId?: string;
  teacherName?: string;
  roomId?: string;
  day: number;
  period: number;
  duration?: number;
  missingPeriods?: number;
  reason: string;
  severity?: "HIGH" | "MEDIUM" | "LOW";
  /** blocking = must fix; quality = pedagogical preference (gaps, consecutive, etc.) */
  kind?: "blocking" | "quality";
}
