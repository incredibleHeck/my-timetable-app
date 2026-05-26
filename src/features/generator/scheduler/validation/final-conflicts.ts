import { AppData, Conflict, ClassGroup, Teacher, Room } from "../../../../types";
import { getType } from "./utils";

export interface CurriculumGap {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  expected: number;
  scheduled: number;
  missing: number;
  message: string;
}

const SEVERITY_RANK: Record<string, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const TEACHER_OVERLAP_PATTERNS = [
  "teacher busy",
  "teacher is busy",
  "double booking: teacher",
];

const ROOM_OVERLAP_PATTERNS = [
  "room occupied",
  "double booking: room",
  "resource bottleneck",
  "resource is currently occupied",
];

function normalizeReason(reason: string): string {
  return reason.toLowerCase();
}

function isTeacherOverlap(reason: string, c: Conflict): boolean {
  const r = normalizeReason(reason);
  return (
    !!c.teacherId &&
    TEACHER_OVERLAP_PATTERNS.some((p) => r.includes(p))
  );
}

function isRoomOverlap(reason: string, c: Conflict): boolean {
  const r = normalizeReason(reason);
  return ROOM_OVERLAP_PATTERNS.some((p) => r.includes(p));
}

function isCurriculumGap(c: Conflict): boolean {
  return (
    normalizeReason(c.reason).includes("curriculum gap") ||
    (c.missingPeriods != null && c.missingPeriods > 0)
  );
}

/** Reason-agnostic stable key for deduplication. */
export function conflictDedupeKey(c: Conflict): string {
  const day = c.day ?? 0;
  const period = c.period ?? 0;
  const classId = c.classId || "unknown";

  if (isCurriculumGap(c) && c.subjectId) {
    return `gap:${classId}:${c.subjectId}`;
  }

  if (isTeacherOverlap(c.reason, c) && c.teacherId) {
    return `teacher:${c.teacherId}:${day}:${period}:${classId}`;
  }

  if (isRoomOverlap(c.reason, c) && c.roomId) {
    return `room:${c.roomId}:${day}:${period}:${classId}`;
  }
  if (isRoomOverlap(c.reason, c)) {
    return `room:unknown:${day}:${period}:${classId}`;
  }

  return `slot:${classId}:${day}:${period}:${c.subjectId || ""}`;
}

function severityScore(severity?: Conflict["severity"]): number {
  return SEVERITY_RANK[severity || "LOW"] || 0;
}

function mergeConflictMetadata(winner: Conflict, loser: Conflict): Conflict {
  return {
    ...winner,
    teacherId: winner.teacherId || loser.teacherId,
    teacherName: winner.teacherName || loser.teacherName,
    subjectId: winner.subjectId || loser.subjectId,
    subjectName: winner.subjectName || loser.subjectName,
    roomId: winner.roomId || loser.roomId,
    duration: winner.duration ?? loser.duration,
    missingPeriods: winner.missingPeriods ?? loser.missingPeriods,
  };
}

function pickBetterConflict(a: Conflict, b: Conflict): Conflict {
  const scoreA = severityScore(a.severity);
  const scoreB = severityScore(b.severity);

  if (scoreA !== scoreB) {
    return scoreA > scoreB ? a : b;
  }

  if ((a.reason?.length || 0) !== (b.reason?.length || 0)) {
    return (a.reason?.length || 0) >= (b.reason?.length || 0) ? a : b;
  }

  return a;
}

/** Merge duplicate physical collisions; keep highest severity and best reason. */
export function dedupeConflicts(conflicts: Conflict[]): Conflict[] {
  const map = new Map<string, Conflict>();

  for (const c of conflicts) {
    const key = conflictDedupeKey(c);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, c);
      continue;
    }
    const winner = pickBetterConflict(existing, c);
    const loser = winner === existing ? c : existing;
    map.set(key, mergeConflictMetadata(winner, loser));
  }

  return Array.from(map.values());
}

function countScheduledForSubject(
  data: AppData,
  classId: string,
  subjectId: string,
): number {
  const classSchedule = data.schedule[classId];
  if (!classSchedule) return 0;

  let total = 0;

  for (const dayStr of Object.keys(classSchedule)) {
    const day = parseInt(dayStr);
    const daySchedule = classSchedule[day];
    if (!daySchedule) continue;

    for (const periodStr of Object.keys(daySchedule)) {
      const period = parseInt(periodStr);
      const slot = daySchedule[period];
      if (!slot || slot.isFixed) continue;
      if (slot.subjectId !== subjectId) continue;

      let units = 1;
      const nextSlot = daySchedule[period + 1];
      if (
        nextSlot?.isFixed &&
        nextSlot.subjectId === subjectId &&
        nextSlot.unitId === slot.unitId
      ) {
        units = 2;
      }
      total += units;
    }
  }

  return total;
}

export function detectCurriculumGaps(data: AppData): CurriculumGap[] {
  const gaps: CurriculumGap[] = [];

  for (const cls of data.classes) {
    if (!cls.curriculum?.length) continue;

    for (const item of cls.curriculum) {
      const expected = (item.singles || 0) + (item.doubles || 0) * 2;
      if (expected <= 0) continue;

      const scheduled = countScheduledForSubject(data, cls.id, item.subjectId);
      if (scheduled >= expected) continue;

      const missing = expected - scheduled;
      const subject = data.subjects.find((s) => s.id === item.subjectId);

      gaps.push({
        classId: cls.id,
        className: cls.name,
        subjectId: item.subjectId,
        subjectName: subject?.name || "Unknown",
        expected,
        scheduled,
        missing,
        message: `Curriculum Gap: ${missing} period(s) of ${subject?.name || "Unknown"} not scheduled (${scheduled}/${expected})`,
      });
    }
  }

  return gaps;
}

export function curriculumGapsToConflicts(gaps: CurriculumGap[]): Conflict[] {
  return gaps.map((g) => ({
    classId: g.classId,
    className: g.className,
    subjectId: g.subjectId,
    subjectName: g.subjectName,
    day: 0,
    period: 0,
    missingPeriods: g.missing,
    reason: g.message,
    severity: "HIGH" as const,
  }));
}

function isValidTeacher(data: AppData, teacherId?: string): teacherId is string {
  return !!teacherId && data.teachers.some((t) => t.id === teacherId);
}

function isValidRoom(data: AppData, roomId?: string): roomId is string {
  return !!roomId && data.rooms.some((r) => r.id === roomId);
}

function getSlotSubjectId(
  data: AppData,
  classId: string,
  day: number,
  period: number,
): string | undefined {
  return data.schedule[classId]?.[day]?.[period]?.subjectId;
}

/** True when all classes at this teacher slot are one joint-class session. */
function isJointTeacherSession(
  data: AppData,
  classIds: string[],
  day: number,
  period: number,
): boolean {
  if (classIds.length <= 1) return false;

  const subjectIds = classIds
    .map((cid) => getSlotSubjectId(data, cid, day, period))
    .filter(Boolean) as string[];

  if (subjectIds.length < 2) return false;
  const subjectId = subjectIds[0];
  if (!subjectIds.every((s) => s === subjectId)) return false;

  return (
    data.jointClasses?.some(
      (jc) =>
        jc.subjectId === subjectId &&
        classIds.every((cid) => jc.classIds.includes(cid)),
    ) ?? false
  );
}

function isJointRoomSession(
  data: AppData,
  classIds: string[],
  day: number,
  period: number,
): boolean {
  return isJointTeacherSession(data, classIds, day, period);
}

/** [resourceId -> day -> period -> Set<classId>] occupancy matrix. */
type OccupancyMatrix = Map<string, Map<number, Map<number, Set<string>>>>;

/**
 * Record one (resource, day, period) -> classId occupancy on a freshly-owned matrix.
 * The matrix is always allocated by the caller via `new Map()` so it cannot
 * alias any solver-internal tracker.
 */
function recordOccupancy(
  matrix: OccupancyMatrix,
  resourceId: string,
  day: number,
  period: number,
  classId: string,
): void {
  let byDay = matrix.get(resourceId);
  if (!byDay) {
    byDay = new Map();
    matrix.set(resourceId, byDay);
  }
  let byPeriod = byDay.get(day);
  if (!byPeriod) {
    byPeriod = new Map();
    byDay.set(day, byPeriod);
  }
  let classSet = byPeriod.get(period);
  if (!classSet) {
    classSet = new Set();
    byPeriod.set(period, classSet);
  }
  classSet.add(classId);
}

/**
 * Teacher and room double-bookings only (no gap/continuity — those come from validateFullSchedule).
 *
 * GHOST-CONFLICT ISOLATION
 * The two occupancy matrices below are allocated with `new Map()` on every call
 * and live entirely on this function's stack frame. They do NOT reference any
 * solver state, module-level cache, or `SchedulerState.teacherOccupancy` /
 * `SchedulerState.roomOccupancy` grid. Once this function returns, both maps
 * are garbage-collected, guaranteeing that no overlap-tracking memory survives
 * between audit runs.
 */
export function collectResourceDoubleBookings(data: AppData): Conflict[] {
  const conflicts: Conflict[] = [];
  const { schedule } = data;

  // Fresh, isolated trackers - rebuilt from the FINAL schedule only.
  const teacherOccupancy: OccupancyMatrix = new Map();
  const roomOccupancy: OccupancyMatrix = new Map();

  for (const classId of Object.keys(schedule)) {
    const classSchedule = schedule[classId];
    if (!classSchedule) continue;

    const cls = data.classes.find((c: ClassGroup) => c.id === classId);

    for (const dayStr of Object.keys(classSchedule)) {
      const day = parseInt(dayStr);
      const daySchedule = classSchedule[day];

      for (const periodStr of Object.keys(daySchedule)) {
        const period = parseInt(periodStr);
        const slot = daySchedule[period];
        if (!slot?.subjectId || !slot?.teacherId) continue;
        if (!isValidTeacher(data, slot.teacherId)) continue;

        const structure = cls?.structure || data.settings.dayStructure;
        if (getType(structure, period) !== "CLASS") continue;

        recordOccupancy(teacherOccupancy, slot.teacherId, day, period, classId);

        const subject = data.subjects.find((s) => s.id === slot.subjectId);
        const effectiveRoomId =
          slot.roomId || subject?.requiredRoomId || cls?.defaultRoomId;

        if (effectiveRoomId && isValidRoom(data, effectiveRoomId)) {
          recordOccupancy(roomOccupancy, effectiveRoomId, day, period, classId);
        }
      }
    }
  }

  for (const [teacherId, byDay] of teacherOccupancy) {
    if (!isValidTeacher(data, teacherId)) continue;

    for (const [day, byPeriod] of byDay) {
      for (const [period, classSet] of byPeriod) {
        if (classSet.size <= 1) continue;
        const classes = Array.from(classSet);
        if (isJointTeacherSession(data, classes, day, period)) continue;

        const teacher = data.teachers.find((t: Teacher) => t.id === teacherId);

        classes.forEach((classId) => {
          const cls = data.classes.find((c: ClassGroup) => c.id === classId);
          const slot = schedule[classId]?.[day]?.[period];
          const subject = slot
            ? data.subjects.find((s) => s.id === slot.subjectId)
            : undefined;

          conflicts.push({
            classId,
            className: cls?.name || classId,
            subjectId: slot?.subjectId,
            subjectName: subject?.name,
            teacherId,
            teacherName: teacher?.name,
            day,
            period,
            reason: `Double Booking: Teacher ${teacher?.name || teacherId} is assigned to multiple classes (${classes.join(", ")})`,
            severity: "HIGH",
          });
        });
      }
    }
  }

  for (const [roomId, byDay] of roomOccupancy) {
    if (!isValidRoom(data, roomId)) continue;

    for (const [day, byPeriod] of byDay) {
      for (const [period, classSet] of byPeriod) {
        if (classSet.size <= 1) continue;
        const classes = Array.from(classSet);
        if (isJointRoomSession(data, classes, day, period)) continue;

        const room = data.rooms.find((r: Room) => r.id === roomId);

        classes.forEach((classId) => {
          const cls = data.classes.find((c: ClassGroup) => c.id === classId);
          const slot = schedule[classId]?.[day]?.[period];
          const subject = slot
            ? data.subjects.find((s) => s.id === slot.subjectId)
            : undefined;

          conflicts.push({
            classId,
            className: cls?.name || classId,
            subjectId: slot?.subjectId,
            subjectName: subject?.name,
            day,
            period,
            reason: `Double Booking: Room ${room?.name || roomId} is booked for multiple classes (${classes.join(", ")})`,
            severity: "HIGH",
            roomId,
          });
        });
      }
    }
  }

  return conflicts;
}
