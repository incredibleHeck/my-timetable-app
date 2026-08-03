import { AppData } from "../../../types";

export interface AffectedLesson {
  day: number;
  period: number;
  classIds: string[];
  className: string; // joined class names (joint lessons combined)
  subjectId: string;
  subjectName: string;
  roomName?: string;
}

export interface SubstituteCandidate {
  teacherId: string;
  teacherName: string;
  /** Teaches this subject (in specialtyIds). */
  qualified: boolean;
  /** Periods this teacher already works that day (lessons + assigned covers). */
  dayLoad: number;
  /** Assigning this cover would exceed their per-day teaching cap. */
  atDailyCap: boolean;
}

export interface LessonCover {
  lesson: AffectedLesson;
  candidates: SubstituteCandidate[];
}

/** Distinct periods each teacher is scheduled to teach on a given day. */
const teacherPeriodsForDay = (data: AppData, day: number): Map<string, Set<number>> => {
  const map = new Map<string, Set<number>>();
  for (const classId of Object.keys(data.schedule)) {
    const byPeriod = data.schedule[classId]?.[day];
    if (!byPeriod) continue;
    for (const periodKey of Object.keys(byPeriod)) {
      const slot = byPeriod[Number(periodKey)];
      if (!slot?.teacherId) continue;
      let set = map.get(slot.teacherId);
      if (!set) {
        set = new Set<number>();
        map.set(slot.teacherId, set);
      }
      set.add(Number(periodKey));
    }
  }
  return map;
};

/**
 * Lessons an absent teacher would leave uncovered on a given day, one entry
 * per period. Joint lessons (same teacher/period across classes) are merged.
 */
export const findAffectedLessons = (
  data: AppData,
  absentTeacherId: string,
  day: number,
): AffectedLesson[] => {
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const className = new Map(data.classes.map((c) => [c.id, c.name]));
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));

  const byPeriod = new Map<number, AffectedLesson>();

  for (const classId of Object.keys(data.schedule)) {
    const daySchedule = data.schedule[classId]?.[day];
    if (!daySchedule) continue;

    for (const periodKey of Object.keys(daySchedule)) {
      const period = Number(periodKey);
      const slot = daySchedule[period];
      if (!slot || slot.teacherId !== absentTeacherId) continue;

      const existing = byPeriod.get(period);
      if (existing) {
        if (!existing.classIds.includes(classId)) {
          existing.classIds.push(classId);
          existing.className = existing.classIds.map((id) => className.get(id) ?? id).join(", ");
        }
      } else {
        byPeriod.set(period, {
          day,
          period,
          classIds: [classId],
          className: className.get(classId) ?? classId,
          subjectId: slot.subjectId,
          subjectName: subjectName.get(slot.subjectId) ?? slot.subjectId,
          roomName: slot.roomId ? roomName.get(slot.roomId) : undefined,
        });
      }
    }
  }

  return [...byPeriod.values()].sort((a, b) => a.period - b.period);
};

/**
 * Rank possible substitutes for one lesson. A valid candidate is not the absent
 * teacher, is free that period, and is not blocked by their own constraints.
 * Ranking: qualified first, then under-cap, then lowest daily load, then name.
 *
 * `assignments` maps period -> chosen substitute teacherId so that a sub picked
 * for an earlier period counts toward their daily load here.
 */
export const rankCandidates = (
  data: AppData,
  lesson: AffectedLesson,
  absentTeacherId: string,
  assignments: Record<number, string> = {},
): SubstituteCandidate[] => {
  const { day, period, subjectId } = lesson;
  const teacherPeriods = teacherPeriodsForDay(data, day);
  const globalDailyCap = data.settings.maxTeacherPeriodsPerDay;

  const assignedCoverCount = (teacherId: string): number =>
    Object.entries(assignments).filter(([p, tid]) => tid === teacherId && Number(p) !== period)
      .length;

  const candidates: SubstituteCandidate[] = [];

  for (const teacher of data.teachers) {
    if (teacher.id === absentTeacherId) continue;

    // Must be free this period and not blocked by their own constraints.
    if (teacherPeriods.get(teacher.id)?.has(period)) continue;
    if (teacher.constraints?.[day]?.[period] === true) continue;

    const baseLoad = teacherPeriods.get(teacher.id)?.size ?? 0;
    const dayLoad = baseLoad + assignedCoverCount(teacher.id);
    const cap = teacher.maxPeriodsPerDay ?? globalDailyCap;
    const atDailyCap = cap !== undefined && dayLoad >= cap;

    candidates.push({
      teacherId: teacher.id,
      teacherName: teacher.name,
      qualified: teacher.specialtyIds?.includes(subjectId) ?? false,
      dayLoad,
      atDailyCap,
    });
  }

  return candidates.sort((a, b) => {
    if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
    if (a.atDailyCap !== b.atDailyCap) return a.atDailyCap ? 1 : -1;
    if (a.dayLoad !== b.dayLoad) return a.dayLoad - b.dayLoad;
    return a.teacherName.localeCompare(b.teacherName, undefined, { numeric: true });
  });
};

/** Full cover plan: affected lessons plus ranked candidates for each. */
export const buildCoverPlan = (
  data: AppData,
  absentTeacherId: string,
  day: number,
  assignments: Record<number, string> = {},
): LessonCover[] =>
  findAffectedLessons(data, absentTeacherId, day).map((lesson) => ({
    lesson,
    candidates: rankCandidates(data, lesson, absentTeacherId, assignments),
  }));
