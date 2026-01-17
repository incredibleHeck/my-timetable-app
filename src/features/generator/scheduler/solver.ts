import { AppData, Conflict } from "../../../types";
import { AllocationUnit } from "./types";
import { initializeState, applyGangToState } from "./state";
import { findMostConstrainedGangIdx } from "./heuristics"; 
import { findValidMoves, findUnitFromConflict } from "./search";
import { attemptGangEviction, runMinConflictsRepair } from "./repair";

/**
 * CSP SOLVER with Dynamic Heuristics (MRV) and Backtracking Lite (Eviction).
 * This replaces the previous greedy model with a dynamic ordering and repair mechanism.
 */
export const solveSmart = (
  units: AllocationUnit[], 
  data: AppData,
  onProgress?: (phase: string, progress: number, total: number) => void
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

  // Safety valve for infinite eviction loops
  let evictionCount = 0;
  const MAX_EVICTIONS = units.length * 2;

  // 1. DYNAMIC CONSTRUCTION LOOP (MRV Strategy)
  let steps = 0;
  while (unplacedGangLeaders.length > 0) {
    steps++;
    if (onProgress && steps % 5 === 0) {
        onProgress("CONSTRUCTION", totalGangs - unplacedGangLeaders.length, totalGangs);
    }

    // VARIABLE ORDERING: MRV (Minimum Remaining Values)
    // Select the gang with the smallest current domain (valid slots left)
    const leaderIdx = findMostConstrainedGangIdx(unplacedGangLeaders, state, data, gangMap);
    const leader = unplacedGangLeaders.splice(leaderIdx, 1)[0];
    const gangId = leader.jointClassId || leader.electiveBlockId || leader.id;
    const gangUnits = gangMap.get(gangId)!;

    // VALUE ORDERING: LCV (Least Constraining Value)
    // Find valid slots, sorted by pedagogical and scarcity scores
    const moves = findValidMoves(state, data, gangUnits);

    if (moves.length > 0) {
      // Pick best move (Greedy Best-First)
      moves.sort((a, b) => b.score - a.score);
      applyGangToState(state, gangUnits, moves[0]);
    } else {
      // REPAIR PHASE: Backtracking Lite (Eviction)
      // If we can't place it, see if evicting a lower-priority or few conflicting units helps.
      if (evictionCount < MAX_EVICTIONS) {
          const evictedGids = attemptGangEviction(gangUnits, state, data, unitMap, gangMap);
          if (evictedGids.length > 0) {
              // Add evicted units back to the queue
              evictedGids.forEach(gid => {
                  const victimLeader = gangMap.get(gid)![0];
                  unplacedGangLeaders.push(victimLeader);
              });
              evictionCount += evictedGids.length;
              continue; 
          }
      }

      // HARD FAILURE: Record conflict for unplaced units
      gangUnits.forEach(u => {
          conflicts.push({
            classId: u.classIds.join(", "),
            className: u.classNames.join(", "),
            subjectId: u.subjectId,
            subjectName: u.subjectName,
            teacherName: u.teacherNames.join(", "),
            day: -1,
            period: -1,
            reason: "Could not place unit (Constraint Lock)",
            severity: "HIGH"
          });
      });
    }
  }

  // 2. REPAIR PHASE (Min-Conflicts)
  // If we have conflicts (unplaced units), run iterative repair
  if (conflicts.length > 0) {
      const conflictedGangIds = new Set<string>();
      conflicts.forEach(c => {
          const unit = findUnitFromConflict(c, unitMap);
          if (unit) {
              const gid = unit.jointClassId || unit.electiveBlockId || unit.id;
              conflictedGangIds.add(gid);
          }
      });

      if (conflictedGangIds.size > 0) {
          // Run Min-Conflicts on these specific problem gangs
          runMinConflictsRepair(state, Array.from(conflictedGangIds), gangMap, unitMap, data, 500, onProgress);
      }
  }

  return { schedule: state.schedule, conflicts };
};
