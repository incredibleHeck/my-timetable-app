import { AppData, PeriodConfig, PeriodType } from "../../../../types";
import { isOccasionBlocked } from "../../../../utils/utils";

/**
 * SCHEDULE OBJECTIVE
 *
 * A single answer to "is timetable A better than timetable B?".
 *
 * The solver previously had no such answer: construction maximised
 * SCORING_WEIGHTS while repair minimised unrelated PENALTY_* magnitudes, and
 * `compareSolverResults` ranked runs purely on unplaced count. With ~30 restarts
 * inside the time budget, every run that tied on feasibility was discarded in
 * arbitrary order. This module supplies the missing comparison.
 *
 * WHAT COUNTS AS BAD — informed by measuring a real school timetable rather than
 * assumed:
 *
 *  - Unplaced lessons are the real failure: they become curriculum the students
 *    never receive. Ranked first and separately from soft cost.
 *  - Teacher free time is NOT waste. Teachers need non-contact periods to mark,
 *    prepare and rest. On the reference school, 240 of 364 free periods arrived
 *    in blocks of two or more — that is functioning prep time, and an optimiser
 *    that "fixed" it would be doing harm. Only *isolated single* free periods
 *    are penalised, lightly: too short to be useful, but still tying the teacher
 *    to the site. Consolidated blocks are explicitly left alone.
 *  - A long on-site span is not penalised. Light teaching loads spread across
 *    the day are normal school practice.
 *  - Class gaps are real dead time for students, so they carry more weight per
 *    period than teacher fragmentation.
 *  - Teaching beyond the school's weekly cap is a policy breach. It is scored,
 *    not hard-rejected: the curriculum may legitimately demand more than the cap
 *    allows, and refusing to place those lessons would trade a visible warning
 *    for silent missing lessons.
 */

export interface ObjectiveBreakdown {
  /** Periods of curriculum requested but absent from the grid. */
  curriculumGapPeriods: number;
  /** Periods scheduled beyond `settings.maxTeachingPeriodsPerWeek`, summed over teachers. */
  weeklyCapExcess: number;
  /** Sum of squared deviation from mean weekly teaching load. */
  loadImbalance: number;
  /** Single free periods wedged between lessons — too short to be useful. */
  fragmentedTeacherGaps: number;
  /** Free runs of 2+ periods. Reported for visibility; deliberately not penalised. */
  consolidatedTeacherBlocks: number;
  /** Idle schedulable periods inside a class's day. */
  classGapPeriods: number;
}

export interface ObjectiveScore {
  /** Lessons the solver failed to place. Compared before any soft term. */
  unplacedPeriods: number;
  /** Weighted soft cost; lower is better. */
  softCost: number;
  breakdown: ObjectiveBreakdown;
}

/**
 * Soft weights. Ordered by how much each actually harms a school:
 * a student sitting idle outweighs a teacher's short gap, and breaching the
 * staffing policy outweighs both.
 */
export const OBJECTIVE_WEIGHTS = {
  CURRICULUM_GAP: 500,
  WEEKLY_CAP_EXCESS: 120,
  LOAD_IMBALANCE: 8,
  CLASS_GAP: 40,
  FRAGMENTED_TEACHER_GAP: 6,
} as const;

export type ObjectiveWeights = typeof OBJECTIVE_WEIGHTS;

/** Indices that are teaching periods in a given day structure. */
export function teachingIndicesOf(
  structure: (PeriodType | PeriodConfig)[] | undefined,
): Set<number> {
  const out = new Set<number>();
  (structure ?? []).forEach((item, i) => {
    const type = typeof item === "string" ? item : item?.type;
    if ((type || "CLASS") === "CLASS") out.add(i);
  });
  return out;
}

/**
 * Periods a class could legitimately be taught in on a given day.
 *
 * Uses the class's OWN structure: break and lunch sit at different indices per
 * class, so reading the global structure reports real breaks as idle time and
 * misses genuine gaps. Reserved occasions (Worship, Clubs) are commitments, not
 * free time.
 */
export function classSchedulablePeriods(
  data: AppData,
  classId: string,
  day: number,
  cache?: Map<string, Set<number>>,
): Set<number> {
  const cls = data.classes.find((c) => c.id === classId);
  const cacheKey = `${classId}`;
  let base = cache?.get(cacheKey);
  if (!base) {
    base = teachingIndicesOf(cls?.structure ?? data.settings.dayStructure);
    cache?.set(cacheKey, base);
  }

  const out = new Set<number>();
  for (const p of base) {
    if (isOccasionBlocked(data.settings.fixedOccasions?.[day]?.[p])) continue;
    if (isOccasionBlocked(cls?.fixedSessions?.[day]?.[p] ?? null)) continue;
    out.add(p);
  }
  return out;
}

interface FreeRunShape {
  isolated: number;
  consolidated: number;
}

/**
 * Classify the free periods between the first and last lesson of a day into
 * isolated singles versus consolidated runs of 2+.
 */
function classifyFreeRuns(occupied: Set<number>, schedulable: Set<number>): FreeRunShape {
  const shape: FreeRunShape = { isolated: 0, consolidated: 0 };
  if (occupied.size < 2) return shape;

  const busy = [...occupied].sort((a, b) => a - b);
  const first = busy[0];
  const last = busy[busy.length - 1];

  const free = [...schedulable]
    .filter((p) => p > first && p < last && !occupied.has(p))
    .sort((a, b) => a - b);

  let run = 0;
  for (let i = 0; i < free.length; i++) {
    run = i > 0 && free[i] === free[i - 1] + 1 ? run + 1 : 1;
    const endOfRun = i === free.length - 1 || free[i + 1] !== free[i] + 1;
    if (endOfRun) {
      if (run === 1) shape.isolated++;
      else shape.consolidated++;
    }
  }
  return shape;
}

/** Count idle schedulable periods between a class's first and last lesson. */
function countClassGaps(occupied: Set<number>, schedulable: Set<number>): number {
  if (occupied.size < 2) return 0;
  const busy = [...occupied].sort((a, b) => a - b);
  const first = busy[0];
  const last = busy[busy.length - 1];
  let gaps = 0;
  for (const p of schedulable) {
    if (p > first && p < last && !occupied.has(p)) gaps++;
  }
  return gaps;
}

/**
 * Evaluate a committed timetable.
 *
 * `unplacedPeriods` must be supplied by the caller — it is a property of the
 * solve, not of the grid (the grid cannot know what was meant to be on it).
 */
export function scoreSchedule(
  data: AppData,
  schedule: AppData["schedule"],
  unplacedPeriods = 0,
  weights: ObjectiveWeights = OBJECTIVE_WEIGHTS,
): ObjectiveScore {
  const structureCache = new Map<string, Set<number>>();

  // --- Walk the grid once, collecting per-class and per-teacher occupancy. ---
  const classOccupancy = new Map<string, Map<number, Set<number>>>();
  const teacherOccupancy = new Map<string, Map<number, Set<number>>>();
  const teacherClasses = new Map<string, Set<string>>();
  const teacherTotals = new Map<string, number>();

  for (const classId of Object.keys(schedule)) {
    const byDay = schedule[classId];
    if (!byDay) continue;

    for (const dayKey of Object.keys(byDay)) {
      const day = Number(dayKey);
      const byPeriod = byDay[day];
      if (!byPeriod) continue;

      for (const periodKey of Object.keys(byPeriod)) {
        const period = Number(periodKey);
        const slot = byPeriod[period];
        if (!slot) continue;

        if (!classOccupancy.has(classId)) classOccupancy.set(classId, new Map());
        const cd = classOccupancy.get(classId)!;
        if (!cd.has(day)) cd.set(day, new Set());
        cd.get(day)!.add(period);

        const tid = slot.teacherId;
        if (!tid) continue;

        if (!teacherClasses.has(tid)) teacherClasses.set(tid, new Set());
        teacherClasses.get(tid)!.add(classId);

        if (!teacherOccupancy.has(tid)) teacherOccupancy.set(tid, new Map());
        const td = teacherOccupancy.get(tid)!;
        if (!td.has(day)) td.set(day, new Set());
        // Co-teaching two classes in one slot is still one occupied period.
        if (!td.get(day)!.has(period)) {
          td.get(day)!.add(period);
          teacherTotals.set(tid, (teacherTotals.get(tid) ?? 0) + 1);
        }
      }
    }
  }

  // --- Class gaps ---
  let classGapPeriods = 0;
  for (const [classId, byDay] of classOccupancy) {
    for (const [day, occupied] of byDay) {
      classGapPeriods += countClassGaps(
        occupied,
        classSchedulablePeriods(data, classId, day, structureCache),
      );
    }
  }

  // --- Teacher free-time shape ---
  const teacherById = new Map(data.teachers.map((t) => [t.id, t]));
  let fragmentedTeacherGaps = 0;
  let consolidatedTeacherBlocks = 0;

  for (const [teacherId, byDay] of teacherOccupancy) {
    const teacher = teacherById.get(teacherId);
    const taughtClasses = teacherClasses.get(teacherId) ?? new Set<string>();

    for (const [day, occupied] of byDay) {
      // A teacher moves between classes with different breaks, so their
      // schedulable set is the union across the classes they actually teach.
      const schedulable = new Set<number>();
      for (const classId of taughtClasses) {
        for (const p of classSchedulablePeriods(data, classId, day, structureCache)) {
          if (teacher?.constraints?.[day]?.[p]) continue;
          schedulable.add(p);
        }
      }
      const shape = classifyFreeRuns(occupied, schedulable);
      fragmentedTeacherGaps += shape.isolated;
      consolidatedTeacherBlocks += shape.consolidated;
    }
  }

  // --- Weekly cap breaches + load imbalance ---
  const weeklyCap = data.settings.maxTeachingPeriodsPerWeek;
  let weeklyCapExcess = 0;
  if (weeklyCap && weeklyCap > 0) {
    for (const total of teacherTotals.values()) {
      if (total > weeklyCap) weeklyCapExcess += total - weeklyCap;
    }
  }

  const loads = [...teacherTotals.values()];
  const mean = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 0;
  const loadImbalance = loads.reduce((sum, l) => sum + (l - mean) ** 2, 0);

  // --- Curriculum gaps: requested periods missing from the grid ---
  const placedByClassSubject = new Map<string, number>();
  for (const classId of Object.keys(schedule)) {
    for (const dayKey of Object.keys(schedule[classId] ?? {})) {
      const day = Number(dayKey);
      for (const periodKey of Object.keys(schedule[classId][day] ?? {})) {
        const slot = schedule[classId][day][Number(periodKey)];
        if (!slot?.subjectId) continue;
        const key = `${classId}:${slot.subjectId}`;
        placedByClassSubject.set(key, (placedByClassSubject.get(key) ?? 0) + 1);
      }
    }
  }

  let curriculumGapPeriods = 0;
  for (const cls of data.classes) {
    for (const item of cls.curriculum ?? []) {
      const placed = placedByClassSubject.get(`${cls.id}:${item.subjectId}`) ?? 0;
      const missing = (item.periodsPerWeek || 0) - placed;
      if (missing > 0) curriculumGapPeriods += missing;
    }
  }

  const breakdown: ObjectiveBreakdown = {
    curriculumGapPeriods,
    weeklyCapExcess,
    loadImbalance: Number(loadImbalance.toFixed(2)),
    fragmentedTeacherGaps,
    consolidatedTeacherBlocks,
    classGapPeriods,
  };

  const softCost =
    weights.CURRICULUM_GAP * curriculumGapPeriods +
    weights.WEEKLY_CAP_EXCESS * weeklyCapExcess +
    weights.LOAD_IMBALANCE * loadImbalance +
    weights.CLASS_GAP * classGapPeriods +
    weights.FRAGMENTED_TEACHER_GAP * fragmentedTeacherGaps;

  return {
    unplacedPeriods,
    softCost: Number(softCost.toFixed(2)),
    breakdown,
  };
}
