import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";

/**
 * ARCHITECT NOTES:
 * 1. Performance: O(1) Map-based lookups.
 * 2. Logic: Includes Joint Class "Self-Overlap" permission.
 * 3. Logic: Includes "Sandwich" Subject Continuity protection.
 */

// --- HELPERS ---

const checkConsecutiveLimit = (
  state: SchedulerState,
  d: number,
  p: number,
  p2: number,
  duration: number,
  teacherId: string,
  maxConsecutive: number
): boolean => {
  const dailyGrid = state.teacherOccupancy[teacherId]?.[d];
  if (!dailyGrid) return true;

  let runBefore = 0;
  let i = p - 1;
  while (i >= 0 && dailyGrid[i]) { runBefore++; i--; }

  let runAfter = 0;
  let j = (duration === 2 ? p2 : p) + 1;
  while (j < dailyGrid.length && dailyGrid[j]) { runAfter++; j++; }

  return (runBefore + duration + runAfter) <= maxConsecutive;
};

export const isGlobalSlotBlocked = (val: any): boolean => {
  if (!val) return false;
  if (val === true) return true; 
  if (typeof val === "string") return val.trim().length > 0;
  return typeof val === "object"; 
};

// --- CORE HARD CONSTRAINTS: RANK 1 THE INVARIANTS ---

/**
 * RANK 1: THE INVARIANTS (Rules of Engagement)
 * These are the active filters for the system. 
 * If a lesson violates any of these, it is rejected immediately.
 */
export const checkHardConstraints = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  teacherMap: Map<string, Teacher>,
  classMap: Map<string, ClassGroup>,
  subjectMap: Map<string, Subject>,
  roomMap: Map<string, Room>
): boolean => {
  const { duration, subjectId, teacherIds, classIds } = unit;

  // 1. RANK 1.1: STRUCTURAL HIERARCHY & BOUNDS
  if (!checkImmutableConstraints(d, p, p2, unit, data, teacherMap, classMap)) {
      return false;
  }

  // 2. RANK 1.2: THE TRIPLE LOCK (Availability)
  // Is the Teacher free? Is the Class free? Is the Room free?
  
  // A. Teacher Availability
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;
  const maxTeacherLoad = data.settings.maxTeacherPeriodsPerDay || 6;

  for (const tid of teacherIds) {
    const occupantP1 = state.teacherOccupancy[tid]?.[d]?.[p];
    if (occupantP1 && occupantP1 !== "BLOCK" && occupantP1 !== unit.id) return false;
    
    if (duration === 2) {
        const occupantP2 = state.teacherOccupancy[tid]?.[d]?.[p2];
        if (occupantP2 && occupantP2 !== "BLOCK" && occupantP2 !== unit.id) return false;
    }

    // RANK 1.3: TEACHER WELFARE (Fatigue Check)
    // Check BEFORE placing: Max 4 consecutive; Max 6 total.
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = teacherMap.get(tid);
    const maxLoad = teacher?.maxPeriodsPerDay ?? maxTeacherLoad;

    if (currentLoad + duration > maxLoad) return false;
    
    // Only check consecutive if they have enough lessons to matter
    if (currentLoad + duration >= 3) { 
       if (!checkConsecutiveLimit(state, d, p, p2, duration, tid, maxConsecutive)) return false;
    }
  }

  // B. Class Availability & Shape Rules
  for (const cid of classIds) {
    const occupantP1 = state.classOccupancy[cid]?.[d]?.[p];
    if (occupantP1 && occupantP1 !== unit.id) return false;
    if (duration === 2) {
        const occupantP2 = state.classOccupancy[cid]?.[d]?.[p2];
        if (occupantP2 && occupantP2 !== unit.id) return false;
    }

    // RANK 1.4: CONSTRAINT CONTINUITY (Shape Rules)
    // Daily Subject Limits: Max 2 periods of the same subject per day.
    const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;
    let count = 0;
    const daySched = state.schedule[cid]?.[d];
    if (daySched) {
        Object.values(daySched).forEach(s => {
            if (s.subjectId === subjectId) count += (s.duration || 1);
        });
    }
    if (count + duration > maxSubj) return false;
  }

  // C. Room Availability (Triple Lock Part 3)
  const subject = subjectMap.get(subjectId);
  const repClass = classMap.get(classIds[0]);
  const targetRoomId = subject?.requiredRoomId || repClass?.defaultRoomId;

  if (targetRoomId) {
    const roomOccP1 = state.roomOccupancy[targetRoomId]?.[d]?.[p];
    if (roomOccP1 && roomOccP1 !== unit.id) return false;
    
    if (duration === 2) {
        const roomOccP2 = state.roomOccupancy[targetRoomId]?.[d]?.[p2];
        if (roomOccP2 && roomOccP2 !== unit.id) return false;
    }

    const room = roomMap.get(targetRoomId);
    if (room && repClass && (repClass.studentCount || 0) > room.capacity) return false; 
  }

  // 5. SINGLE RESOURCE
  if (subject?.isSingleResource) {
    const resOccP1 = state.singleResourceUsage[subjectId]?.[d]?.[p];
    if (resOccP1 && resOccP1 !== unit.id) return false;
    if (duration === 2) {
        const resOccP2 = state.singleResourceUsage[subjectId]?.[d]?.[p2];
        if (resOccP2 && resOccP2 !== unit.id) return false;
    }
  }

  return true;
};

// --- IMMUTABLE CONSTRAINTS ---



export function checkImmutableConstraints(

    d: number, 

    p: number, 

    p2: number, 

    unit: AllocationUnit, 

    data: AppData,

    teacherMap: Map<string, Teacher>, 

    classMap: Map<string, ClassGroup>

): boolean {

      // 0. Class-Specific Period Limits (The "13th Period" Fix)

      for (const cid of unit.classIds) {

          const cls = classMap.get(cid);

          const struct = cls?.structure || data.settings.dayStructure;

          const limit = Math.min(cls?.periodCount ?? 99, struct.length);

          

          if (p >= limit) return false;

          if (unit.duration === 2 && p2 !== -1 && p2 >= limit) return false;

      }



   // 1. Global blocks

   if (isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p])) return false;
   if (unit.duration === 2 && p2 !== -1 && isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p2])) return false;

   // Teacher Grid
   for (const tid of unit.teacherIds) {
       const t = teacherMap.get(tid);
       if (t?.constraints?.[d]?.[p]) return false;
       if (unit.duration === 2 && p2 !== -1 && t?.constraints?.[d]?.[p2]) return false;
   }
   
   // Class Fixed Sessions
   for (const cid of unit.classIds) {
       const cls = classMap.get(cid);
       if (cls?.fixedSessions?.[d]?.[p]) return false;
       if (unit.duration === 2 && p2 !== -1 && cls?.fixedSessions?.[d]?.[p2]) return false;
   }
   return true;
}
