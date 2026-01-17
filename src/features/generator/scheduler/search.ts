import { AppData, Conflict } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints, checkImmutableConstraints } from "./constraints";
import { determineRoom, forceDetermineRoom } from "./rooms";
import { calculateScore } from "./scoring";
import { getNextClassPeriod, getPeriodType } from "./utils";
import { EvaluationEngine } from "./evaluation";

const evaluator = new EvaluationEngine();

export function findValidMoves(state: SchedulerState, data: AppData, gangUnits: AllocationUnit[]) {
    const globalPeriods = data.settings.periodsPerDay;
    const days = (data.settings as any).daysPerWeek || 5;
    const moves = [];
    
    for (let d = 0; d < days; d++) {
      for (let p = 0; p < globalPeriods; p++) {
          const struct = data.settings.dayStructure;
          if (getPeriodType(struct, p) !== "CLASS") continue;

          let p2: number | null = -1;
          if (gangUnits[0].duration === 2) {
              const next = getNextClassPeriod(p, struct, globalPeriods);
              if (next === null) continue;
              p2 = next;
          }

          let gangValid = true;
          const currentRooms: Record<string, string> = {};

          for (const u of gangUnits) {
             const evalResult = evaluator.evaluate(state, data, { d, p, p2 }, u);
             
             if (!evalResult.isLegal) {
                 gangValid = false;
                 break;
             }
             
             const rId = determineRoom(d, p, p2, u, state, data);
             if (!rId) {
                 gangValid = false;
                 break;
             }
             currentRooms[u.id] = rId;
          }

          if (gangValid) {
              const score = calculateScore(state, data, d, p, gangUnits[0]);
              moves.push({ d, p, p2, score, rooms: currentRooms });
          }
      }
    }
    return moves;
}

/**
 * findMinConflictMove: The core of the Iterative Repair strategy.
 * Instead of returning a boolean (can/cannot), it returns a conflict count.
 */
export function findMinConflictMove(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  unitMap: Map<string, AllocationUnit>
): { d: number; p: number; p2: number; cost: number; score: number; evictions: Set<string>; rooms: Record<string, string> } {
  const globalPeriods = data.settings.periodsPerDay;
  const days = (data.settings as any).daysPerWeek || 5;
  const struct = data.settings.dayStructure;

  let bestMove = { 
      d: -1, 
      p: -1, 
      p2: -1, 
      cost: Infinity, 
      score: -Infinity, 
      evictions: new Set<string>(), 
      rooms: {} as Record<string, string> 
  };

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < globalPeriods; p++) {
      if (getPeriodType(struct, p) !== "CLASS") continue;

      let p2: number | null = -1;
      if (gang[0].duration === 2) {
        p2 = getNextClassPeriod(p, struct, globalPeriods);
        if (p2 === null) continue; 
      }

      // 1. Check Immutable constraints (Fixed sessions, Teacher grid)
      let immutableValid = true;
      for (const u of gang) {
          if (!checkImmutableConstraints(d, p, p2, u, data)) {
              immutableValid = false;
              break;
          }
      }
      if (!immutableValid) continue;

      // 2. Evaluate Move (Penalty + Score)
      let totalPenalty = 0;
      let totalScore = 0;
      const evictions = new Set<string>();
      const currentRooms: Record<string, string> = {};
      let possible = true;

      for (const u of gang) {
          const evalResult = evaluator.evaluate(state, data, { d, p, p2 }, u);
          totalPenalty += evalResult.penalty;
          totalScore += evalResult.score;

          const rId = forceDetermineRoom(d, p, p2, u, state, data);
          if (!rId) {
              possible = false;
              break;
          }
          currentRooms[u.id] = rId;

          // Robustly identify victims for eviction
          const victims = findUnitsInSlot(state, u, d, p, p2);
          victims.forEach(v => evictions.add(v));
      }

      if (possible) {
          if (totalPenalty < bestMove.cost || (totalPenalty === bestMove.cost && totalScore > bestMove.score)) {
              bestMove = { d, p, p2, cost: totalPenalty, score: totalScore, evictions, rooms: currentRooms };
          }
          if (totalPenalty === 0) return bestMove;
      }
    }
  }

  return bestMove;
}

/**
 * findPotentialConflicts: Determines how "noisy" a move is by checking broken constraints.
 */
export function countPotentialConflicts(
  unit: AllocationUnit,
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number
): number {
  let count = 0;

  // A. Teacher Conflicts
  for (const tid of unit.teacherIds) {
    if (state.teacherOccupancy[tid]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.teacherOccupancy[tid]?.[d]?.[p2]) count++;
    
    // Check Teacher Daily Load
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = data.teachers.find(t => t.id === tid);
    const max = teacher?.maxPeriodsPerDay || data.settings.maxTeacherPeriodsPerDay || 6;
    if (currentLoad + unit.duration > max) count += 2; // Weight load violations heavily
  }

  // B. Room/Resource Conflicts
  const subject = data.subjects.find(s => s.id === unit.subjectId);
  const roomId = subject?.requiredRoomId || unit.defaultRoomId;
  if (roomId) {
    if (state.roomOccupancy[roomId]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.roomOccupancy[roomId]?.[d]?.[p2]) count++;
  }

  // C. Class Conflicts (Student Overlaps)
  for (const cid of unit.classIds) {
    if (state.classOccupancy[cid]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.classOccupancy[cid]?.[d]?.[p2]) count++;
  }

  // D. Single Resource Conflicts
  if (state.singleResourceUsage[unit.subjectId]) {
      if (state.singleResourceUsage[unit.subjectId][d][p]) count++;
      if (p2 !== -1 && state.singleResourceUsage[unit.subjectId][d][p2]) count++;
  }

  return count;
}

/**
 * findUnitsInSlot: Identifies all units that would be displaced if we placed a new unit here.
 * Leverages O(1) grid lookups for high-performance repair.
 */
export function findUnitsInSlot(
  state: SchedulerState,
  unit: AllocationUnit,
  d: number,
  p: number,
  p2: number
): Set<string> {
  const victimIds = new Set<string>();

  // 1. Collect Teacher Victims
  unit.teacherIds.forEach((tid) =>
    collectEvictions(state, d, p, p2, tid, "TEACHER", victimIds)
  );

  // 2. Collect Class Victims
  unit.classIds.forEach((cid) =>
    collectEvictions(state, d, p, p2, cid, "CLASS", victimIds)
  );

  // 3. Collect Room Victims
  // We check both the required room and the homeroom fallback
  const roomId = unit.defaultRoomId;
  if (roomId) {
    collectEvictions(state, d, p, p2, roomId, "ROOM", victimIds);
  }

  // 4. Collect Subject/Resource Victims
  if (state.singleResourceUsage[unit.subjectId]) {
    collectEvictions(state, d, p, p2, unit.subjectId, "SUBJECT", victimIds);
  }

  return victimIds;
}

export function collectEvictions(
  state: SchedulerState, 
  d: number, 
  p: number, 
  p2: number, 
  id: string, 
  type: "TEACHER"|"CLASS"|"ROOM"|"SUBJECT", 
  out: Set<string>
) {
    let u1: string | null = null;
    let u2: string | null = null;

    if (type === "TEACHER") {
        u1 = state.teacherOccupancy[id]?.[d]?.[p];
        if (p2 !== -1) u2 = state.teacherOccupancy[id]?.[d]?.[p2];
    } else if (type === "CLASS") {
        u1 = state.classOccupancy[id]?.[d]?.[p];
        if (p2 !== -1) u2 = state.classOccupancy[id]?.[d]?.[p2];
    } else if (type === "ROOM") {
        u1 = state.roomOccupancy[id]?.[d]?.[p];
        if (p2 !== -1) u2 = state.roomOccupancy[id]?.[d]?.[p2];
    } else if (type === "SUBJECT") {
        u1 = state.singleResourceUsage[id]?.[d]?.[p];
        if (p2 !== -1) u2 = state.singleResourceUsage[id]?.[d]?.[p2];
    }

    if (u1 && u1 !== "BLOCK") out.add(u1);
    if (u2 && u2 !== "BLOCK") out.add(u2);
}

export function findUnitFromConflict(conflict: Conflict, unitMap: Map<string, AllocationUnit>): AllocationUnit | undefined {
    // Simplified lookup: Check unitMap for matching subject/class
    // In a real optimized system, we'd have a map of `SubjectID-ClassID` -> Unit
    // Here we iterate (assuming conflict count is low during repair)
    for (const unit of unitMap.values()) {
        if (unit.subjectId === conflict.subjectId && 
            unit.classIds.includes(conflict.classId)) { // conflict.classId might be string list or single ID?
            // Conflict object usually has single classId if generated by validator
            // We need to match robustly
            return unit;
        }
    }
    return undefined;
}