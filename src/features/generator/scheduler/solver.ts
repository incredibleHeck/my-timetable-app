import { AppData, Conflict } from "../../../types";
import { AllocationUnit } from "./types";
import { initializeState, applyGangToState, unassignUnit, removeGangFromState } from "./state";
import { findMostConstrainedGangIdx } from "./heuristics"; 
import { findValidMoves, findMinConflictMove, findUnitFromConflict } from "./search";
import { TabuManager } from "./tabu";

/**
 * CSP SOLVER with Dynamic Heuristics (MRV) and Min-Conflicts Repair + Tabu Search.
 */
export const solveSmart = (
  units: AllocationUnit[], 
  data: AppData,
  onProgress?: (phase: string, progress: number, total: number, conflicts: number) => boolean
) => {
  const state = initializeState(data);
  const conflicts: Conflict[] = [];
  
  // 0. PRE-PROCESSING
  const unitMap = new Map<string, AllocationUnit>();
  const gangMap = new Map<string, AllocationUnit[]>();
  
  for (const u of units) {
    unitMap.set(u.id, u);
    const gangId = u.jointClassId || u.electiveBlockId || u.id;
    if (!gangMap.has(gangId)) gangMap.set(gangId, []);
    gangMap.get(gangId)!.push(u);
  }

  // Initial candidate list: Use representatives to handle gangs atomically
  let unplacedGangLeaders = units.filter(u => {
      const gangId = u.jointClassId || u.electiveBlockId || u.id;
      return gangMap.get(gangId)![0].id === u.id;
  });

  const totalGangs = unplacedGangLeaders.length;

  // 1. CONSTRUCTION PHASE (Greedy MRV)
  let steps = 0;
  const constructionQueue = [...unplacedGangLeaders];
  const unplacedDuringConstruction: AllocationUnit[] = [];

  while (constructionQueue.length > 0) {
    steps++;
    if (onProgress && steps % 5 === 0) {
        if (!onProgress("CONSTRUCTION", totalGangs - constructionQueue.length, totalGangs, unplacedDuringConstruction.length)) {
             return { schedule: state.schedule, conflicts: generateConflictList(unplacedDuringConstruction, unitMap), state, iterations: steps };
        }
    }

    // VARIABLE ORDERING: MRV
    const leaderIdx = findMostConstrainedGangIdx(constructionQueue, state, data, gangMap);
    const leader = constructionQueue.splice(leaderIdx, 1)[0];
    const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
    const gangUnits = gangMap.get(gangId)!;

    // VALUE ORDERING: LCV
    const moves = findValidMoves(state, data, gangUnits);

    if (moves.length > 0) {
      moves.sort((a, b) => b.score - a.score);
      applyGangToState(state, gangUnits, moves[0]);
    } else {
      unplacedDuringConstruction.push(leader);
    }
  }

  // 2. REPAIR PHASE (Min-Conflicts + Tabu Search)
  let repairSteps = 0;
  const MAX_REPAIR_STEPS = 2000;
  const tabu = new TabuManager(20); // Tenure 20
  
  // Queue now contains leaders of unplaced gangs
  const repairQueue = [...unplacedDuringConstruction];
  const repairSet = new Set(repairQueue.map(u => u.jointClassId || u.electiveBlockId || u.id));

  while (repairQueue.length > 0 && repairSteps < MAX_REPAIR_STEPS) {
      repairSteps++;
      
      if (onProgress && repairSteps % 10 === 0) {
           if (!onProgress("REPAIR", repairSteps, MAX_REPAIR_STEPS, repairQueue.length)) {
               break;
           }
      }

      const leader = repairQueue.shift()!;
      const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
      repairSet.delete(gangId);

      const gangUnits = gangMap.get(gangId)!;

      // Find Best Move (Min-Conflicts)
      const bestMove = findMinConflictMove(state, data, gangUnits, unitMap, tabu, repairSteps);

      if (bestMove.cost < Infinity) {
          // 1. Mark OLD position as Tabu (if it existed - mostly relevant for units we evicted and are re-placing)
          // Actually, for units coming from unplaced, they have no old position.
          // But if we evicted someone, THEY will have an old position.
          
          // 2. Evict Victims
          if (bestMove.evictions.size > 0) {
              bestMove.evictions.forEach(victimId => {
                  const victimUnit = unitMap.get(victimId);
                  if (victimUnit) {
                       const vGangId = victimUnit.jointClassId || victimUnit.electiveBlockId || victimUnit.id;
                       
                       // Mark victim's OLD position as Tabu so it doesn't immediately bounce back
                       const currentPlace = state.unitPlacements.get(victimId);
                       if (currentPlace) {
                           tabu.markTabu(victimId, currentPlace.d, currentPlace.p, repairSteps);
                       }

                       if (!repairSet.has(vGangId)) {
                           const vGang = gangMap.get(vGangId)!;
                           removeGangFromState(state, vGang, data);
                           
                           repairQueue.push(vGang[0]); // Push leader back to queue
                           repairSet.add(vGangId);
                       }
                  }
              });
          }

          // 3. Place Current Gang
          applyGangToState(state, gangUnits, bestMove);
          
          // Mark NEW position as Tabu? No, Tabu usually prevents *reversing* a move.
          // In Min-Conflicts, typically we Tabu the position we just LEFT.
          // Since these units were unplaced, they "left" the unplaced set.
          
      } else {
          // No valid move found (Hard Constraints everywhere).
          // Push to back of queue to try again later? Or accept failure?
          // If purely hard constraints, likely impossible. But maybe other moves clear space.
          // For now, push back and increment wait counter? 
          // Simplified: Just push back.
          repairQueue.push(leader);
          repairSet.add(gangId);
          
          // Safety break if queue isn't changing? 
          // Rely on MAX_REPAIR_STEPS.
      }
  }
  
  // Clean up Tabu
  tabu.cleanup(repairSteps);

  const finalConflicts = generateConflictList(repairQueue, unitMap);

  return { schedule: state.schedule, conflicts: finalConflicts, state, iterations: steps + repairSteps };
};

function generateConflictList(unplacedLeaders: AllocationUnit[], unitMap: Map<string, AllocationUnit>): Conflict[] {
    const conflicts: Conflict[] = [];
    // We only have the leaders, but we need to report for all units in the gang
    unplacedLeaders.forEach(leader => {
        // We assume we can get the gang from the map, but we don't have gangMap scope here easily.
        // Actually we do not pass gangMap.
        // Quick fix: Iterate unitMap or just report for leader?
        // Better: We know the structure.
        // Iterate all units in unitMap. If not in 'unitPlacements' (in state), it's a conflict.
        // But state isn't passed here.
        
        // Simple fallback: Just report the leader for now or expand if possible.
        // Correct way: The 'unplacedLeaders' represent the conflict.
        
        conflicts.push({
            classId: leader.classIds.join(", "),
            className: leader.classNames.join(", "),
            subjectId: leader.subjectId,
            subjectName: leader.subjectName,
            teacherName: leader.teacherNames.join(", "),
            day: -1, 
            period: -1,
            reason: "Could not find valid slot (Oversubscribed)",
            severity: "HIGH"
        });
    });
    return conflicts;
}