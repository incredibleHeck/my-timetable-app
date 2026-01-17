import { Teacher, AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints } from "./constraints";
import { getNextClassPeriod, getPeriodType } from "./utils";

/**
 * HELPER: Calculates how 'busy' a teacher is based on their constraints.
 * Combines explicit blocks (constraints grid) and implicit blocks (max load limits).
 */
const getTeacherConstraintScore = (
  teacherId: string,
  teachers: Teacher[]
): number => {
  const teacher = teachers.find((t) => t.id === teacherId);
  if (!teacher) return 0;

  let blockedCount = 0;
  // 1. Count blocked slots in the 5x12 grid
  if (teacher.constraints) {
    for (const row of teacher.constraints) {
      for (const isBlocked of row) {
        if (isBlocked) blockedCount++;
      }
    }
  }

  // 2. Add Max Load Constraints
  // If a teacher allows 40 periods (Full time), score is low.
  // If a teacher allows only 10 periods (Part time), score is high.
  const totalSlots = 60; // 5 days * 12 periods (approx)
  const maxLoad = teacher.maxPeriodsPerDay
    ? teacher.maxPeriodsPerDay * 5
    : totalSlots;

  // The tighter the limit, the higher the priority
  return blockedCount + (totalSlots - maxLoad);
};

/**
 * HELPER: Checks if the subject requires a specific, scarce room.
 * This prevents running out of "Computer Lab" slots by scheduling them early.
 */
const getRoomScarcityScore = (unit: AllocationUnit, data: AppData): number => {
  // 1. Explicit Room Type Requirement (e.g., "Computer Lab")
  if (unit.requiredRoomType) {
    // Count how many rooms of this type exist in the school
    const matchingRooms = data.rooms.filter(
      (r) => r.type === unit.requiredRoomType
    ).length;

    // Scarcity Formula: Fewer rooms = Higher Priority.
    // If 1 Lab exists: 5000 / 1 = 5000 pts
    // If 5 Labs exist: 5000 / 5 = 1000 pts
    return 5000 / (matchingRooms || 1);
  }

  // 2. Legacy Single Resource Flag (Fallback)
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  if (subject?.isSingleResource) {
    return 2000;
  }

  return 0;
};

/**
 * VARIABLE ORDERING (MRV)
 * Calculates the 'Difficulty' of an allocation unit.
 * Used to sort the queue before the solver starts: Hardest first.
 */
export const calculatePriority = (
  unit: AllocationUnit,
  teachers: Teacher[],
  data: AppData
): number => {
  let score = 0;
  const subject = data.subjects.find(s => s.id === unit.subjectId);

  // 1. Joint Classes (Highest Priority)
  // These require aligning multiple schedules perfectly. Hardest to fit.
  if (unit.classIds.length > 1) score += 10000;

  // 2. Room/Resource Scarcity (ICT, Science, Music)
  // If a subject is forced into a SINGLE specific room shared by the whole school
  if (subject?.requiredRoomId) {
    score += 8000; // Very high priority: Get them into the lab before it fills up
  }
  score += getRoomScarcityScore(unit, data);

  // 3. Teacher Availability Constraints
  // If a unit has multiple teachers, sum their constraints.
  for (const tid of unit.teacherIds) {
    score += getTeacherConstraintScore(tid, teachers) * 50;
  }

  // 4. Duration (Double periods are harder to fit than single)
  if (unit.duration === 2) score += 500;

  // 5. Elective Blocks (Gang scheduling)
  // If this unit belongs to an elective block, it must be scheduled with its peers.
  if (unit.electiveBlockId) score += 1000;

  return score;
};

/**
 * MRV: Finds the index of the gang with the smallest domain.
 */
export function findMostConstrainedGangIdx(
  leaders: AllocationUnit[], 
  state: SchedulerState, 
  data: AppData,
  gangMap: Map<string, AllocationUnit[]>
): number {
  let minDomain = Infinity;
  let bestIdx = 0;

  for (let i = 0; i < leaders.length; i++) {
    const gangId = leaders[i].jointClassId || leaders[i].electiveBlockId || leaders[i].id;
    const gang = gangMap.get(gangId)!;
    const domainSize = countValidSlots(state, data, gang);

    if (domainSize < minDomain) {
      minDomain = domainSize;
      bestIdx = i;
    } else if (domainSize === minDomain) {
      // Tie-breaker: Static Priority
      if (leaders[i].priority > leaders[bestIdx].priority) {
        bestIdx = i;
      }
    }
    // Optimization: If 0 moves left, it's a bottleneck, pick immediately
    if (minDomain === 0) break;
  }
  return bestIdx;
}

export function countValidSlots(state: SchedulerState, data: AppData, gang: AllocationUnit[]): number {
  const globalPeriods = data.settings.periodsPerDay;
  const days = (data.settings as any).daysPerWeek || 5;
  let count = 0;

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < globalPeriods; p++) {
      let gangValid = true;
      for (const u of gang) {
         const cls = data.classes.find(c => c.id === u.classIds[0]);
         const struct = cls?.structure || data.settings.dayStructure;

         if (getPeriodType(struct, p) !== "CLASS") {
             gangValid = false;
             break;
         }

         let p2 = -1;
         if (u.duration === 2) {
           const next = getNextClassPeriod(p, struct, globalPeriods);
           if (next === null) {
               gangValid = false;
               break;
           }
           p2 = next;
         }

         const involvedClasses = u.classIds.map(cid => data.classes.find(c => c.id === cid));
         if (!checkHardConstraints(state, data, d, p, p2, u, involvedClasses)) {
             gangValid = false;
             break;
         }
      }
      if (gangValid) count++;
    }
  }
  return count;
}