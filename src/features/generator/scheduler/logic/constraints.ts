import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { isOccasionBlocked } from "../../../../utils/utils";
import { checkSubjectContinuity } from "../validation/load-checks";
import { ValidationContext } from "../validation/types";

/**
 * ARCHITECT NOTES:
 * 1. Performance: O(1) Map-based lookups.
 * 2. Logic: Includes Joint Class "Self-Overlap" permission.
 * 3. Logic: Subject continuity enforced here (aligned with manual validation).
 * 4. Max consecutive periods is soft (scoring/repair only), not a hard reject.
 */

export const isGlobalSlotBlocked = isOccasionBlocked;

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
  const maxTeacherLoad = data.settings.maxTeacherPeriodsPerDay || 6;

  for (const tid of teacherIds) {
    const occupantP1 = state.teacherOccupancy[tid]?.[d]?.[p];
    if (occupantP1 && occupantP1 !== "BLOCK" && occupantP1 !== unit.id) return false;
    
    if (duration === 2) {
        const occupantP2 = state.teacherOccupancy[tid]?.[d]?.[p2];
        if (occupantP2 && occupantP2 !== "BLOCK" && occupantP2 !== unit.id) return false;
    }

    // RANK 1.3: TEACHER WELFARE — daily load cap only (consecutive is soft)
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = teacherMap.get(tid);
    const maxLoad = teacher?.maxPeriodsPerDay ?? maxTeacherLoad;

    if (currentLoad + duration > maxLoad) return false;
  }

  // B. Class Availability & Shape Rules
  const proposedSlots = new Set<number>([p]);
  if (duration === 2 && p2 !== -1) proposedSlots.add(p2);

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

    // RANK 1.5: Subject continuity (no XYX sandwiching)
    const cls = classMap.get(cid);
    const structure = cls?.structure || data.settings.dayStructure;
    const maxPeriods = cls?.periodCount ?? data.settings.periodsPerDay;
    const continuityCtx: ValidationContext = {
      data,
      targetDay: d,
      targetPeriod: p,
      teacherId: teacherIds[0] || "",
      classId: cid,
      subjectId,
      duration,
      maxPeriods,
      structure,
      classSchedule: state.classTimeRanges.get(cid) || [],
      allClassSchedules: state.classTimeRanges,
      ignoredSlots: new Set(),
    };
    if (checkSubjectContinuity(continuityCtx, proposedSlots, new Set(), state)) {
      return false;
    }
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
