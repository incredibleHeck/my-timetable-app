import {
  ScheduleResult,
  Conflict,
  ClassGroup,
  Teacher,
  Room,
  Subject,
  TimeSlot,
} from "../../../types";

export interface AllocationUnit {
  // ... (keep existing fields)
  id: string;
  subjectId: string;
  subjectName: string;
  duration: number;
  classIds: string[];
  classNames: string[];
  teacherIds: string[];
  teacherNames: string[];
  electiveBlockId?: string;
  preferredRoomIds?: string[];
  requiredRoomType?: string;
  priority: number;
  bumpedCount?: number;
}

export interface SchedulerState {
  schedule: ScheduleResult;
  teacherOccupancy: Record<string, boolean[][]>;
  classOccupancy: Record<string, boolean[][]>;
  roomOccupancy: Record<string, boolean[][]>;
  classDailySubjects: Record<string, Record<number, Set<string>>>;
  teacherDailyLoad: Record<string, Record<number, number>>;
  singleResourceUsage: Record<string, boolean[][]>;

  // FIX: Use TimeSlot[] (strings) instead of numeric ranges
  classTimeRanges: Map<string, TimeSlot[]>;
}
