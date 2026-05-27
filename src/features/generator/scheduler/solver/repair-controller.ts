import { AllocationUnit, SchedulerState } from "../core/types";
import { removeGangFromState } from "../core/state";
import { AppData } from "../../../../types";
import {
  PRIORITY_CRITICAL,
  REPAIR_STAGNATION_LIMIT,
  MAX_GANG_REPAIR_ATTEMPTS,
  REPAIR_DIVERSIFY_REMOVES,
} from "../constants";

export type SlotMove = {
  d: number;
  p: number;
  p2: number;
  cost: number;
  score: number;
  evictions: Set<string>;
  rooms: Record<string, string>;
};

export type PlaceRepairMove = SlotMove & { kind: "place" };

export type SwapRepairMove = {
  kind: "swap";
  partnerGangId: string;
  gangMove: SlotMove;
  partnerMove: SlotMove;
  cost: number;
  score: number;
};

export type ChainRepairMove = {
  kind: "chain";
  gangMove: SlotMove;
  relocations: Array<{ gangId: string; move: SlotMove }>;
  cost: number;
  score: number;
};

export type RepairAction = PlaceRepairMove | SwapRepairMove | ChainRepairMove;

/** @deprecated Use SlotMove / RepairAction instead */
export interface RepairMove {
  d: number;
  p: number;
  p2: number;
  rooms: Record<string, string>;
  evictions: Set<string>;
}

export function isRepairActionFailed(action: RepairAction): boolean {
  return action.cost >= Infinity;
}

export class RepairController {
  private bestUnplaced: number;
  private stagnationSteps = 0;
  private gangAttempts = new Map<string, number>();
  private abandonedGangIds = new Set<string>();
  private abandonedLeaders: AllocationUnit[] = [];

  constructor(initialUnplaced: number) {
    this.bestUnplaced = initialUnplaced;
  }

  get abandonedCount(): number {
    return this.abandonedGangIds.size;
  }

  get abandonedLeadersList(): AllocationUnit[] {
    return this.abandonedLeaders;
  }

  getBestUnplaced(): number {
    return this.bestUnplaced;
  }

  isAbandoned(gangId: string): boolean {
    return this.abandonedGangIds.has(gangId);
  }

  shouldSkipGang(gangId: string): boolean {
    return this.abandonedGangIds.has(gangId);
  }

  recordProgress(unplacedCount: number): void {
    if (unplacedCount < this.bestUnplaced) {
      this.bestUnplaced = unplacedCount;
      this.stagnationSteps = 0;
      return;
    }
    this.stagnationSteps++;
  }

  shouldDiversify(): boolean {
    return this.stagnationSteps >= REPAIR_STAGNATION_LIMIT;
  }

  resetStagnation(): void {
    this.stagnationSteps = 0;
  }

  recordFailedAttempt(gangId: string, leader?: AllocationUnit): void {
    const attempts = (this.gangAttempts.get(gangId) || 0) + 1;
    this.gangAttempts.set(gangId, attempts);
    if (attempts >= MAX_GANG_REPAIR_ATTEMPTS) {
      this.abandonedGangIds.add(gangId);
      if (leader) this.abandonedLeaders.push(leader);
    }
  }

  recordSuccess(gangId: string): void {
    this.gangAttempts.delete(gangId);
    this.abandonedGangIds.delete(gangId);
  }
}

export function getGangId(unit: AllocationUnit): string {
  return unit.jointClassId || unit.electiveBlockId || unit.id;
}

export function countUnplacedGangs(
  repairQueue: AllocationUnit[],
  controller: RepairController,
): number {
  return repairQueue.length + controller.abandonedCount;
}

/** Gang leaders with at least one unit missing from the committed state. */
export function countUnplacedGangLeaders(
  gangLeaders: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  state: SchedulerState,
): number {
  let count = 0;
  for (const leader of gangLeaders) {
    const gangUnits = gangMap.get(getGangId(leader));
    if (!gangUnits) continue;
    if (!gangUnits.every((u) => state.unitPlacements.has(u.id))) {
      count++;
    }
  }
  return count;
}

/**
 * Shakes the schedule by removing low-priority placed gangs and re-queuing them.
 */
export function diversifyRepairState(
  state: SchedulerState,
  data: AppData,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  repairQueue: AllocationUnit[],
  repairSet: Set<string>,
): number {
  const candidates: { gangId: string; leader: AllocationUnit; priority: number }[] =
    [];
  const seen = new Set<string>();

  for (const unitId of state.unitPlacements.keys()) {
    const unit = unitMap.get(unitId);
    if (!unit) continue;

    const gangId = getGangId(unit);
    if (seen.has(gangId) || repairSet.has(gangId)) continue;
    if (unit.priority >= PRIORITY_CRITICAL) continue;

    seen.add(gangId);
    const gang = gangMap.get(gangId);
    if (gang) {
      candidates.push({ gangId, leader: gang[0], priority: gang[0].priority });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority);

  let removed = 0;
  for (let i = 0; i < Math.min(REPAIR_DIVERSIFY_REMOVES, candidates.length); i++) {
    const { gangId, leader } = candidates[i];
    const gang = gangMap.get(gangId);
    if (!gang) continue;

    removeGangFromState(state, gang, data);
    if (!repairSet.has(gangId)) {
      repairQueue.push(leader);
      repairSet.add(gangId);
      removed++;
    }
  }

  if (removed > 0) {
    repairQueue.sort((a, b) => b.rankLevel - a.rankLevel);
  }

  return removed;
}
