import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";

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

// --- CORE HARD CONSTRAINTS ---

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

  // 1. IMMUTABLE WALLS
  if (!checkImmutableConstraints(d, p, p2, unit, data, teacherMap, classMap)) {
      return false;
  }

  // 2. TEACHER CONSTRAINTS
  const maxConsecutive = data.settings.maxConsecutivePeriods || 4;
  for (const tid of teacherIds) {
    // A. Availability (Allow overlap if it's the SAME Joint Unit)
    const occupantP1 = state.teacherOccupancy[tid]?.[d]?.[p];
    if (occupantP1 && occupantP1 !== "BLOCK" && occupantP1 !== unit.id) return false;
    
    if (duration === 2) {
        const occupantP2 = state.teacherOccupancy[tid]?.[d]?.[p2];
        if (occupantP2 && occupantP2 !== "BLOCK" && occupantP2 !== unit.id) return false;
    }

    // B. Load & Consecutive
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = teacherMap.get(tid);
    const maxLoad = teacher?.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);

    if (currentLoad + duration > maxLoad) return false;
    
    if (currentLoad + duration >= 3) { 
       if (!checkConsecutiveLimit(state, d, p, p2, duration, tid, maxConsecutive)) return false;
    }
  }

  // 3. CLASS CONSTRAINTS
  const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;
  for (const cid of classIds) {
    // A. Availability
    const occupantP1 = state.classOccupancy[cid]?.[d]?.[p];
    if (occupantP1 && occupantP1 !== unit.id) return false;
    if (duration === 2) {
        const occupantP2 = state.classOccupancy[cid]?.[d]?.[p2];
        if (occupantP2 && occupantP2 !== unit.id) return false;
    }

    // B. Subject Variety (Daily Max)
    // Fast scan of day (Size ~8)
    if (state.classDailySubjects[cid]?.[d]?.has(subjectId)) {
        let count = 0;
        const daySched = state.schedule[cid]?.[d];
        if (daySched) {
            Object.values(daySched).forEach(s => {
                if (s.subjectId === subjectId) count += (s.duration || 1);
            });
        }
        if (count + duration > maxSubj) return false;
    }

    // C. Subject Continuity (Holistic "Single Block" Rule)
    if (state.classDailySubjects[cid]?.[d]?.has(subjectId)) {
        const daySched = state.schedule[cid]?.[d];
        if (daySched) {
            let existingMin = Infinity;
            let existingMax = -Infinity;
            
            Object.keys(daySched).forEach(pStr => {
                const pIdx = parseInt(pStr);
                if (daySched[pIdx]?.subjectId === subjectId) {
                    if (pIdx < existingMin) existingMin = pIdx;
                    if (pIdx > existingMax) existingMax = pIdx;
                }
            });

            if (existingMin !== Infinity) {
                // Determine the new proposed block bounds
                const newMin = p;
                const newMax = (duration === 2) ? p2 : p;

                // Combined bounds if we were to place this
                const combinedMin = Math.min(existingMin, newMin);
                const combinedMax = Math.max(existingMax, newMax);
                
                // CRITICAL: Every instructional period in the combined range 
                // MUST be this subject. No gaps, no other subjects.
                for (let i = combinedMin; i <= combinedMax; i++) {
                    if (i >= newMin && i <= newMax) continue; // It's the new unit
                    
                    const slot = daySched[i];
                    const type = data.settings.dayStructure[i]?.type || "CLASS";

                    // If the slot is empty or a different subject, it's a split
                    // BUT we allow bridging over non-class periods (Breaks/Lunch)
                    if (type === "CLASS") {
                        if (!slot || slot.subjectId !== subjectId) {
                            return false;
                        }
                    }
                }
            }
        }
    }

    // D. Subject Continuity ("Don't Split Others" Rule)
    // Prevent placing ourselves between two blocks of another subject
    if (p > 0) {
        const prev = state.schedule[cid]?.[d]?.[p-1];
        const nextP = (duration === 2 ? p2 : p) + 1;
        const next = state.schedule[cid]?.[d]?.[nextP];

        if (prev && next && prev.subjectId === next.subjectId && prev.subjectId !== subjectId) {
             return false;
        }
    }
  }

  // 4. ROOM LOGIC
  const subject = subjectMap.get(subjectId);
  const repClass = classMap.get(classIds[0]);
  const targetRoomId = subject?.requiredRoomId || repClass?.defaultRoomId;

  if (targetRoomId) {
    // A. Availability
    const roomOccP1 = state.roomOccupancy[targetRoomId]?.[d]?.[p];
    if (roomOccP1 && roomOccP1 !== unit.id) return false;
    
    if (duration === 2) {
        const roomOccP2 = state.roomOccupancy[targetRoomId]?.[d]?.[p2];
        if (roomOccP2 && roomOccP2 !== unit.id) return false;
    }

    // B. Capacity (Phase 1 Strictness)
    const room = roomMap.get(targetRoomId);
    if (room && repClass && (repClass.studentCount || 0) > room.capacity) {
        return false; 
    }
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
