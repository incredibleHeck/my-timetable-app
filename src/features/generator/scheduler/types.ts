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

  // --- 1. HARD CONSTRAINT GRIDS (5x12 Unit IDs) ---
  // Stores the ID of the unit occupying the slot, or null if free.
  // This allows O(1) identification of "Who is blocking this?".

  /** [teacherId][day][period] -> unitId | null */
  teacherOccupancy: Record<string, (string | null)[][]>;

  /** [classId][day][period] -> unitId | null */
  classOccupancy: Record<string, (string | null)[][]>;

  /** [roomId][day][period] -> unitId | null */
  roomOccupancy: Record<string, (string | null)[][]>;

  /** [subjectId][day][period] -> unitId | null */
  singleResourceUsage: Record<string, (string | null)[][]>;

  // --- 2. SOFT CONSTRAINT TRACKERS ---

  /** Used to prevent Subject stacking (e.g. 3 Maths in a row) */
  classDailySubjects: Record<string, Record<number, Set<string>>>;

  /** Used for LCV (Teacher Fatigue) logic */
  teacherDailyLoad: Record<string, Record<number, number>>;

  /** Map unitId -> its current placement for fast retrieval and eviction */
  unitPlacements: Map<string, { d: number; p: number; p2: number; rooms: Record<string, string> }>;

  // --- 3. METADATA ---
  /** Cached time ranges for validation alignment */
  classTimeRanges: Map<string, TimeSlot[]>;
}