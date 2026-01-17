import { ScheduleResult, TimeSlot } from "../../../types";

export interface AllocationUnit {
  id: string;
  subjectId: string;
  subjectName: string;
  duration: number; // 1 or 2

  // JOINT CLASS ARCHITECTURE:
  // One unit contains ALL classIds involved in the lesson.
  // This ensures they are scheduled simultaneously in the solver.
  classIds: string[];
  classNames: string[];

  teacherIds: string[];
  teacherNames: string[];

  // Grouping Identifiers (Gang Scheduling)
  electiveBlockId?: string;
  jointClassId?: string; // Used by Validator to allow room overlaps for partners

  // Resource Constraints
  preferredRoomIds?: string[];
  requiredRoomType?: string; // Critical for Room Scarcity Heuristic (e.g. "Computer Lab")

  /** The ID of the classroom assigned to the class(es) (Homeroom) */
  defaultRoomId?: string;

  // Heuristic Metadata
  priority: number; // Calculated by MRV (Higher = Schedule First)
  bumpedCount?: number; // Track how often this unit failed (for future backtracking)
}

export interface SchedulerState {
  schedule: ScheduleResult;

  // --- 1. HARD CONSTRAINT GRIDS (5x12 Booleans) ---
  // Fast lookups to check availability in O(1) time

  /** [teacherId][day][period] */
  teacherOccupancy: Record<string, boolean[][]>;

  /** [classId][day][period] */
  classOccupancy: Record<string, boolean[][]>;

  /** [roomId][day][period] */
  roomOccupancy: Record<string, boolean[][]>;

  /** [subjectId][day][period] - Tracks usage of abstract resources like "Science" */
  singleResourceUsage: Record<string, boolean[][]>;

  // --- 2. SOFT CONSTRAINT TRACKERS ---

  /** Used to prevent Subject stacking (e.g. 3 Maths in a row) */
  classDailySubjects: Record<string, Record<number, Set<string>>>;

  /** Used for LCV (Teacher Fatigue) logic */
  teacherDailyLoad: Record<string, Record<number, number>>;

  // --- 3. METADATA ---
  /** Cached time ranges for validation alignment */
  classTimeRanges: Map<string, TimeSlot[]>;
}
