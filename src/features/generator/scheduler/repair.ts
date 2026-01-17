import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { validateFullSchedule } from "./validation";
import { findUnitFromConflict, findMinConflictMove, findUnitsInSlot } from "./search";
import { removeGangFromState, applyGangToState } from "./state";

/**
 * REPAIR PHASE: Targeted conflict resolution (Min-Conflicts)
 */
export function runMinConflictsRepair(
    state: SchedulerState, 
    problemGangIds: string[], 
    gangMap: Map<string, AllocationUnit[]>,
    unitMap: Map<string, AllocationUnit>,
    data: AppData,
    maxSteps = 100,
    onProgress?: (phase: string, progress: number, total: number) => void
) {
    let queue = [...problemGangIds];
    const queuedSet = new Set(queue);

    for (let step = 0; step < maxSteps; step++) {
        if (onProgress && step % 10 === 0) {
            onProgress("REPAIR", step, maxSteps);
        }

        if (queue.length === 0) {
            // If queue is empty, check if any NEW conflicts arose from validation
            const globalConflicts = validateFullSchedule({ ...data, schedule: state.schedule }, state);
            if (globalConflicts.length === 0) break;

            // Add random conflicted unit to queue
            const randomConflict = globalConflicts[Math.floor(Math.random() * globalConflicts.length)];
            const unit = findUnitFromConflict(randomConflict, unitMap);
            if (unit) {
                const gid = unit.jointClassId || unit.electiveBlockId || unit.id;
                if (!queuedSet.has(gid)) {
                    queue.push(gid);
                    queuedSet.add(gid);
                }
            }
            if (queue.length === 0) break; // Still empty? Done.
        }

        const gangId = queue.shift()!;
        queuedSet.delete(gangId);
        
        const gang = gangMap.get(gangId);
        if (!gang) continue;

        // Min-Conflicts: Find slot with minimum EVICTIONS
        const bestMove = findMinConflictMove(state, data, gang, unitMap);

        if (bestMove && bestMove.cost < Infinity) {
            executeRepairMove(state, gang, bestMove, queue, queuedSet, gangMap, unitMap, data);
        }
    }
}

/**
 * EXECUTE REPAIR MOVE: Evicts victims and places the gang.
 */
function executeRepairMove(
    state: SchedulerState,
    gang: AllocationUnit[],
    move: { d: number; p: number; p2: number; rooms: Record<string, string> },
    queue: string[],
    queuedSet: Set<string>,
    gangMap: Map<string, AllocationUnit[]>,
    unitMap: Map<string, AllocationUnit>,
    data: AppData
) {
    const { d, p, p2 } = move;

    // 1. Identify Victims (Robust Re-Check)
    const allVictimIds = new Set<string>();
    gang.forEach(u => {
        const victims = findUnitsInSlot(state, u, d, p, p2);
        victims.forEach(v => allVictimIds.add(v));
    });

    // 2. Evict Victims
    allVictimIds.forEach(victimUnitId => {
        const vUnit = unitMap.get(victimUnitId);
        if (vUnit) {
            const vGangId = vUnit.jointClassId || vUnit.electiveBlockId || vUnit.id;
            if (!queuedSet.has(vGangId)) {
                // Remove the victim gang from the board
                removeGangFromState(state, gangMap.get(vGangId)!, data);
                // Add to queue to be re-scheduled
                queue.push(vGangId);
                queuedSet.add(vGangId);
            }
        }
    });

    // 3. Place Gang (Now that space is cleared)
    applyGangToState(state, gang, move);
}

/**
 * BACKTRACKING LITE: Attempts to place a gang by evicting conflicting units.
 */
export function attemptGangEviction(
    gang: AllocationUnit[],
    state: SchedulerState,
    data: AppData,
    unitMap: Map<string, AllocationUnit>,
    gangMap: Map<string, AllocationUnit[]>
): string[] {
    // Use Min-Conflicts heuristic to find best place to force-enter
    const bestMove = findMinConflictMove(state, data, gang, unitMap);
    
    // Threshold: Only evict if it costs less than 3 other gangs
    // This prevents massive cascading evictions that might never resolve.
    if (bestMove && bestMove.cost > 0 && bestMove.cost <= 3) {
        const evictedGangIds = new Set<string>();
        
        bestMove.evictions.forEach(victimUnitId => {
            const vUnit = unitMap.get(victimUnitId);
            if (vUnit) {
                const vGid = vUnit.jointClassId || vUnit.electiveBlockId || vUnit.id;
                if (!evictedGangIds.has(vGid)) {
                    evictedGangIds.add(vGid);
                    removeGangFromState(state, gangMap.get(vGid)!, data);
                }
            }
        });
        
        // Place our gang
        applyGangToState(state, gang, bestMove);
        return Array.from(evictedGangIds);
    }
    
    return [];
}
