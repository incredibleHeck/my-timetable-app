import { AppData, Conflict, Teacher, Subject } from "../../../types";
import { AllocationUnit, SchedulerState } from "./core/types";
import { checkHardConstraints, checkImmutableConstraints } from "./constraints";
import { determineRoom, forceDetermineRoom } from "./rooms";
import { calculateScore } from "./scoring";
import { getNextClassPeriod, getPeriodType } from "./utils/utils";
import { EvaluationEngine } from "./evaluation";
import { TabuManager } from "./tabu";

const evaluator = new EvaluationEngine();

// --- 1. CONSTRUCTION PHASE (Valid Moves) ---

export function findValidMoves(
  state: SchedulerState, 
  data: AppData, 
  gangUnits: AllocationUnit[],
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, any>,
  roomMap: Map<string, any>
) {
    const globalPeriods = data.settings.periodsPerDay;
    const maxPossiblePeriods = 15; // Support up to 15 periods as per UI limits
    const days = (data.settings as any).daysPerWeek || 5;
    const moves = [];
    
    const primaryUnit = gangUnits[0];

    for (let d = 0; d < days; d++) {
        for (let p = 0; p < maxPossiblePeriods; p++) {
            let gangValid = true;
            const currentRooms: Record<string, string> = {};
            let sharedP2 = -1;

            for (const u of gangUnits) {
                const cls = classMap.get(u.classIds[0]);
                const struct = cls?.structure || data.settings.dayStructure;
                
                // RANK 0: Structural Hierarchy (Must be CLASS slot for this specific class)
                const classLimit = cls?.periodCount ?? globalPeriods;
                if (p >= classLimit || getPeriodType(struct, p) !== "CLASS") {
                    gangValid = false; break;
                }

                let p2: number | null = -1;
                if (u.duration === 2) {
                    const next = getNextClassPeriod(p, struct, classLimit);
                    if (next === null) { gangValid = false; break; }
                    p2 = next;
                }
                sharedP2 = p2;

                // RANK 1: Evaluation
                const evalResult = evaluator.evaluate(state, data, { d, p, p2 }, u, teacherMap, subjectMap, classMap, roomMap);
                if (!evalResult.isLegal) {
                    gangValid = false; break;
                }
                
                // 3. Room Assignment
                const rId = determineRoom(d, p, p2, u, state, data, subjectMap, classMap);
                if (!rId) {
                    gangValid = false; break;
                }
                currentRooms[u.id] = rId;
            }

            if (gangValid) {
                const score = calculateScore(state, data, d, p, primaryUnit, teacherMap, subjectMap);
                moves.push({ d, p, p2: sharedP2, score, rooms: currentRooms });
            }
        }
    }
    return moves;
}

// --- 2. REPAIR PHASE (Min-Conflicts) ---

export function findMinConflictMove(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, any>,
  roomMap: Map<string, any>,
  tabu?: TabuManager,
  iteration: number = 0
): { d: number; p: number; p2: number; cost: number; score: number; evictions: Set<string>; rooms: Record<string, string> } {
  
  const globalPeriods = data.settings.periodsPerDay;
  const maxPossiblePeriods = 15;
  const days = (data.settings as any).daysPerWeek || 5;

  let bestMove = { 
      d: -1, p: -1, p2: -1, 
      cost: Infinity, score: -Infinity, 
      evictions: new Set<string>(), rooms: {} as Record<string, string> 
  };

  const primaryUnit = gang[0];

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < maxPossiblePeriods; p++) {
      let possible = true;
      const currentRooms: Record<string, string> = {};
      let totalPenalty = 0;
      let sharedP2 = -1;

      for (const u of gang) {
        const cls = classMap.get(u.classIds[0]);
        const struct = cls?.structure || data.settings.dayStructure;
        
        // RANK 0: Structural Hierarchy (Must be CLASS slot for this specific class)
        const classLimit = cls?.periodCount ?? globalPeriods;
        if (p >= classLimit || getPeriodType(struct, p) !== "CLASS") {
          possible = false; break;
        }

        let p2: number | null = -1;
        if (u.duration === 2) {
          p2 = getNextClassPeriod(p, struct, classLimit) ?? -1;
          if (p2 === -1) { possible = false; break; }
        }
        sharedP2 = p2;

        // 2. Immutable Constraints (Never violate these)
        if (!checkImmutableConstraints(d, p, p2, u, data, teacherMap, classMap)) {
          possible = false; break;
        }

        // 3. Conflict Counting (The "Cost" of the move)
        const evalResult = evaluator.evaluateMove(state, data, u, d, p, teacherMap, subjectMap, classMap, roomMap, unitMap);
        if (!evalResult.isLegal) {
             possible = false;
             break;
        }
        totalPenalty += evalResult.totalCost;

        // 4. Room Assignment (Forced)
        const rId = forceDetermineRoom(d, p, p2, u, state, data, subjectMap, classMap);
        if (!rId) {
             possible = false; break;
        }
        currentRooms[u.id] = rId;
      }

      if (possible) {
        const isTabu = tabu ? tabu.isTabu(primaryUnit.id, d, p, iteration) : false;
        if (isTabu && totalPenalty > 0) totalPenalty += 10000;

        if (totalPenalty <= bestMove.cost) {
             const score = calculateScore(state, data, d, p, primaryUnit, teacherMap, subjectMap);
             
             if (totalPenalty < bestMove.cost || (totalPenalty === bestMove.cost && score > bestMove.score)) {
                  const evictions = new Set<string>();
                  gang.forEach(gUnit => {
                      const victims = findUnitsInSlot(state, gUnit, d, p, sharedP2);
                      victims.forEach(v => evictions.add(v));
                  });

                  bestMove = { d, p, p2: sharedP2, cost: totalPenalty, score, evictions, rooms: currentRooms };
             }
        }
        
        if (totalPenalty === 0) return bestMove; 
      }
    }
  }

  return bestMove;
}

// --- 3. OPTIMIZED CONFLICT COUNTER (O(1)) ---

export function countPotentialConflicts(
  unit: AllocationUnit,
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>
): number {
  let count = 0;

  // A. Teacher Conflicts
  for (const tid of unit.teacherIds) {
    if (state.teacherOccupancy[tid]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.teacherOccupancy[tid]?.[d]?.[p2]) count++;
    
    // Check Teacher Daily Load (O(1) Access)
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const teacher = teacherMap.get(tid); 
    const max = teacher?.maxPeriodsPerDay || data.settings.maxTeacherPeriodsPerDay || 6;
    if (currentLoad + unit.duration > max) count += 2; 
  }

  // B. Room/Resource Conflicts
  const subject = subjectMap.get(unit.subjectId); 
  const roomId = subject?.requiredRoomId || unit.defaultRoomId;
  if (roomId) {
    if (state.roomOccupancy[roomId]?.[d]?.[p]) count++;
    if (p2 !== -1 && state.roomOccupancy[roomId]?.[d]?.[p2]) count++;
  }

  // C. Class Conflicts
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
  const roomId = unit.defaultRoomId;
  if (roomId) {
    collectEvictions(state, d, p, p2, roomId, "ROOM", victimIds);
  }

  // 4. Collect Subject/Resource Victims
  if (state.singleResourceUsage[unit.subjectId]) {
    collectEvictions(state, d, p, p2, unit.subjectId, "SUBJECT", victimIds);
  }

  // 5. HOLISTIC LOGIC VICTIMS: 
  // If placing this unit here splits ANOTHER subject on the board, 
  // we identify those subjects as victims.
  for (const cid of unit.classIds) {
      const daySched = state.schedule[cid]?.[d];
      if (!daySched) continue;

      const subjectsToday = new Set<string>();
      Object.values(daySched).forEach(s => {
          if (s && s.subjectId && s.subjectId !== unit.subjectId) subjectsToday.add(s.subjectId);
      });

      for (const sId of subjectsToday) {
          const indices: number[] = [];
          Object.keys(daySched).forEach(pStr => {
              const pIdx = parseInt(pStr);
              const s = daySched[pIdx];
              // Ignore slots being physically overwritten
              const isOverwritten = (pIdx === p || (p2 !== -1 && pIdx === p2));
              if (s && s.subjectId === sId && !isOverwritten) indices.push(pIdx);
          });

          if (indices.length < 2) continue;
          indices.sort((a, b) => a - b);
          
          // Check for splits in the remaining subject block
          for (let i = indices[0]; i <= indices[indices.length - 1]; i++) {
              if (i === p || (p2 !== -1 && i === p2)) {
                  // WE are sitting in the middle of this subject!
                  // It's a sandwich. The WHOLE subject must move.
                  Object.values(daySched).forEach(s => {
                      if (s && s.subjectId === sId && s.unitId && s.unitId !== "BLOCK") {
                          victimIds.add(s.unitId);
                      }
                  });
                  break;
              }
          }
      }
  }

  victimIds.delete("BLOCK");
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
    for (const unit of unitMap.values()) {
        if (unit.subjectId === conflict.subjectId && 
            unit.classIds.includes(conflict.classId)) { 
            return unit;
        }
    }
    return undefined;
}
