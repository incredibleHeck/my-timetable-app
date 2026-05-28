import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { checkImmutableConstraints } from "../logic/constraints";
import { determineRoom, forceDetermineRoom } from "../logic/rooms";
import { calculateScore } from "../logic/scoring";
import { getNextClassPeriod, getPeriodType, getDaysPerWeek } from "../utils/utils";
import { EvaluationEngine } from "../logic/evaluation";
import { findUnitsInSlot } from "./slot-conflicts";
import { TabuManager } from "./tabu";
import {
  PRIORITY_CRITICAL,
  PENALTY_TABU_MOVE,
  MAX_SWAP_ATTEMPTS,
  REPAIR_SWAP_PENALTY,
  MAX_CHAIN_DEPTH,
  REPAIR_CHAIN_PENALTY,
} from "../constants";
import {
  getGangId,
  PlaceRepairMove,
  RepairAction,
  SlotMove,
  SwapRepairMove,
  ChainRepairMove,
} from "./repair-controller";
import { applyGangToState, removeGangFromState } from "../core/state";

const evaluator = new EvaluationEngine();

// --- 1. CONSTRUCTION PHASE (Valid Moves) ---

export function findValidMoves(
  state: SchedulerState,
  data: AppData,
  gangUnits: AllocationUnit[],
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
) {
  const globalPeriods = data.settings.periodsPerDay;
  const maxPossiblePeriods = 15; // Support up to 15 periods as per UI limits
  const days = getDaysPerWeek(data.settings);
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
          gangValid = false;
          break;
        }

        let p2: number | null = -1;
        if (u.duration === 2) {
          const next = getNextClassPeriod(p, struct, classLimit);
          if (next === null) {
            gangValid = false;
            break;
          }
          p2 = next;
        }
        sharedP2 = p2;

        // RANK 1: Evaluation
        const evalResult = evaluator.evaluate(
          state,
          data,
          { d, p, p2 },
          u,
          teacherMap,
          subjectMap,
          classMap,
          roomMap,
        );
        if (!evalResult.isLegal) {
          gangValid = false;
          break;
        }

        // 3. Room Assignment
        const rId = determineRoom(d, p, p2, u, state, data, subjectMap, classMap, roomMap);
        if (!rId) {
          gangValid = false;
          break;
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

const FAILED_SLOT_MOVE: SlotMove = {
  d: -1,
  p: -1,
  p2: -1,
  cost: Infinity,
  score: -Infinity,
  evictions: new Set(),
  rooms: {},
};

export function evaluateGangAtSlot(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  d: number,
  p: number,
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  tabu?: TabuManager,
  iteration: number = 0,
  bestKnownCost: number = Infinity,
): SlotMove {
  const globalPeriods = data.settings.periodsPerDay;
  let possible = true;
  const currentRooms: Record<string, string> = {};
  let totalPenalty = 0;
  let sharedP2 = -1;
  const primaryUnit = gang[0];

  for (const u of gang) {
    const cls = classMap.get(u.classIds[0]);
    const struct = cls?.structure || data.settings.dayStructure;
    const classLimit = cls?.periodCount ?? globalPeriods;

    if (p >= classLimit || getPeriodType(struct, p) !== "CLASS") {
      possible = false;
      break;
    }

    let p2: number | null = -1;
    if (u.duration === 2) {
      p2 = getNextClassPeriod(p, struct, classLimit) ?? -1;
      if (p2 === -1) {
        possible = false;
        break;
      }
    }
    sharedP2 = p2;

    if (!checkImmutableConstraints(d, p, p2, u, data, teacherMap, classMap)) {
      possible = false;
      break;
    }

    const evalResult = evaluator.evaluateMove(
      state,
      data,
      u,
      d,
      p,
      teacherMap,
      subjectMap,
      classMap,
      roomMap,
      unitMap,
    );
    if (!evalResult.isLegal) {
      possible = false;
      break;
    }
    totalPenalty += evalResult.totalCost;

    const rId = forceDetermineRoom(d, p, p2, u, state, data, subjectMap, classMap, roomMap);
    if (!rId) {
      possible = false;
      break;
    }
    currentRooms[u.id] = rId;
  }

  if (!possible) return FAILED_SLOT_MOVE;

  if (tabu?.shouldPenalizeTabu(primaryUnit.id, d, p, iteration, totalPenalty, bestKnownCost)) {
    totalPenalty += PENALTY_TABU_MOVE;
  }

  const score = calculateScore(state, data, d, p, primaryUnit, teacherMap, subjectMap);
  const evictions = new Set<string>();
  gang.forEach((gUnit) => {
    findUnitsInSlot(state, gUnit, d, p, sharedP2, subjectMap, classMap, roomMap).forEach((v) =>
      evictions.add(v),
    );
  });

  return {
    d,
    p,
    p2: sharedP2,
    cost: totalPenalty,
    score,
    evictions,
    rooms: currentRooms,
  };
}

function getSinglePartnerGangAtSlot(
  state: SchedulerState,
  gang: AllocationUnit[],
  d: number,
  p: number,
  p2: number,
  unitMap: Map<string, AllocationUnit>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
): string | null {
  const victimGangIds = new Set<string>();

  gang.forEach((unit) => {
    findUnitsInSlot(state, unit, d, p, p2, subjectMap, classMap, roomMap).forEach((victimId) => {
      const victimUnit = unitMap.get(victimId);
      if (victimUnit) victimGangIds.add(getGangId(victimUnit));
    });
  });

  if (victimGangIds.size !== 1) return null;
  return [...victimGangIds][0];
}

type SavedGangPlacement = {
  d: number;
  p: number;
  p2: number;
  rooms: Record<string, string>;
};

function saveGangPlacement(
  state: SchedulerState,
  gang: AllocationUnit[],
): SavedGangPlacement | null {
  const placement = state.unitPlacements.get(gang[0].id);
  if (!placement) return null;
  return {
    d: placement.d,
    p: placement.p,
    p2: placement.p2,
    rooms: { ...placement.rooms },
  };
}

function restoreGangPlacement(
  state: SchedulerState,
  gang: AllocationUnit[],
  saved: SavedGangPlacement,
  data: AppData,
): void {
  applyGangToState(state, gang, saved);
}

export function findMinConflictMove(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  tabu?: TabuManager,
  iteration: number = 0,
): SlotMove {
  const globalPeriods = data.settings.periodsPerDay;
  const maxPossiblePeriods = 15;
  const days = getDaysPerWeek(data.settings);

  let bestMove = {
    ...FAILED_SLOT_MOVE,
    evictions: new Set<string>(),
    rooms: {} as Record<string, string>,
  };

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < maxPossiblePeriods; p++) {
      const slotMove = evaluateGangAtSlot(
        state,
        data,
        gang,
        d,
        p,
        unitMap,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
        tabu,
        iteration,
        bestMove.cost,
      );

      if (slotMove.cost >= Infinity) continue;

      if (
        slotMove.cost < bestMove.cost ||
        (slotMove.cost === bestMove.cost && slotMove.score > bestMove.score)
      ) {
        bestMove = slotMove;
      }

      if (slotMove.cost === 0) return slotMove;
    }
  }

  return bestMove;
}

function resolveSlotP2(
  gang: AllocationUnit[],
  p: number,
  classMap: Map<string, ClassGroup>,
  data: AppData,
): number {
  const unit = gang[0];
  const cls = classMap.get(unit.classIds[0]);
  const struct = cls?.structure || data.settings.dayStructure;
  const classLimit = cls?.periodCount ?? data.settings.periodsPerDay;
  if (unit.duration !== 2) return -1;
  return getNextClassPeriod(p, struct, classLimit) ?? -1;
}

export function findSwapMove(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  tabu?: TabuManager,
  iteration: number = 0,
): SwapRepairMove | null {
  const maxPossiblePeriods = 15;
  const days = getDaysPerWeek(data.settings);
  let bestSwap: SwapRepairMove | null = null;
  let attempts = 0;

  for (let d = 0; d < days && attempts < MAX_SWAP_ATTEMPTS; d++) {
    for (let p = 0; p < maxPossiblePeriods && attempts < MAX_SWAP_ATTEMPTS; p++) {
      const p2 = resolveSlotP2(gang, p, classMap, data);
      if (gang[0].duration === 2 && p2 === -1) continue;

      const partnerGangId = getSinglePartnerGangAtSlot(
        state,
        gang,
        d,
        p,
        p2,
        unitMap,
        subjectMap,
        classMap,
        roomMap,
      );
      if (!partnerGangId) continue;

      const partnerGang = gangMap.get(partnerGangId);
      if (!partnerGang) continue;
      if (partnerGang[0].priority >= PRIORITY_CRITICAL) continue;

      attempts++;

      const partnerSaved = saveGangPlacement(state, partnerGang);
      if (!partnerSaved) continue;

      removeGangFromState(state, partnerGang, data);

      const gangMove = evaluateGangAtSlot(
        state,
        data,
        gang,
        d,
        p,
        unitMap,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
        tabu,
        iteration,
      );

      if (gangMove.cost >= Infinity) {
        restoreGangPlacement(state, partnerGang, partnerSaved, data);
        continue;
      }

      applyGangToState(state, gang, gangMove);

      const partnerMove = findMinConflictMove(
        state,
        data,
        partnerGang,
        unitMap,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
        tabu,
        iteration,
      );

      removeGangFromState(state, gang, data);
      restoreGangPlacement(state, partnerGang, partnerSaved, data);

      if (partnerMove.cost >= Infinity) continue;

      const totalCost = gangMove.cost + partnerMove.cost + REPAIR_SWAP_PENALTY;
      const totalScore = gangMove.score + partnerMove.score;

      if (!bestSwap || totalCost < bestSwap.cost) {
        bestSwap = {
          kind: "swap",
          partnerGangId,
          gangMove,
          partnerMove,
          cost: totalCost,
          score: totalScore,
        };
      }
    }
  }

  return bestSwap;
}

function uniqueVictimGangIds(
  victimUnitIds: Iterable<string>,
  unitMap: Map<string, AllocationUnit>,
): string[] {
  const gangIds = new Set<string>();
  for (const unitId of victimUnitIds) {
    const unit = unitMap.get(unitId);
    if (unit) gangIds.add(getGangId(unit));
  }
  return [...gangIds];
}

function tryRelocateEvictedGangs(
  state: SchedulerState,
  gangIds: string[],
  depth: number,
  data: AppData,
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  tabu: TabuManager | undefined,
  iteration: number,
): { relocations: ChainRepairMove["relocations"]; cost: number; score: number } | null {
  if (gangIds.length === 0) {
    return { relocations: [], cost: 0, score: 0 };
  }
  if (depth > MAX_CHAIN_DEPTH) return null;

  const gangId = gangIds[0];
  const remaining = gangIds.slice(1);
  const gang = gangMap.get(gangId);
  if (!gang) return null;

  const move = findMinConflictMove(
    state,
    data,
    gang,
    unitMap,
    teacherMap,
    subjectMap,
    classMap,
    roomMap,
    tabu,
    iteration,
  );
  if (move.cost >= Infinity) return null;

  const nestedVictims = uniqueVictimGangIds(move.evictions, unitMap).filter(
    (id) => id !== gangId && !remaining.includes(id),
  );

  removeGangFromState(state, gang, data);
  for (const victimId of move.evictions) {
    const victimUnit = unitMap.get(victimId);
    if (!victimUnit) continue;
    const victimGang = gangMap.get(getGangId(victimUnit));
    if (victimGang) removeGangFromState(state, victimGang, data);
  }
  applyGangToState(state, gang, move);

  const nested = tryRelocateEvictedGangs(
    state,
    [...remaining, ...nestedVictims],
    depth + 1,
    data,
    gangMap,
    unitMap,
    teacherMap,
    subjectMap,
    classMap,
    roomMap,
    tabu,
    iteration,
  );

  removeGangFromState(state, gang, data);
  for (const victimId of move.evictions) {
    const victimUnit = unitMap.get(victimId);
    if (!victimUnit) continue;
    const victimGang = gangMap.get(getGangId(victimUnit));
    if (victimGang) removeGangFromState(state, victimGang, data);
  }

  if (!nested) return null;

  return {
    relocations: [{ gangId, move }, ...nested.relocations],
    cost: move.cost + nested.cost,
    score: move.score + nested.score,
  };
}

export function findChainRepairMove(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  tabu: TabuManager | undefined,
  iteration: number,
): ChainRepairMove | null {
  const days = getDaysPerWeek(data.settings);
  const maxPossiblePeriods = 15;
  let best: ChainRepairMove | null = null;

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < maxPossiblePeriods; p++) {
      const gangMove = evaluateGangAtSlot(
        state,
        data,
        gang,
        d,
        p,
        unitMap,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
        tabu,
        iteration,
        best?.cost ?? Infinity,
      );

      if (gangMove.cost >= Infinity || gangMove.evictions.size === 0) continue;

      const victimGangIds = uniqueVictimGangIds(gangMove.evictions, unitMap);
      if (victimGangIds.length === 0) continue;

      const involvedGangIds = [getGangId(gang[0]), ...victimGangIds];
      const snapshots = new Map<string, SavedGangPlacement | null>();
      for (const gangId of involvedGangIds) {
        const g = gangMap.get(gangId);
        snapshots.set(gangId, g ? saveGangPlacement(state, g) : null);
      }

      for (const gangId of involvedGangIds) {
        const g = gangMap.get(gangId);
        if (g) removeGangFromState(state, g, data);
      }

      applyGangToState(state, gang, gangMove);

      const nested = tryRelocateEvictedGangs(
        state,
        victimGangIds,
        1,
        data,
        gangMap,
        unitMap,
        teacherMap,
        subjectMap,
        classMap,
        roomMap,
        tabu,
        iteration,
      );

      for (const gangId of involvedGangIds) {
        const g = gangMap.get(gangId);
        if (g) removeGangFromState(state, g, data);
      }
      for (const [gangId, snapshot] of snapshots) {
        const g = gangMap.get(gangId);
        if (g && snapshot) restoreGangPlacement(state, g, snapshot, data);
      }

      if (!nested) continue;

      const totalCost =
        gangMove.cost + nested.cost + REPAIR_CHAIN_PENALTY * nested.relocations.length;
      const totalScore = gangMove.score + nested.score;

      if (!best || totalCost < best.cost) {
        best = {
          kind: "chain",
          gangMove,
          relocations: nested.relocations,
          cost: totalCost,
          score: totalScore,
        };
      }
    }
  }

  return best;
}

export function findBestRepairMove(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  gangMap: Map<string, AllocationUnit[]>,
  unitMap: Map<string, AllocationUnit>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
  tabu?: TabuManager,
  iteration: number = 0,
): RepairAction {
  const placeMove = findMinConflictMove(
    state,
    data,
    gang,
    unitMap,
    teacherMap,
    subjectMap,
    classMap,
    roomMap,
    tabu,
    iteration,
  );

  const chainMove = findChainRepairMove(
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
    iteration,
  );

  const swapMove = findSwapMove(
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
    iteration,
  );

  const candidates: RepairAction[] = [];
  if (placeMove.cost < Infinity) {
    candidates.push({ kind: "place", ...placeMove });
  }
  if (chainMove) candidates.push(chainMove);
  if (swapMove) candidates.push(swapMove);

  if (candidates.length === 0) {
    return { kind: "place", ...FAILED_SLOT_MOVE, evictions: new Set(), rooms: {} };
  }

  candidates.sort((a, b) => {
    if (a.cost !== b.cost) return a.cost - b.cost;
    return b.score - a.score;
  });

  return candidates[0];
}

export {
  findUnitsInSlot,
  collectEvictions,
  countPotentialConflicts,
  findUnitFromConflict,
} from "./slot-conflicts";
