import { Teacher, AppData, Subject, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { checkHardConstraints } from "../logic/constraints";
import { getNextClassPeriod, getPeriodType, getDaysPerWeek } from "../utils/utils";
import {
  PRIORITY_CRITICAL,
  CRITICAL_UNIT_PRIORITY_BOOST,
  SPECIALIST_SINGLE_BOOST,
} from "../constants";
import { getGangId } from "./repair-controller";

const getTeacherConstraintScore = (
  teacherId: string,
  teacherMap: Map<string, Teacher>,
  data: AppData,
): number => {
  const teacher = teacherMap.get(teacherId);
  if (!teacher) return 0;

  let blockedCount = 0;
  if (teacher.constraints) {
    for (const row of teacher.constraints) {
      for (const isBlocked of row) {
        if (isBlocked) blockedCount++;
      }
    }
  }

  const totalSlots = 60;
  const maxWeekly =
    data.settings.maxTeachingPeriodsPerWeek ?? (data.settings.maxTeacherPeriodsPerDay || 6) * 5;
  const maxLoad = Math.min(maxWeekly, totalSlots);
  return blockedCount + (totalSlots - maxLoad);
};

export const calculatePriority = (
  unit: AllocationUnit,
  data: AppData,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
): number => {
  let score = 0;
  const subject = subjectMap.get(unit.subjectId);

  for (const tid of unit.teacherIds) {
    const teacher = teacherMap.get(tid);
    if (teacher?.constraints) {
      let availableSlots = 0;
      teacher.constraints.forEach((row) =>
        row.forEach((isBlocked) => {
          if (!isBlocked) availableSlots++;
        }),
      );
      if (availableSlots < 45) {
        score += CRITICAL_UNIT_PRIORITY_BOOST;
      }
    }
  }

  if (unit.classIds.length > 1 || unit.jointClassId || unit.electiveBlockId) {
    score += 30000;
  }

  const isSpecialist = subject?.requiredRoomId || unit.requiredRoomType;
  if (isSpecialist) {
    if (unit.duration === 2) {
      score += 25000;
    } else {
      score += SPECIALIST_SINGLE_BOOST;
    }
  }

  score += unit.rankLevel * 100;

  if (
    !isSpecialist &&
    unit.duration === 2 &&
    unit.classIds.length === 1 &&
    !unit.jointClassId &&
    !unit.electiveBlockId
  ) {
    score += 15000;
  }

  for (const tid of unit.teacherIds) {
    score += getTeacherConstraintScore(tid, teacherMap, data) * 10;
  }

  return score;
};

/** Full MRV scan: pick the leader with the smallest valid domain, tie-break on priority. */
export function findMostConstrainedGangIdx(
  leaders: AllocationUnit[],
  state: SchedulerState,
  data: AppData,
  gangMap: Map<string, AllocationUnit[]>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  classMap: Map<string, ClassGroup>,
  roomMap: Map<string, Room>,
): number {
  let minDomain = Infinity;
  let bestIdx = 0;
  let bestPriority = -1;

  for (let i = 0; i < leaders.length; i++) {
    const leader = leaders[i];
    if (leader.priority >= PRIORITY_CRITICAL) return i;

    const gangId = getGangId(leader);
    const gang = gangMap.get(gangId)!;
    const domainSize = countValidSlots(
      state,
      data,
      gang,
      classMap,
      teacherMap,
      subjectMap,
      roomMap,
    );

    if (domainSize < minDomain || (domainSize === minDomain && leader.priority > bestPriority)) {
      minDomain = domainSize;
      bestIdx = i;
      bestPriority = leader.priority;
    }
  }

  return bestIdx;
}

export function countValidSlots(
  state: SchedulerState,
  data: AppData,
  gang: AllocationUnit[],
  classMap: Map<string, ClassGroup>,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
  roomMap: Map<string, Room>,
): number {
  const globalPeriods = 15;
  const days = getDaysPerWeek(data.settings);
  let count = 0;

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < globalPeriods; p++) {
      let gangValid = true;

      for (const u of gang) {
        const cls = classMap.get(u.classIds[0]);
        const struct = cls?.structure || data.settings.dayStructure;

        const classLimit = cls?.periodCount ?? data.settings.periodsPerDay;
        if (p >= classLimit || getPeriodType(struct, p) !== "CLASS") {
          gangValid = false;
          break;
        }

        let p2 = -1;
        if (u.duration === 2) {
          const next = getNextClassPeriod(p, struct, classLimit);
          if (next === null) {
            gangValid = false;
            break;
          }
          p2 = next;
        }

        if (
          !checkHardConstraints(state, data, d, p, p2, u, teacherMap, classMap, subjectMap, roomMap)
        ) {
          gangValid = false;
          break;
        }
      }
      if (gangValid) count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Cached MRV with dirty-flag invalidation
// ---------------------------------------------------------------------------

/**
 * Maintains cached domain sizes for gangs, only recomputing when a gang's
 * resources overlap with a recently-placed unit.
 */
export class MrvCache {
  private domainCache = new Map<string, number>();
  private dirtyGangIds = new Set<string>();
  /** gangId -> set of resource keys (teacher/class/room IDs) for fast overlap checks */
  private gangResources = new Map<string, Set<string>>();

  private data: AppData;
  private gangMap: Map<string, AllocationUnit[]>;
  private teacherMap: Map<string, Teacher>;
  private subjectMap: Map<string, Subject>;
  private classMap: Map<string, ClassGroup>;
  private roomMap: Map<string, Room>;

  constructor(
    data: AppData,
    gangMap: Map<string, AllocationUnit[]>,
    teacherMap: Map<string, Teacher>,
    subjectMap: Map<string, Subject>,
    classMap: Map<string, ClassGroup>,
    roomMap: Map<string, Room>,
  ) {
    this.data = data;
    this.gangMap = gangMap;
    this.teacherMap = teacherMap;
    this.subjectMap = subjectMap;
    this.classMap = classMap;
    this.roomMap = roomMap;

    for (const [gangId, gang] of gangMap) {
      this.gangResources.set(gangId, this.extractResources(gang));
    }
  }

  private extractResources(gang: AllocationUnit[]): Set<string> {
    const res = new Set<string>();
    for (const u of gang) {
      for (const tid of u.teacherIds) res.add(`T:${tid}`);
      for (const cid of u.classIds) res.add(`C:${cid}`);
      if (u.defaultRoomId) res.add(`R:${u.defaultRoomId}`);
      if (u.requiredRoomType) res.add(`RT:${u.requiredRoomType}`);
      const sub = this.subjectMap.get(u.subjectId);
      if (sub && sub.requiredRoomId) res.add(`R:${sub.requiredRoomId}`);
    }
    return res;
  }

  /** Mark all gangs sharing resources with the just-placed gang as dirty. */
  invalidateAfterPlacement(placedGang: AllocationUnit[]): void {
    const placedResources = new Set<string>();
    for (const u of placedGang) {
      for (const tid of u.teacherIds) placedResources.add(`T:${tid}`);
      for (const cid of u.classIds) placedResources.add(`C:${cid}`);
      if (u.defaultRoomId) placedResources.add(`R:${u.defaultRoomId}`);
      if (u.requiredRoomType) placedResources.add(`RT:${u.requiredRoomType}`);
      const sub = this.subjectMap.get(u.subjectId);
      if (sub && sub.requiredRoomId) placedResources.add(`R:${sub.requiredRoomId}`);
    }

    for (const [gangId, resources] of this.gangResources) {
      if (this.dirtyGangIds.has(gangId)) continue;
      for (const r of placedResources) {
        if (resources.has(r)) {
          this.dirtyGangIds.add(gangId);
          break;
        }
      }
    }
  }

  /** Mark all gangs dirty (e.g. after a backtrack removes units). */
  invalidateAll(): void {
    for (const gangId of this.gangResources.keys()) {
      this.dirtyGangIds.add(gangId);
    }
  }

  /** Remove a gang from the cache (it's been placed or is no longer in the queue). */
  removeGang(gangId: string): void {
    this.domainCache.delete(gangId);
    this.dirtyGangIds.delete(gangId);
  }

  /**
   * Pick the leader with the smallest domain from the queue.
   * Only recomputes domain for dirty entries; uses cache for the rest.
   */
  findMostConstrainedIdx(leaders: AllocationUnit[], state: SchedulerState): number {
    let minDomain = Infinity;
    let bestIdx = 0;
    let bestPriority = -1;

    for (let i = 0; i < leaders.length; i++) {
      const leader = leaders[i];
      if (leader.priority >= PRIORITY_CRITICAL) return i;

      const gangId = getGangId(leader);
      let domainSize: number;

      if (this.dirtyGangIds.has(gangId) || !this.domainCache.has(gangId)) {
        const gang = this.gangMap.get(gangId)!;
        domainSize = countValidSlots(
          state,
          this.data,
          gang,
          this.classMap,
          this.teacherMap,
          this.subjectMap,
          this.roomMap,
        );
        this.domainCache.set(gangId, domainSize);
        this.dirtyGangIds.delete(gangId);
      } else {
        domainSize = this.domainCache.get(gangId)!;
      }

      if (domainSize < minDomain || (domainSize === minDomain && leader.priority > bestPriority)) {
        minDomain = domainSize;
        bestIdx = i;
        bestPriority = leader.priority;
      }
    }

    return bestIdx;
  }
}
