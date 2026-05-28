import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { findMinConflictMove, findBestRepairMove } from "./search";
import { removeGangFromState, applyGangToState } from "../core/state";
import { TabuManager } from "./tabu";
import {
  RepairController,
  countUnplacedGangs,
  diversifyRepairState,
  getGangId,
  isRepairActionFailed,
} from "./repair-controller";
import { executeRepairAction } from "./repair-executor";
import { MAX_REPAIR_STEPS } from "../constants";

/**
 * ARCHITECT NOTES:
 * 1. Performance: Removed O(N) 'validateFullSchedule' from the hot loop.
 * 2. Performance: Injected Maps for O(1) constraints.
 * 3. Stagnation: RepairController avoids infinite re-queue loops.
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
  roomMap: Map<string, Room>,
  maxSteps = MAX_REPAIR_STEPS,
  onProgress?: (phase: string, progress: number, total: number) => void,
) {
  const repairQueue: AllocationUnit[] = problemGangIds
    .map((id) => gangMap.get(id)?.[0])
    .filter((leader): leader is AllocationUnit => !!leader);
  const repairSet = new Set(repairQueue.map((u) => getGangId(u)));
  const tabu = new TabuManager();
  const controller = new RepairController(repairQueue.length);

  tabu.adaptToSize(repairQueue.length);

  for (let step = 0; step < maxSteps && repairQueue.length > 0; step++) {
    if (onProgress && step % 10 === 0) {
      onProgress("REPAIR", step, maxSteps);
    }

    const leader = repairQueue.shift()!;
    const gangId = getGangId(leader);
    repairSet.delete(gangId);
    tabu.recordGangAttempt(gangId);

    if (controller.shouldSkipGang(gangId)) {
      controller.recordProgress(countUnplacedGangs(repairQueue, controller));
      continue;
    }

    const gang = gangMap.get(gangId);
    if (!gang) continue;

    const repairAction = findBestRepairMove(
      state,
      data,
      gang,
      gangMap,
      unitMap,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      tabu,
      step,
    );

    if (!isRepairActionFailed(repairAction)) {
      controller.recordSuccess(gangId);
      executeRepairAction(
        state,
        gang,
        repairAction,
        repairQueue,
        repairSet,
        gangMap,
        unitMap,
        data,
        tabu,
        step,
      );
    } else {
      controller.recordFailedAttempt(gangId, leader);
      if (!controller.shouldSkipGang(gangId)) {
        repairQueue.push(leader);
        repairSet.add(gangId);
      }
    }

    controller.recordProgress(countUnplacedGangs(repairQueue, controller));

    if (controller.shouldDiversify()) {
      const shaken = diversifyRepairState(state, data, gangMap, unitMap, repairQueue, repairSet);
      if (shaken > 0) {
        controller.resetStagnation();
        controller.recordProgress(countUnplacedGangs(repairQueue, controller));
      }
    }
  }
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
  roomMap: Map<string, Room>,
): string[] {
  const bestMove = findMinConflictMove(
    state,
    data,
    gang,
    unitMap,
    teacherMap,
    subjectMap,
    classMap,
    roomMap,
  );

  if (bestMove.cost > 0 && bestMove.cost <= 3000) {
    const evictedGangIds = new Set<string>();

    bestMove.evictions.forEach((victimUnitId) => {
      const vUnit = unitMap.get(victimUnitId);
      if (vUnit) {
        const vGid = getGangId(vUnit);
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
