import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { applyGangToState, removeGangFromState } from "../core/state";
import { findMostConstrainedGangIdx, MrvCache } from "./heuristics";
import { findValidMoves } from "./search";
import {
  PRIORITY_CRITICAL,
  MAX_BACKTRACK_DEPTH,
  MAX_BACKTRACK_ATTEMPTS,
} from "../constants";
import { getGangId } from "./repair-controller";

export type ConstructionMove = {
  d: number;
  p: number;
  p2: number;
  rooms: Record<string, string>;
  score?: number;
};

export type PlacementRecord = {
  leader: AllocationUnit;
  gangId: string;
  gangUnits: AllocationUnit[];
  move: ConstructionMove;
  canBacktrack: boolean;
  /** When re-placed after backtrack, avoid this (d,p) on the next try. */
  avoidSlots: Set<string>;
};

export type ConstructionMaps = {
  data: AppData;
  gangMap: Map<string, AllocationUnit[]>;
  teacherMap: Map<string, Teacher>;
  subjectMap: Map<string, Subject>;
  classMap: Map<string, ClassGroup>;
  roomMap: Map<string, Room>;
};

export type ConstructionPhaseResult = {
  steps: number;
  gangsPlaced: number;
  unplaced: AllocationUnit[];
  backtrackAttempts: number;
};

function canBacktrackPlacement(leader: AllocationUnit): boolean {
  if (leader.priority >= PRIORITY_CRITICAL) return false;
  if (leader.jointClassId || leader.electiveBlockId) return false;
  return true;
}

/**
 * Scan the occupancy grids for slots the failed unit could structurally use
 * (teacher isn't hard-constrained away) and return the set of stack indices
 * whose placed units are actually blocking those slots.
 */
function findBlockingStackIndices(
  failedGang: AllocationUnit[],
  state: SchedulerState,
  stack: PlacementRecord[],
  maps: ConstructionMaps,
): number[] {
  const unitToStackIdx = new Map<string, number>();
  for (let i = 0; i < stack.length; i++) {
    if (!stack[i].canBacktrack) continue;
    for (const u of stack[i].gangUnits) {
      unitToStackIdx.set(u.id, i);
    }
  }

  const days = maps.data.settings.daysPerWeek ?? 5;
  const maxP = 15;
  const blockerIndices = new Set<number>();

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < maxP; p++) {
      for (const u of failedGang) {
        let teacherHardBlocked = false;
        for (const tid of u.teacherIds) {
          const teacher = maps.teacherMap.get(tid);
          if (teacher?.constraints?.[d]?.[p]) {
            teacherHardBlocked = true;
            break;
          }
        }
        if (teacherHardBlocked) continue;

        for (const tid of u.teacherIds) {
          const occupant = state.teacherOccupancy[tid]?.[d]?.[p];
          if (occupant && occupant !== "BLOCK") {
            const idx = unitToStackIdx.get(occupant);
            if (idx !== undefined) blockerIndices.add(idx);
          }
        }
        for (const cid of u.classIds) {
          const occupant = state.classOccupancy[cid]?.[d]?.[p];
          if (occupant && occupant !== "BLOCK") {
            const idx = unitToStackIdx.get(occupant);
            if (idx !== undefined) blockerIndices.add(idx);
          }
        }
      }
    }
  }

  return Array.from(blockerIndices);
}

/**
 * Conflict-directed backtracking: identify which stack entries actually block
 * the failed unit (via occupancy grids), remove them, and re-queue everything.
 * Falls back to chronological popping if no conflict-based targets are found.
 */
export function tryConstructionBacktrack(
  state: SchedulerState,
  queue: AllocationUnit[],
  failedLeader: AllocationUnit,
  stack: PlacementRecord[],
  maps: ConstructionMaps,
  backtrackAttempts: number,
): { requeued: boolean; backtrackAttempts: number } {
  if (backtrackAttempts >= MAX_BACKTRACK_ATTEMPTS || stack.length === 0) {
    return { requeued: false, backtrackAttempts };
  }

  const failedGangId = getGangId(failedLeader);
  const failedGang = maps.gangMap.get(failedGangId) ?? [failedLeader];

  let targetIndices = findBlockingStackIndices(failedGang, state, stack, maps);

  if (targetIndices.length > MAX_BACKTRACK_DEPTH) {
    targetIndices = targetIndices.slice(-MAX_BACKTRACK_DEPTH);
  }

  // Fall back to chronological if no conflict-directed targets found.
  if (targetIndices.length === 0) {
    for (
      let i = stack.length - 1;
      i >= 0 && targetIndices.length < MAX_BACKTRACK_DEPTH;
      i--
    ) {
      if (stack[i].canBacktrack) {
        targetIndices.push(i);
      }
    }
  }

  if (targetIndices.length === 0) {
    return { requeued: false, backtrackAttempts };
  }

  // Sort descending so splicing from the end keeps earlier indices stable.
  targetIndices.sort((a, b) => b - a);

  const poppedLeaders: AllocationUnit[] = [];
  for (const idx of targetIndices) {
    const record = stack[idx];
    stack.splice(idx, 1);
    removeGangFromState(state, record.gangUnits, maps.data);
    record.avoidSlots.add(`${record.move.d}-${record.move.p}`);
    poppedLeaders.push(record.leader);
    backtrackAttempts++;
  }

  queue.unshift(failedLeader, ...poppedLeaders.reverse());
  return { requeued: true, backtrackAttempts };
}

/**
 * Pick the best valid move for a gang, skipping slots it should avoid.
 */
function pickBestMove(
  moves: Array<{ d: number; p: number; p2: number; score: number; rooms: Record<string, string> }>,
  avoidSlots: Set<string>,
): typeof moves[0] | null {
  if (moves.length === 0) return null;

  moves.sort((a, b) => b.score - a.score);

  if (avoidSlots.size > 0) {
    const alternate = moves.find((m) => !avoidSlots.has(`${m.d}-${m.p}`));
    if (alternate) return alternate;
  }

  return moves[0];
}

/** Per-leader avoidance tracking within the current queue run. */
const leaderAvoidSlots = new Map<string, Set<string>>();

export function runConstructionQueue(
  queue: AllocationUnit[],
  state: SchedulerState,
  maps: ConstructionMaps,
  stack: PlacementRecord[],
  backtrackAttempts: number,
  steps: number,
  gangsPlaced: number,
  unplaced: AllocationUnit[],
  onProgress?: (
    gangsPlaced: number,
    totalGangs: number,
    unplacedCount: number,
  ) => boolean,
  totalGangs?: number,
  mrvCache?: MrvCache,
): ConstructionPhaseResult {
  leaderAvoidSlots.clear();

  while (queue.length > 0) {
    steps++;

    if (onProgress && steps % 10 === 0 && totalGangs !== undefined) {
      if (!onProgress(gangsPlaced, totalGangs, unplaced.length)) {
        return { steps, gangsPlaced, unplaced, backtrackAttempts };
      }
    }

    const leaderIdx = mrvCache
      ? mrvCache.findMostConstrainedIdx(queue, state)
      : findMostConstrainedGangIdx(
          queue,
          state,
          maps.data,
          maps.gangMap,
          maps.teacherMap,
          maps.subjectMap,
          maps.classMap,
          maps.roomMap,
        );
    const leader = queue.splice(leaderIdx, 1)[0];
    const gangId = getGangId(leader);
    const gangUnits = maps.gangMap.get(gangId)!;
    mrvCache?.removeGang(gangId);

    const moves = findValidMoves(
      state,
      maps.data,
      gangUnits,
      maps.teacherMap,
      maps.subjectMap,
      maps.classMap,
      maps.roomMap,
    );

    const avoid = leaderAvoidSlots.get(gangId) ?? new Set<string>();
    const bestMove = pickBestMove(moves, avoid);

    if (bestMove) {
      applyGangToState(state, gangUnits, bestMove);
      mrvCache?.invalidateAfterPlacement(gangUnits);
      stack.push({
        leader,
        gangId,
        gangUnits,
        move: bestMove,
        canBacktrack: canBacktrackPlacement(leader),
        avoidSlots: avoid,
      });
      gangsPlaced++;
      continue;
    }

    const backtrack = tryConstructionBacktrack(
      state,
      queue,
      leader,
      stack,
      maps,
      backtrackAttempts,
    );
    backtrackAttempts = backtrack.backtrackAttempts;

    if (backtrack.requeued) {
      mrvCache?.invalidateAll();
      for (const q of queue) {
        const qGangId = getGangId(q);
        const record = stack.find((r) => r.gangId === qGangId);
        if (record && record.avoidSlots.size > 0) {
          const existing = leaderAvoidSlots.get(qGangId);
          if (existing) {
            for (const s of record.avoidSlots) existing.add(s);
          } else {
            leaderAvoidSlots.set(qGangId, new Set(record.avoidSlots));
          }
        }
      }
      continue;
    }

    unplaced.push(leader);
  }

  return { steps, gangsPlaced, unplaced, backtrackAttempts };
}
