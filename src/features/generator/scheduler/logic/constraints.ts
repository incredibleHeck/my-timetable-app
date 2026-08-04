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

/**
 * Which predicate rejected a slot.
 *
 * The solver only ever needed a boolean, so that is all it returned — and an
 * unplaced lesson could therefore only be reported as "no valid slot found",
 * which tells a user nothing about what to change. These names exist to answer
 * "why not here?", and are aggregated across every candidate slot by
 * `diagnose-unplaced.ts`.
 */
export type BlockingReason =
  | "PERIOD_OUT_OF_RANGE"
  | "FIXED_OCCASION"
  | "TEACHER_UNAVAILABLE"
  | "CLASS_FIXED_SESSION"
  | "TEACHER_BUSY"
  | "TEACHER_DAILY_CAP"
  | "TEACHER_TIME_OVERLAP"
  | "ROOM_TIME_OVERLAP"
  | "SINGLE_RESOURCE_TIME_OVERLAP"
  | "CLASS_BUSY"
  | "SUBJECT_DAILY_CAP"
  | "SUBJECT_DAY_SPREAD"
  | "CORE_DAILY_CAP"
  | "SUBJECT_CONTINUITY"
  | "ROOM_BUSY"
  | "ROOM_CAPACITY"
  | "NO_ROOM_AVAILABLE"
  | "SINGLE_RESOURCE_BUSY"
  /** Raised by findValidMoves before the hard checks run. */
  | "NOT_A_CLASS_PERIOD"
  | "NO_SECOND_PERIOD_FOR_DOUBLE";

/** Human-readable, in the terms a timetabler would use to fix it. */
export const BLOCKING_REASON_LABELS: Record<BlockingReason, string> = {
  PERIOD_OUT_OF_RANGE: "outside the class's teaching day",
  FIXED_OCCASION: "reserved for a fixed occasion (Worship, Clubs)",
  TEACHER_UNAVAILABLE: "teacher marked unavailable",
  CLASS_FIXED_SESSION: "class has a fixed session booked",
  TEACHER_BUSY: "teacher already teaching",
  TEACHER_DAILY_CAP: "teacher's daily period limit reached",
  TEACHER_TIME_OVERLAP: "teacher is teaching another class at that clock time",
  ROOM_TIME_OVERLAP: "room is in use by another class at that clock time",
  SINGLE_RESOURCE_TIME_OVERLAP: "shared resource is in use at that clock time",
  CLASS_BUSY: "class already has a lesson",
  SUBJECT_DAILY_CAP: "subject's daily limit for this class reached",
  SUBJECT_DAY_SPREAD: "subject day-spread limit reached",
  CORE_DAILY_CAP: "class's daily core-subject limit reached",
  SUBJECT_CONTINUITY: "would split or duplicate the subject badly that day",
  ROOM_BUSY: "required room already in use",
  ROOM_CAPACITY: "room too small for the class",
  NO_ROOM_AVAILABLE: "no suitable room free",
  SINGLE_RESOURCE_BUSY: "shared resource already in use",
  NOT_A_CLASS_PERIOD: "not a teaching period (break, lunch or assembly)",
  NO_SECOND_PERIOD_FOR_DOUBLE: "no second period free to complete the double",
};

export interface HardConstraintOptions {
  /** Unit IDs whose grid occupancy is treated as free (repair evictions). */
  ignoredOccupants?: Set<string>;
  /** Teacher daily load freed by evicting victims on the target day. */
  teacherLoadAdjustment?: Map<string, number>;
  /** Slot keys (day-period) excluded from shape/continuity checks during repair. */
  ignoredSlots?: Set<string>;
  /**
   * Diagnostics sink. Left undefined by the solver's hot path, so recording a
   * reason costs nothing during a real solve.
   */
  onReject?: (reason: BlockingReason) => void;
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

/**
 * Would placing `unit` at (d, p) collide with something already holding this
 * resource at the same time of day?
 *
 * Every occupancy grid is indexed by period number, and the fast index checks
 * elsewhere in this file assume index N is the same instant for everyone. That
 * holds only while all classes share a day structure. When breaks are staggered
 * — Year 4B breaking at index 4 where the rest of the school breaks at 3 —
 * index 8 in one class runs at the same clock time as index 9 in another, and
 * the grids report both as free.
 *
 * The consequences differ by resource but are equally real: a teacher in two
 * rooms at once, two classes sent to the same lab, or a shared resource such as
 * ICT booked twice over. The reference school had five of the last kind, none of
 * which any index-based check could see.
 *
 * Joint lessons are exempt throughout: teaching two classes together in one slot
 * is the point of them, not a clash.
 */
function occupancyOverlapsInTime(
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  dayOccupancy: (string | null)[] | undefined,
  ignoredOccupants?: Set<string>,
): boolean {
  if (!dayOccupancy) return false;

  const proposed = p2 === -1 ? [p] : [p, p2];

  // Times are zero-padded "HH:MM", so lexicographic order is chronological order
  // — the comparison the existing validation layer already relies on.
  //
  // A joint lesson can span classes whose bells differ, so the window it really
  // occupies is the union across its classes, not the first one's.
  const myWindows: Array<{ start: string; end: string }> = [];
  for (const mine of proposed) {
    let start: string | undefined;
    let end: string | undefined;
    for (const classId of unit.classIds) {
      const range = state.classTimeRanges.get(classId)?.[mine];
      if (!range) continue;
      if (start === undefined || range.start < start) start = range.start;
      if (end === undefined || range.end > end) end = range.end;
    }
    if (start !== undefined && end !== undefined && start < end) {
      myWindows.push({ start, end });
    }
  }
  if (myWindows.length === 0) return false;

  for (let otherP = 0; otherP < dayOccupancy.length; otherP++) {
    if (proposed.includes(otherP)) continue;

    const occupantId = dayOccupancy[otherP];
    if (!occupantId || occupantId === "BLOCK" || occupantId === unit.id) continue;
    // Repair evicts as it goes; a slot held by a victim is about to be free.
    if (ignoredOccupants?.has(occupantId)) continue;

    const otherClassId = state.unitToClassMap.get(occupantId);
    if (!otherClassId || unit.classIds.includes(otherClassId)) continue;

    const otherRange = state.classTimeRanges.get(otherClassId)?.[otherP];
    if (!otherRange) continue;

    const clashes = myWindows.some(
      (mine) => mine.start < otherRange.end && otherRange.start < mine.end,
    );
    if (!clashes) continue;

    const isJoint = data.jointClasses?.some(
      (jc) =>
        jc.subjectId === unit.subjectId &&
        jc.classIds.includes(otherClassId) &&
        unit.classIds.some((cid) => jc.classIds.includes(cid)),
    );
    if (!isJoint) return true;
  }

  return false;
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

  /** Records why this slot was rejected, then rejects it. */
  const reject = (reason: BlockingReason): false => {
    options?.onReject?.(reason);
    return false;
  };

  // 1. RANK 1.1: STRUCTURAL HIERARCHY & BOUNDS
  if (!checkImmutableConstraints(d, p, p2, unit, data, teacherMap, classMap, options?.onReject)) {
    return false;
  }

  // 2. RANK 1.2: THE TRIPLE LOCK (Availability)
  const maxTeacherLoad = data.settings.maxTeacherPeriodsPerDay || 6;

  for (const tid of teacherIds) {
    const occupantP1 = state.teacherOccupancy[tid]?.[d]?.[p];
    if (blocksOccupant(occupantP1, unit.id, ignoredOccupants)) return reject("TEACHER_BUSY");

    if (duration === 2) {
      const occupantP2 = state.teacherOccupancy[tid]?.[d]?.[p2];
      if (blocksOccupant(occupantP2, unit.id, ignoredOccupants)) return reject("TEACHER_BUSY");
    }

    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;
    const loadFreed = teacherLoadAdjustment?.get(tid) || 0;
    const teacher = teacherMap.get(tid);
    const maxLoad = teacher?.maxPeriodsPerDay ?? maxTeacherLoad;

    if (currentLoad - loadFreed + duration > maxLoad) return reject("TEACHER_DAILY_CAP");

    if (
      state.hasStaggeredDays &&
      occupancyOverlapsInTime(
        state,
        data,
        d,
        p,
        p2,
        unit,
        state.teacherOccupancy[tid]?.[d],
        ignoredOccupants,
      )
    ) {
      return reject("TEACHER_TIME_OVERLAP");
    }
  }

  const proposedSlots = new Set<number>([p]);
  if (duration === 2 && p2 !== -1) proposedSlots.add(p2);

  for (const cid of classIds) {
    const occupantP1 = state.classOccupancy[cid]?.[d]?.[p];
    if (blocksOccupant(occupantP1, unit.id, ignoredOccupants)) return reject("CLASS_BUSY");
    if (duration === 2) {
      const occupantP2 = state.classOccupancy[cid]?.[d]?.[p2];
      if (blocksOccupant(occupantP2, unit.id, ignoredOccupants)) return reject("CLASS_BUSY");
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
    if (count + duration > maxSubj) return reject("SUBJECT_DAILY_CAP");

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
      if (subjectDayCount + duration > spreadCap) return reject("SUBJECT_DAY_SPREAD");
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
      if (coreCount + duration > maxCorePerDay) return reject("CORE_DAILY_CAP");
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
      return reject("SUBJECT_CONTINUITY");
    }
  }

  const subject = subjectMap.get(subjectId);
  const repClass = classMap.get(classIds[0]);
  const candidates = getRoomCandidates(unit, subject, repClass, roomMap);
  const targetRoomId =
    candidates[0] ?? subject?.requiredRoomId ?? repClass?.defaultRoomId ?? unit.defaultRoomId;

  if (targetRoomId) {
    const roomOccP1 = state.roomOccupancy[targetRoomId]?.[d]?.[p];
    if (blocksOccupant(roomOccP1, unit.id, ignoredOccupants)) return reject("ROOM_BUSY");

    if (duration === 2) {
      const roomOccP2 = state.roomOccupancy[targetRoomId]?.[d]?.[p2];
      if (blocksOccupant(roomOccP2, unit.id, ignoredOccupants)) return reject("ROOM_BUSY");
    }

    if (
      state.hasStaggeredDays &&
      occupancyOverlapsInTime(
        state,
        data,
        d,
        p,
        p2,
        unit,
        state.roomOccupancy[targetRoomId]?.[d],
        ignoredOccupants,
      )
    ) {
      return reject("ROOM_TIME_OVERLAP");
    }

    const room = roomMap.get(targetRoomId);
    if (room && repClass && (repClass.studentCount || 0) > room.capacity) {
      return reject("ROOM_CAPACITY");
    }
  } else if (candidates.length > 0 || subject?.requiredRoomId) {
    return reject("NO_ROOM_AVAILABLE");
  }

  if (subject?.isSingleResource) {
    const resOccP1 = state.singleResourceUsage[subjectId]?.[d]?.[p];
    if (blocksOccupant(resOccP1, unit.id, ignoredOccupants)) {
      return reject("SINGLE_RESOURCE_BUSY");
    }
    if (duration === 2) {
      const resOccP2 = state.singleResourceUsage[subjectId]?.[d]?.[p2];
      if (blocksOccupant(resOccP2, unit.id, ignoredOccupants)) {
        return reject("SINGLE_RESOURCE_BUSY");
      }
    }

    if (
      state.hasStaggeredDays &&
      occupancyOverlapsInTime(
        state,
        data,
        d,
        p,
        p2,
        unit,
        state.singleResourceUsage[subjectId]?.[d],
        ignoredOccupants,
      )
    ) {
      return reject("SINGLE_RESOURCE_TIME_OVERLAP");
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
  onReject?: (reason: BlockingReason) => void,
): boolean {
  const reject = (reason: BlockingReason): false => {
    onReject?.(reason);
    return false;
  };

  for (const cid of unit.classIds) {
    const cls = classMap.get(cid);
    const struct = cls?.structure || data.settings.dayStructure;
    const limit = Math.min(cls?.periodCount ?? 99, struct.length);

    if (p >= limit) return reject("PERIOD_OUT_OF_RANGE");
    if (unit.duration === 2 && p2 !== -1 && p2 >= limit) return reject("PERIOD_OUT_OF_RANGE");
  }

  if (isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p])) return reject("FIXED_OCCASION");
  if (
    unit.duration === 2 &&
    p2 !== -1 &&
    isGlobalSlotBlocked(data.settings.fixedOccasions?.[d]?.[p2])
  ) {
    return reject("FIXED_OCCASION");
  }

  for (const tid of unit.teacherIds) {
    const t = teacherMap.get(tid);
    if (t?.constraints?.[d]?.[p]) return reject("TEACHER_UNAVAILABLE");
    if (unit.duration === 2 && p2 !== -1 && t?.constraints?.[d]?.[p2]) {
      return reject("TEACHER_UNAVAILABLE");
    }
  }

  for (const cid of unit.classIds) {
    const cls = classMap.get(cid);
    if (cls?.fixedSessions?.[d]?.[p]) return reject("CLASS_FIXED_SESSION");
    if (unit.duration === 2 && p2 !== -1 && cls?.fixedSessions?.[d]?.[p2]) {
      return reject("CLASS_FIXED_SESSION");
    }
  }

  return true;
}
