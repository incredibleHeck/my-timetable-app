import { ScheduleResult, TimeSlot } from "../../../../types";

/**
 * OPTIMIZED ALLOCATION UNIT
 * Represents a group of lessons (Joint or Standard) to be scheduled together.
 */
export interface AllocationUnit {
  id: string;
  subjectId: string;
  classIds: string[];
  teacherIds: string[];
  duration: number; // 1 or 2
  
  // ARCHITECT: New Fields for O(1) Logic
  isCore?: boolean;       // Pre-calculated boolean (No string parsing in loops)
  priority: number;       // Pre-calculated MRV Score (Tournament selection)
  rankLevel: number;      // RANK 2: Structural Hierarchy (Higher grade priority)
  
  // Metadata & Grouping
  jointClassId?: string;
  electiveBlockId?: string;
  classNames: string[];
  subjectName: string;
  teacherNames: string[];
  
  // Resource Constraints
  defaultRoomId?: string;
  preferredRoomIds?: string[];
  requiredRoomType?: string; // e.g. "Computer Lab"
  
  bumpedCount?: number; // Track failures for future backtracking logic
}

/**
 * SCHEDULE ENTRY
 * The atomic unit stored in the finalized schedule grid.
 */
export interface ScheduleEntry {
  unitId: string; // Link back to the AllocationUnit
  subjectId: string;
  teacherId: string;
  classId: string;
  roomId?: string;
  isFixed: boolean; // True for the "tail" of a double period
  duration: number; // 1 or 2
  isCore?: boolean;
}

/**
 * THE STATE MANAGER
 * Maintains O(1) grids and trackers for high-speed constraint satisfaction.
 */
export interface SchedulerState {
  // The Schedule: [ClassID][Day][Period] -> Entry
  schedule: Record<string, Record<number, Record<number, ScheduleEntry>>>;
  
  // --- 1. O(1) OCCUPANCY GRIDS ---
  // Stores UnitID | "BLOCK" | null
  classOccupancy: Record<string, (string | null)[][]>;
  teacherOccupancy: Record<string, (string | null)[][]>;
  roomOccupancy: Record<string, (string | null)[][]>;
  singleResourceUsage: Record<string, (string | null)[][]>;
  
  // --- 2. PERFORMANCE TRACKERS ---
  /** [teacherId][day] -> totalPeriods */
  teacherDailyLoad: Record<string, number[]>;
  
  /** [classId][day] -> set of subjectIds (Variety rule) */
  classDailySubjects: Record<string, Record<number, Set<string>>>;
  
  /** 
   * ARCHITECT: The Performance Secret (Curriculum Tracker)
   * [classId][subjectId] -> Total Periods Scheduled
   */
  classSubjectDuration: Record<string, Record<string, number>>; 

  // --- 3. HELPERS & METADATA ---
  /** unitId -> Current coordinates and room assignments */
  unitPlacements: Map<string, { d: number; p: number; p2: number; rooms: Record<string, string> }>;
  
  /** Pre-calculated time slots for overlap checking */
  classTimeRanges: Map<string, TimeSlot[]>;
  
  /** Pre-calculated map to skip breaks/lunch efficiently */
  lessonNavigation: Map<string, number[]>;
  
  /** Global settings reference */
  settings: any;
}