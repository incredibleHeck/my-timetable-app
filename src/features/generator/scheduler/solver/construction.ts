import { AppData, Teacher, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { applyGangToState, removeGangFromState } from "../core/state";
import { findMostConstrainedGangIdx } from "./heuristics";
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
};

export type PlacementRecord = {
  leader: AllocationUnit;
  gangId: string;
  gangUnits: AllocationUnit[];
  move: ConstructionMove;
  canBacktrack: boolean;
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

  const poppedLeaders: AllocationUnit[] = [];
  let popped = 0;

  while (popped < MAX_BACKTRACK_DEPTH && stack.length > 0) {
    const record = stack[stack.length - 1];
    if (!record.canBacktrack) break;

    stack.pop();
    removeGangFromState(state, record.gangUnits, maps.data);
    poppedLeaders.push(record.leader);
    popped++;
    backtrackAttempts++;
  }

  if (popped === 0) {
    return { requeued: false, backtrackAttempts };
  }

  queue.unshift(failedLeader, ...poppedLeaders.reverse());
  return { requeued: true, backtrackAttempts };
}

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
): ConstructionPhaseResult {
  while (queue.length > 0) {
    steps++;

    if (onProgress && steps % 10 === 0 && totalGangs !== undefined) {
      if (!onProgress(gangsPlaced, totalGangs, unplaced.length)) {
        return { steps, gangsPlaced, unplaced, backtrackAttempts };
      }
    }

    const leaderIdx = findMostConstrainedGangIdx(
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

    const moves = findValidMoves(
      state,
      maps.data,
      gangUnits,
      maps.teacherMap,
      maps.subjectMap,
      maps.classMap,
      maps.roomMap,
    );

    if (moves.length > 0) {
      moves.sort((a, b) => b.score - a.score);
      const move = moves[0];
      applyGangToState(state, gangUnits, move);
      stack.push({
        leader,
        gangId,
        gangUnits,
        move,
        canBacktrack: canBacktrackPlacement(leader),
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

    if (backtrack.requeued) continue;

    unplaced.push(leader);
  }

  return { steps, gangsPlaced, unplaced, backtrackAttempts };
}
