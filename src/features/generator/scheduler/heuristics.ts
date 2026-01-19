import { Teacher, AppData, Subject, ClassGroup } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints } from "./constraints";
import { getNextClassPeriod, getPeriodType } from "./utils";

/**
 * ARCHITECT NOTES:
 * 1. Performance: Implemented "Tournament MRV" to kill the O(N^2) loop.
 * 2. Optimization: Injected Maps for all lookups.
 * 3. Priority Hierarchy: Follows Ranks 1-4.
 */

// --- STATIC PRIORITY (Calculated Once) ---

const getTeacherConstraintScore = (
  teacherId: string,
  teacherMap: Map<string, Teacher>
): number => {
  const teacher = teacherMap.get(teacherId);
  if (!teacher) return 0;

  let blockedCount = 0;
  if (teacher.constraints) {
    for (const row of teacher.constraints) {
      for (const isBlocked of row) {
        if (isBlocked) blockedCount++;
      }
    }
  }

  const totalSlots = 60; 
  const maxLoad = teacher.maxPeriodsPerDay ? teacher.maxPeriodsPerDay * 5 : totalSlots;
  return blockedCount + (totalSlots - maxLoad);
};

export const calculatePriority = (
  unit: AllocationUnit,
  data: AppData,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>
): number => {
  let score = 0;
  const subject = subjectMap.get(unit.subjectId);

  // --- RANK 1: Restricted / Part-Time Teachers (Absolute Global Priority) ---
  for (const tid of unit.teacherIds) {
    const teacher = teacherMap.get(tid);
    if (teacher?.constraints) {
      let availableSlots = 0;
      teacher.constraints.forEach(row => row.forEach(isBlocked => { if (!isBlocked) availableSlots++; }));
      if (availableSlots < 45) {
        score += 50000; 
      }
    }
  }

  // --- RANK 3: THE BOTTLENECKS ---
  // 3.1 Complex Groupings (Joint Classes / Electives)
  if (unit.classIds.length > 1 || unit.jointClassId || unit.electiveBlockId) {
      score += 30000;
  }

  // 3.2 Specialist Rooms (Labs/Workshops)
  const isSpecialist = subject?.requiredRoomId || unit.requiredRoomType;
  if (isSpecialist) {
      if (unit.duration === 2) {
          score += 25000; // Specialist Double
      } else {
          score += 20000; // Specialist Single
      }
  }

  // --- RANK 2: Structural Hierarchy (Grade Level) ---
  score += unit.rankLevel * 100;

  // --- RANK 4: THE BIG ROCKS (Standard Doubles) ---
  if (!isSpecialist && unit.duration === 2 && unit.classIds.length === 1 && !unit.jointClassId && !unit.electiveBlockId) {
      score += 15000;
  }

  // Teacher Constraints Tie-breaker
  for (const tid of unit.teacherIds) {
    score += getTeacherConstraintScore(tid, teacherMap) * 10;
  }

  return score;
};

// --- DYNAMIC HEURISTICS ---

export function findMostConstrainedGangIdx(
  leaders: AllocationUnit[], 
  state: SchedulerState, 
  data: AppData,
  gangMap: Map<string, AllocationUnit[]>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, any>
): number {
  
  if (leaders.length < 20) {
      return scanAll(leaders, state, data, gangMap, teacherMap, subjectMap, classMap, roomMap);
  }

  let bestIdx = -1;
  let minDomain = Infinity;
  let bestPriority = -1;

  const sampleSize = Math.max(15, Math.floor(leaders.length * 0.1));

  for (let k = 0; k < sampleSize; k++) {
      const idx = Math.floor(Math.random() * leaders.length);
      const leader = leaders[idx];
      
      if (leader.priority >= 50000) return idx;

      const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
      const gang = gangMap.get(gangId)!;
      
      const domainSize = countValidSlots(state, data, gang, classMap, teacherMap, subjectMap, roomMap);

      if (domainSize < minDomain) {
          minDomain = domainSize;
          bestIdx = idx;
          bestPriority = leader.priority;
      } else if (domainSize === minDomain) {
          if (leader.priority > bestPriority) {
              bestIdx = idx;
              bestPriority = leader.priority;
          }
      }
  }

  return bestIdx === -1 ? 0 : bestIdx;
}

function scanAll(
    leaders: AllocationUnit[], 
    state: SchedulerState, 
    data: AppData,
    gangMap: Map<string, AllocationUnit[]>,
    teacherMap: Map<string, Teacher>,
    subjectMap: Map<string, Subject>,
    classMap: Map<string, ClassGroup>,
    roomMap: Map<string, any>
): number {
    let minDomain = Infinity;
    let bestIdx = 0;

    for (let i = 0; i < leaders.length; i++) {
        const leader = leaders[i];
        if (leader.priority >= 50000) return i;

        const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
        const gang = gangMap.get(gangId)!;
        const domainSize = countValidSlots(state, data, gang, classMap, teacherMap, subjectMap, roomMap);

        if (domainSize < minDomain) {
            minDomain = domainSize;
            bestIdx = i;
        } else if (domainSize === minDomain) {
            if (leader.priority > leaders[bestIdx].priority) {
                bestIdx = i;
            }
        }
    }
    return bestIdx;
}

export function countValidSlots(
    state: SchedulerState, 
    data: AppData, 
    gang: AllocationUnit[],
    classMap: Map<string, ClassGroup>,
    teacherMap: Map<string, Teacher>,
    subjectMap: Map<string, Subject>,
    roomMap: Map<string, any>
): number {
  const globalPeriods = 15; // Scan full range
  const days = (data.settings as any).daysPerWeek || 5;
  let count = 0;

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < globalPeriods; p++) {
      let gangValid = true;
      
      for (const u of gang) {
         const cls = classMap.get(u.classIds[0]);
         const struct = cls?.structure || data.settings.dayStructure;

         const classLimit = cls?.periodCount ?? data.settings.periodsPerDay;
         if (p >= classLimit || getPeriodType(struct, p) !== "CLASS") { gangValid = false; break; }

         let p2 = -1;
         if (u.duration === 2) {
           const next = getNextClassPeriod(p, struct, classLimit);
           if (next === null) { gangValid = false; break; }
           p2 = next;
         }

         if (!checkHardConstraints(state, data, d, p, p2, u, teacherMap, classMap, subjectMap, roomMap)) {
             gangValid = false; break;
         }
      }
      if (gangValid) count++;
    }
  }
  return count;
}