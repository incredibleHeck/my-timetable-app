import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { isOccasionBlocked } from "../../../../utils/utils";
import { checkSubjectContinuity } from "../validation/load-checks";
import { ValidationContext } from "../validation/types";
import { getRoomCandidates } from "./rooms";
import { getMaxSubjectPeriodsPerDayForClass } from "./subject-spread";
import { getDaysPerWeek } from "../utils/utils";

/**
 * ARCHITECT NOTES:
 * 1. Performance: O(1) Map-based lookups.
 * 2. Logic: Includes Joint Class "Self-Overlap" permission.
 * 3. Logic: Subject continuity enforced here (aligned with manual validation).
 * 4. Max consecutive periods is soft (scoring/repair only), not a hard reject.
 */

export const isGlobalSlotBlocked = isOccasionBlocked;

export interface HardConstraintOptions {
  /** Unit IDs whose grid occupancy is treated as free (repair evictions). */
  ignoredOccupants?: Set<string>;
  /** Teacher daily load freed by evicting victims on the target day. */
  teacherLoadAdjustment?: Map<string, number>;
  /** Slot keys (day-period) excluded from shape/continuity checks during repair. */
  ignoredSlots?: Set<string>;
}

function blocksOccupant(
  occupant: string | null | undefined,
  unitId: string,
  ignoredOccupants?: Set<string>,
): boolean {
  if (!occupant || occupant === "BLOCK") return false;
  if (occupant === unitId) return false;
  if (ignoredOccupants?.has(occupant)) return false;
  return true;
}

// --- CORE HARD CONSTRAINTS: RANK 1 THE INVARIANTS ---

/**
 * RANK 1: THE INVARIANTS (Rules of Engagement)
 * These are the active filters for the system.
 * If a lesson violates any of these, it is rejected immediately.
 *
 * In repair mode, pass ignoredOccupants so occupied slots can be reclaimed via eviction.
 */
export const checkHardConstraints = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  teacherMap: Map<string, Teacher>,
  classMap: Map<string, ClassGroup>,
  subjectMap: Map<string, Subject>,
  roomMap: Map<string, Room>,
  options?: HardConstraintOptions,
): boolean => {
  const { duration, subjectId, teacherIds, classIds } = unit;
  const ignoredOccupants = options?.ignoredOccupants;
  const ignoredSlots = options?.ignoredSlots ?? new Set<string>();
  const teacherLoadAdjustment = options?.teacherLoadAdjustment;

  // 1. RANK 1.1: STRUCTURAL HIERARCHY & BOUNDS
  if (!checkImmutableConstraints(d, p, p2, unit, data, teacherMap, classMap)) {
    return false;
  }

  // 2. RANK 1.2: THE TRIPLE LOCK (Availability)
  const maxTeacherLoad = data.settings.maxTeacherPeriodsPerDay || 6;

  for (const tid of teacherIds) {
    const occupantP1 = state.teacherOccupancy[tid]?.[d]?.[p];
    if (blocksOccupant(occupantP1, unit.id, ignoredOccupants)) return false;

    if (duration === 2) {
      const occupantP2 = state.teacherOccupancy[tid]?.[d]?.[p2];
      if (blocksOccupant(occupantP2, unit.id, ignoredOccupants)) return false;
    }

    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const loadFreed = teacherLoadAdjustment?.get(tid) || 0;
    const teacher = teacherMap.get(tid);
    const maxLoad = teacher?.maxPeriodsPerDay ?? maxTeacherLoad;

    if (currentLoad - loadFreed + duration > maxLoad) return false;
  }

  const proposedSlots = new Set<number>([p]);
  if (duration === 2 && p2 !== -1) proposedSlots.add(p2);

  for (const cid of classIds) {
    const occupantP1 = state.classOccupancy[cid]?.[d]?.[p];
    if (blocksOccupant(occupantP1, unit.id, ignoredOccupants)) return false;
    if (duration === 2) {
      const occupantP2 = state.classOccupancy[cid]?.[d]?.[p2];
      if (blocksOccupant(occupantP2, unit.id, ignoredOccupants)) return false;
    }

    const maxSubj = data.settings.maxSubjectPeriodsPerDay || 2;
    let count = 0;
    const daySched = state.schedule[cid]?.[d];
    if (daySched) {
      Object.entries(daySched).forEach(([pStr, slot]) => {
        const pIdx = parseInt(pStr);
        const occupantId = state.classOccupancy[cid]?.[d]?.[pIdx];
        if (occupantId && ignoredOccupants?.has(occupantId)) return;
        if (slot.subjectId === subjectId) count += slot.duration || 1;
      });
    }
    if (count + duration > maxSubj) return false;

    const cls = classMap.get(cid);

    if (data.settings.enforceSubjectDaySpread) {
      const spreadCap = getMaxSubjectPeriodsPerDayForClass(
        cls,
        subjectId,
        getDaysPerWeek(data.settings),
      );
      let subjectDayCount = 0;
      const daySchedSpread = state.schedule[cid]?.[d];
      if (daySchedSpread) {
        Object.entries(daySchedSpread).forEach(([pStr, slot]) => {
          const pIdx = parseInt(pStr);
          const occupantId = state.classOccupancy[cid]?.[d]?.[pIdx];
          if (occupantId && ignoredOccupants?.has(occupantId)) return;
          if (slot.subjectId === subjectId) {
            subjectDayCount += slot.duration || 1;
          }
        });
      }
      if (subjectDayCount + duration > spreadCap) return false;
    }

    const maxCorePerDay = data.settings.maxCorePeriodsPerDay;
    if (maxCorePerDay && unit.isCore) {
      let coreCount = 0;
      const daySched = state.schedule[cid]?.[d];
      if (daySched) {
        Object.entries(daySched).forEach(([pStr, slot]) => {
          const pIdx = parseInt(pStr);
          const occupantId = state.classOccupancy[cid]?.[d]?.[pIdx];
          if (occupantId && ignoredOccupants?.has(occupantId)) return;
          if (slot?.isCore) coreCount += slot.duration || 1;
        });
      }
      if (coreCount + duration > maxCorePerDay) return false;
    }

    const structure = cls?.structure || data.settings.dayStructure;
    const maxPeriods = cls?.periodCount ?? data.settings.periodsPerDay;
    const continuityCtx: ValidationContext = {
      data,
      targetDay: d,
      targetPeriod: p,
      teacherId: teacherIds[0] || "",
      classId: cid,
      subjectId,
      duration,
      maxPeriods,
      structure,
      classSchedule: state.classTimeRanges.get(cid) || [],
      allClassSchedules: state.classTimeRanges,
      ignoredSlots,
    };
    if (checkSubjectContinuity(continuityCtx, proposedSlots, ignoredSlots, state)) {
      return false;
    }
  }

  const subject = subjectMap.get(subjectId);
  const repClass = classMap.get(classIds[0]);
  const candidates = getRoomCandidates(unit, subject, repClass, roomMap);
  const targetRoomId =
    candidates[0] ?? subject?.requiredRoomId ?? repClass?.defaultRoomId ?? unit.defaultRoomId;

  if (targetRoomId) {
    const roomOccP1 = state.roomOccupancy[targetRoomId]?.[d]?.[p];
    if (blocksOccupant(roomOccP1, unit.id, ignoredOccupants)) return false;

    if (duration === 2) {
      const roomOccP2 = state.roomOccupancy[targetRoomId]?.[d]?.[p2];
      if (blocksOccupant(roomOccP2, unit.id, ignoredOccupants)) return false;
    }

    const room = roomMap.get(targetRoomId);
    if (room && repClass && (repClass.studentCount || 0) > room.capacity) return false;
  } else if (candidates.length > 0 || subject?.requiredRoomId) {
    return false;
  }

  if (subject?.isSingleResource) {
    const resOccP1 = state.singleResourceUsage[subjectId]?.[d]?.[p];
    if (blocksOccupant(resOccP1, unit.id, ignoredOccupants)) return false;
    if (duration === 2) {
      const resOccP2 = state.singleResourceUsage[subjectId]?.[d]?.[p2];
      if (blocksOccupant(resOccP2, unit.id, ignoredOccupants)) return false;
    }
  }

  return true;
};

export function computeTeacherLoadAdjustment(
  state: SchedulerState,
  d: number,
  p: number,
  p2: number,
  victims: Set<string>,
  unitMap: Map<string, AllocationUnit>,
): Map<string, number> {
  const adjustment = new Map<string, number>();

  for (const vId of victims) {
    const vUnit = unitMap.get(vId);
    if (!vUnit) continue;

    const placement = state.unitPlacements.get(vId);
    if (!placement || placement.d !== d) continue;

    for (const tid of vUnit.teacherIds) {
      let freed = 0;
      if (state.teacherOccupancy[tid]?.[d]?.[p] === vId) freed++;
      if (p2 !== -1 && state.teacherOccupancy[tid]?.[d]?.[p2] === vId) freed++;
      if (freed > 0) {
        adjustment.set(tid, (adjustment.get(tid) || 0) + freed);
      }
    }
  }

  return adjustment;
}

export function buildEvictionIgnoredSlots(
  state: SchedulerState,
  d: number,
  victims: Set<string>,
): Set<string> {
  const ignoredSlots = new Set<string>();

  for (const vId of victims) {
    const placement = state.unitPlacements.get(vId);
    if (!placement || placement.d !== d) continue;
    ignoredSlots.add(`${d}-${placement.p}`);
    if (placement.p2 !== -1) ignoredSlots.add(`${d}-${placement.p2}`);
  }

  return ignoredSlots;
}

// --- IMMUTABLE CONSTRAINTS ---

export function checkImmutableConstraints(
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  data: AppData,
  teacherMap: Map<string, Teacher>,
  classMap: Map<string, ClassGroup>,
): boolean {
  for (const cid of unit.classIds) {
    const cls = classMap.get(cid);
    const struct = cls?.structure || data.settings.dayStructure;
    const limit = Math.min(cls?.periodCount ?? 99, struct.length);

    if (p >= limit) return false;
    if (unit.duration === 2 && p2 !== -1 && p2 >= limit) return false;
  }

  if (isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p])) return false;
  if (
    unit.duration === 2 &&
    p2 !== -1 &&
    isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p2])
  ) {
    return false;
  }

  for (const tid of unit.teacherIds) {
    const t = teacherMap.get(tid);
    if (t?.constraints?.[d]?.[p]) return false;
    if (unit.duration === 2 && p2 !== -1 && t?.constraints?.[d]?.[p2]) return false;
  }

  for (const cid of unit.classIds) {
    const cls = classMap.get(cid);
    if (cls?.fixedSessions?.[d]?.[p]) return false;
    if (unit.duration === 2 && p2 !== -1 && cls?.fixedSessions?.[d]?.[p2]) return false;
  }

  return true;
}
