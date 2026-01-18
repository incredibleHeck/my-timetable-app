import { AppData, Conflict, Teacher, Subject, ClassGroup, Room } from "../../../types";
import { AllocationUnit } from "./types";
import { initializeState, applyGangToState, removeGangFromState } from "./state";
import { findMostConstrainedGangIdx, calculatePriority } from "./heuristics"; 
import { findValidMoves, findMinConflictMove } from "./search";
import { TabuManager } from "./tabu";

/**
 * CSP SOLVER: Final Integrated Version
 * Orchestrates Phase 1 (Construction) and Phase 2 (Repair) with O(1) performance.
 */
export const solveSmart = (
  units: AllocationUnit[], 
  data: AppData,
  onProgress?: (phase: string, progress: number, total: number, conflicts: number) => boolean
) => {
  // 1. ARCHITECT: Initialize O(1) Lookups ONCE
  const teacherMap = new Map<string, Teacher>(data.teachers.map(t => [t.id, t]));
  const subjectMap = new Map<string, Subject>(data.subjects.map(s => [s.id, s]));
  const classMap = new Map<string, ClassGroup>(data.classes.map(c => [c.id, c]));
  const roomMap = new Map<string, Room>(data.rooms.map(r => [r.id, r]));
  const unitMap = new Map<string, AllocationUnit>();

  // 2. Initialize State
  const state = initializeState(data);
  
  // 3. Pre-Process Gangs & Static Priority
  const gangMap = new Map<string, AllocationUnit[]>();
  for (const u of units) {
    unitMap.set(u.id, u);
    u.priority = calculatePriority(u, data, teacherMap, subjectMap);
    
    const gangId = u.jointClassId || u.electiveBlockId || u.id;
    if (!gangMap.has(gangId)) gangMap.set(gangId, []);
    gangMap.get(gangId)!.push(u);
  }

  // Identify Gang Leaders for the Queue
  let unplacedGangLeaders = units.filter(u => {
      const gangId = u.jointClassId || u.electiveBlockId || u.id;
      return gangMap.get(gangId)![0].id === u.id;
  });

  const totalGangs = unplacedGangLeaders.length;
  const constructionQueue = [...unplacedGangLeaders];
  const unplacedDuringConstruction: AllocationUnit[] = [];

  // --- PHASE 1: CONSTRUCTION (Tournament MRV + LCV) ---
  let steps = 0;
  while (constructionQueue.length > 0) {
    steps++;
    if (onProgress && steps % 10 === 0) {
        if (!onProgress("CONSTRUCTION", totalGangs - constructionQueue.length, totalGangs, unplacedDuringConstruction.length)) {
             return { schedule: state.schedule, conflicts: [], state, iterations: steps };
        }
    }

    // A. Tournament Selection (O(1) MRV)
    const leaderIdx = findMostConstrainedGangIdx(
        constructionQueue, state, data, gangMap, 
        teacherMap, subjectMap, classMap, roomMap
    );
    const leader = constructionQueue.splice(leaderIdx, 1)[0];
    const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
    const gangUnits = gangMap.get(gangId)!;

    // B. Find Valid Moves (O(1) Constraints + Scoring)
    const moves = findValidMoves(state, data, gangUnits, teacherMap, subjectMap, classMap, roomMap);

    if (moves.length > 0) {
      moves.sort((a, b) => b.score - a.score);
      applyGangToState(state, gangUnits, moves[0]);
    } else {
      unplacedDuringConstruction.push(leader);
    }
  }

  // --- PHASE 2: REPAIR (Min-Conflicts + Tabu Search) ---
  let repairSteps = 0;
  const MAX_REPAIR_STEPS = 2500;
  const tabu = new TabuManager(25);
  
  const repairQueue = [...unplacedDuringConstruction];
  const repairSet = new Set(repairQueue.map(u => u.jointClassId || u.electiveBlockId || u.id));

  while (repairQueue.length > 0 && repairSteps < MAX_REPAIR_STEPS) {
      repairSteps++;
      
      if (onProgress && repairSteps % 10 === 0) {
           if (!onProgress("REPAIR", repairSteps, MAX_REPAIR_STEPS, repairQueue.length)) break;
      }

      const leader = repairQueue.shift()!;
      const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
      repairSet.delete(gangId);
      const gangUnits = gangMap.get(gangId)!;

      // A. Find Best Conflict Move (Weighted Logic + Evictions)
      const bestMove = findMinConflictMove(
          state, data, gangUnits, unitMap,
          teacherMap, subjectMap, classMap, roomMap,
          tabu, repairSteps
      );

      if (bestMove.cost < Infinity) {
          // B. Evict Victims (O(1) Lookup)
          if (bestMove.evictions.size > 0) {
              bestMove.evictions.forEach(victimId => {
                  const victimUnit = unitMap.get(victimId);
                  if (victimUnit) {
                       const vGangId = victimUnit.jointClassId || victimUnit.electiveBlockId || victimUnit.id;
                       
                       const currentPlace = state.unitPlacements.get(victimId);
                       if (currentPlace) tabu.markTabu(victimId, currentPlace.d, currentPlace.p, repairSteps);

                       const vGang = gangMap.get(vGangId)!;
                       removeGangFromState(state, vGang, data);
                       
                       if (!repairSet.has(vGangId)) {
                           repairQueue.push(vGang[0]);
                           repairSet.add(vGangId);
                       }
                  }
              });
          }

          // C. Place Current Gang
          applyGangToState(state, gangUnits, bestMove);
          
      } else {
          // Hard Stuck: Return to back of queue
          repairQueue.push(leader);
          repairSet.add(gangId);
      }
  }
  
  tabu.cleanup(repairSteps);

  // Final Conflict Reporting
  const finalConflicts: Conflict[] = repairQueue.map(leader => ({
      classId: leader.classIds.join(", "),
      className: leader.classNames.join(", "),
      subjectId: leader.subjectId,
      subjectName: leader.subjectName,
      teacherName: leader.teacherNames.join(", "),
      reason: "Could not find valid slot (Oversubscribed)",
      severity: "HIGH",
      day: 0, period: 0
  }));

  return { schedule: state.schedule, conflicts: finalConflicts, state, iterations: steps + repairSteps };
};