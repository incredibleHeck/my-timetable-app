import { ScheduleResult, TimeSlot } from "../../../types";

export interface AllocationUnit {
  id: string;
  subjectId: string;
  subjectName: string;
  duration: number; // 1 or 2

  // JOINT CLASS FIX: One unit contains ALL classIds involved.
  classIds: string[];
  classNames: string[];

  teacherIds: string[];
  teacherNames: string[];

  // Room Requirements
  electiveBlockId?: string;
  jointClassId?: string; // To help Validator identify partners sharing a room

  preferredRoomIds?: string[];
  requiredRoomType?: string;

  /** The ID of the classroom assigned to the class(es) */
  defaultRoomId?: string;

  priority: number;
  bumpedCount?: number;
}

export interface SchedulerState {
  schedule: ScheduleResult;
  /** [teacherId][day][period] */
  teacherOccupancy: Record<string, boolean[][]>;
  /** [classId][day][period] */
  classOccupancy: Record<string, boolean[][]>;
  /** [roomId][day][period] */
  roomOccupancy: Record<string, boolean[][]>;

  classDailySubjects: Record<string, Record<number, Set<string>>>;

  /** Tracks ACTUAL assigned lessons (ignores blocked/worship periods) */
  teacherDailyLoad: Record<string, Record<number, number>>;

  singleResourceUsage: Record<string, boolean[][]>;
  classTimeRanges: Map<string, TimeSlot[]>;
}
