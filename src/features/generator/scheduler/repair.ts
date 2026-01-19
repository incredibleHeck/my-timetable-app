import { AppData, Teacher, Subject, ClassGroup } from "../../../types";
import { AllocationUnit, SchedulerState } from "./core/types";
import { findMinConflictMove, findUnitsInSlot } from "./search";
import { removeGangFromState, applyGangToState } from "./core/state";
import { TabuManager } from "./tabu"; 

/**
 * ARCHITECT NOTES:
 * 1. Performance: Removed O(N) 'validateFullSchedule' from the hot loop.
 * 2. Performance: Injected Maps for O(1) constraints.
 */

export function runMinConflictsRepair(
    state: SchedulerState, 
    problemGangIds: string[], 
    gangMap: Map<string, AllocationUnit[]>,
    unitMap: Map<string, AllocationUnit>,
    data: AppData,
    teacherMap: Map<string, Teacher>,
    subjectMap: Map<string, Subject>,
    classMap: Map<string, ClassGroup>,
    roomMap: Map<string, any>,
    maxSteps = 100,
    onProgress?: (phase: string, progress: number, total: number) => void
) {
    // 1. Initialize Queue
    let queue = [...problemGangIds];
    const queuedSet = new Set(queue);
    
    // Optional: Tabu for this specific run
    const tabu = new TabuManager(10); 

    for (let step = 0; step < maxSteps; step++) {
        // Progress Reporting
        if (onProgress && step % 10 === 0) {
            onProgress("REPAIR", step, maxSteps);
        }

        // 2. Success Condition
        if (queue.length === 0) {
            break;
        }

        const gangId = queue.shift()!;
        queuedSet.delete(gangId);
        
        const gang = gangMap.get(gangId);
        if (!gang) continue;

        // 3. Find Best Move (O(1))
        const bestMove = findMinConflictMove(
            state, data, gang, unitMap, 
            teacherMap, subjectMap, classMap, roomMap,
            tabu, step
        );

        // 4. Execute (if valid)
        if (bestMove.cost < Infinity) {
            executeRepairMove(
                state, gang, bestMove, 
                queue, queuedSet, 
                gangMap, unitMap, data,
                tabu, step
            );
        } else {
            // Stuck? Push back to try later
            queue.push(gangId);
            queuedSet.add(gangId);
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
    data: AppData,
    tabu?: TabuManager,
    step: number = 0
) {
    const { d, p, p2 } = move;

    // 1. Identify Victims
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
            
            // Mark Tabu: Prevent victim from immediately returning to this slot
            if (tabu) {
                const currentPlace = state.unitPlacements.get(victimUnitId);
                if (currentPlace) {
                    tabu.markTabu(victimUnitId, currentPlace.d, currentPlace.p, step);
                }
            }

            if (!queuedSet.has(vGangId)) {
                const vGang = gangMap.get(vGangId);
                if (vGang) {
                    removeGangFromState(state, vGang, data);
                    queue.push(vGangId);
                    queuedSet.add(vGangId);
                }
            }
        }
    });

    // 3. Place Gang
    applyGangToState(state, gang, move);
}

/**
 * BACKTRACKING LITE: Attempt to place by force (Used by UI actions)
 */
export function attemptGangEviction(
    gang: AllocationUnit[],
    state: SchedulerState,
    data: AppData,
    unitMap: Map<string, AllocationUnit>,
    gangMap: Map<string, AllocationUnit[]>,
    teacherMap: Map<string, Teacher>,
    subjectMap: Map<string, Subject>,
    classMap: Map<string, ClassGroup>,
    roomMap: Map<string, any>
): string[] {
    
    // O(1) Search
    const bestMove = findMinConflictMove(
        state, data, gang, unitMap, 
        teacherMap, subjectMap, classMap, roomMap
    );
    
    // Threshold: Only evict if manageable
    if (bestMove.cost > 0 && bestMove.cost <= 3000) { 
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
        
        applyGangToState(state, gang, bestMove);
        return Array.from(evictedGangIds);
    }
    
    return [];
}