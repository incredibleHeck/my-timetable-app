import { ScheduleResult } from "../../../types";

export interface AllocationUnit {
  id: string;
  subjectId: string;
  subjectName: string;
  duration: number; // 1 (Single) or 2 (Double)

  // Who is involved?
  classIds: string[];
  classNames: string[];
  teacherIds: string[];
  teacherNames: string[];

  // Constraints
  electiveBlockId?: string;
  preferredRoomIds?: string[];
  requiredRoomType?: string;

  // Smart Priority Score
  priority: number;
}

export interface SchedulerState {
  schedule: ScheduleResult;
  // [teacherId][day][period] -> boolean
  teacherOccupancy: Record<string, boolean[][]>;
  // [classId][day][period] -> boolean
  classOccupancy: Record<string, boolean[][]>;
  // [classId][day] -> Set<subjectId>
  classDailySubjects: Record<string, Record<number, Set<string>>>;

  // ADDED: Track usage of single-resource subjects
  // [subjectId][day][period] -> boolean (Is this subject already scheduled anywhere?)
  singleResourceUsage: Record<string, boolean[][]>;

  // ADDED: Track room usage
  // [roomId][day][period] -> boolean
  roomOccupancy: Record<string, boolean[][]>;
}
