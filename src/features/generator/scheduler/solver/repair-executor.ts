import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { applyGangToState, removeGangFromState } from "../core/state";
import { TabuManager } from "./tabu";
import {
  getGangId,
  PlaceRepairMove,
  RepairAction,
  SlotMove,
} from "./repair-controller";

function queueEvictedVictims(
  victimIds: Iterable<string>,
  skipUnitIds: Set<string>,
  state: SchedulerState,
  repairQueue: AllocationUnit[],
  repairSet: Set<string>,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  data: AppData,
  tabu: TabuManager | undefined,
  step: number,
): void {
  for (const victimId of victimIds) {
    if (skipUnitIds.has(victimId)) continue;

    const victimUnit = unitMap.get(victimId);
    if (!victimUnit) continue;

    const vGangId = getGangId(victimUnit);
    const currentPlace = state.unitPlacements.get(victimId);

    if (tabu && currentPlace) {
      tabu.markTabu(victimId, currentPlace.d, currentPlace.p, step);
    }

    const vGang = gangMap.get(vGangId);
    if (!vGang) continue;

    removeGangFromState(state, vGang, data);

    if (!repairSet.has(vGangId)) {
      repairQueue.push(vGang[0]);
      repairQueue.sort((a, b) => b.rankLevel - a.rankLevel);
      repairSet.add(vGangId);
    }
  }
}

function applySlotMove(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: SlotMove,
  skipEvictionUnitIds: Set<string>,
  repairQueue: AllocationUnit[],
  repairSet: Set<string>,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  data: AppData,
  tabu: TabuManager | undefined,
  step: number,
): void {
  queueEvictedVictims(
    move.evictions,
    skipEvictionUnitIds,
    state,
    repairQueue,
    repairSet,
    gangMap,
    unitMap,
    data,
    tabu,
    step,
  );
  applyGangToState(state, gang, move);
  if (tabu) {
    tabu.markTabu(gang[0].id, move.d, move.p, step);
  }
}

export function executePlaceRepairMove(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: PlaceRepairMove,
  repairQueue: AllocationUnit[],
  repairSet: Set<string>,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  data: AppData,
  tabu?: TabuManager,
  step: number = 0,
): void {
  applySlotMove(
    state,
    gang,
    move,
    new Set(),
    repairQueue,
    repairSet,
    gangMap,
    unitMap,
    data,
    tabu,
    step,
  );
}

/** @deprecated Use executePlaceRepairMove or executeRepairAction */
export function executeRepairMove(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: SlotMove,
  repairQueue: AllocationUnit[],
  repairSet: Set<string>,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  data: AppData,
  tabu?: TabuManager,
  step: number = 0,
): void {
  applySlotMove(
    state,
    gang,
    move,
    new Set(),
    repairQueue,
    repairSet,
    gangMap,
    unitMap,
    data,
    tabu,
    step,
  );
}

export function executeRepairAction(
  state: SchedulerState,
  gang: AllocationUnit[],
  action: RepairAction,
  repairQueue: AllocationUnit[],
  repairSet: Set<string>,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  data: AppData,
  tabu?: TabuManager,
  step: number = 0,
): void {
  if (action.kind === "place") {
    executePlaceRepairMove(
      state,
      gang,
      action,
      repairQueue,
      repairSet,
      gangMap,
      unitMap,
      data,
      tabu,
      step,
    );
    return;
  }

  const partnerGang = gangMap.get(action.partnerGangId);
  if (!partnerGang) return;

  const partnerUnitIds = new Set(partnerGang.map((u) => u.id));
  const partnerLeader = partnerGang[0];
  const partnerPlace = state.unitPlacements.get(partnerLeader.id);

  if (tabu && partnerPlace) {
    tabu.markTabu(partnerLeader.id, partnerPlace.d, partnerPlace.p, step);
  }

  removeGangFromState(state, partnerGang, data);

  applySlotMove(
    state,
    gang,
    action.gangMove,
    partnerUnitIds,
    repairQueue,
    repairSet,
    gangMap,
    unitMap,
    data,
    tabu,
    step,
  );

  applySlotMove(
    state,
    partnerGang,
    action.partnerMove,
    new Set(),
    repairQueue,
    repairSet,
    gangMap,
    unitMap,
    data,
    tabu,
    step,
  );

  repairSet.delete(action.partnerGangId);
}

export type RepairMaps = {
  data: AppData;
  gangMap: Map<string, AllocationUnit[]>;
  unitMap: Map<string, AllocationUnit>;
  teacherMap: Map<string, Teacher>;
  subjectMap: Map<string, Subject>;
  classMap: Map<string, ClassGroup>;
  roomMap: Map<string, Room>;
};
