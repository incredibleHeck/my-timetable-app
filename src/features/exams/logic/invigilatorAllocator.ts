import { AppData, ExamSession } from "../../../types";
import {
  getConstraintDayIndex,
  getExamTimeRange,
  getInvigilationSplitId,
  getPeriodIndicesOverlapping,
  getStreamLevel,
  getWeekKey,
  isOverlapping,
  seededShuffle,
} from "./examUtils";

export interface AllocationConfig {
  minInvigilators: number;
  maxInvigilators: number;
  excludedTeacherIds?: string[];
  /**
   * Varies the tie-break order. Allocation is reproducible for a given seed, so
   * re-running on unchanged input returns the same roster; pass a new seed to
   * deliberately draw a different one.
   */
  seed?: number;
}

export interface AllocationResult {
  exams: ExamSession[];
  warnings: string[];
}

/** Matches the exam generator's default, so both are reproducible by default. */
const DEFAULT_SEED = 42;

type DaySlotRange = {
  start: number;
  end: number;
  periodIndices: number[];
};

const buildDaySlots = (
  classExams: ExamSession[],
  timeSlots: AppData["settings"]["timeSlots"],
): DaySlotRange[] =>
  classExams.map((e) => {
    const { start, end } = getExamTimeRange(e);
    return {
      start,
      end,
      periodIndices: getPeriodIndicesOverlapping(timeSlots, start, end),
    };
  });

const isBlockedByConstraints = (
  teacher: AppData["teachers"][0],
  dayIdx: number | null,
  daySlots: DaySlotRange[],
): boolean => {
  if (dayIdx === null) return false;
  return daySlots.some((slot) =>
    slot.periodIndices.some((pIdx) => teacher.constraints?.[dayIdx]?.[pIdx] === true),
  );
};

const slotsOverlap = (a: DaySlotRange[], b: DaySlotRange[]): boolean =>
  a.some((sa) => b.some((sb) => isOverlapping(sa.start, sa.end, sb.start, sb.end)));

const markTeacherBusy = (
  busyTeachers: Record<string, { start: number; end: number }[]>,
  teacherId: string,
  slots: DaySlotRange[],
) => {
  if (!busyTeachers[teacherId]) busyTeachers[teacherId] = [];
  slots.forEach((s) => busyTeachers[teacherId].push({ start: s.start, end: s.end }));
};

const isTeacherBusyInSlots = (
  teacherId: string,
  requiredSlots: DaySlotRange[],
  busyTeachers: Record<string, { start: number; end: number }[]>,
): boolean => {
  const busy = busyTeachers[teacherId];
  if (!busy?.length) return false;
  return busy.some((busySlot) =>
    requiredSlots.some((req) => isOverlapping(busySlot.start, busySlot.end, req.start, req.end)),
  );
};

const pickTeachersForClass = (
  teachers: AppData["teachers"],
  config: AllocationConfig,
  ctx: {
    classId: string;
    classLevel: string;
    classExams: ExamSession[];
    unlockedExams: ExamSession[];
    classTeams: Record<string, string[]>;
    daySlots: DaySlotRange[];
    dayIdx: number | null;
    weekKey: string;
    busyTeachers: Record<string, { start: number; end: number }[]>;
    teacherLoad: Record<string, number>;
    getWeekStreams: (weekKey: string, teacherId: string) => Set<string>;
    timeSlots: AppData["settings"]["timeSlots"];
    targetCount: number;
    existingTeam: string[];
    seed: number;
  },
): string[] => {
  const selectedIds = [...ctx.existingTeam];

  while (selectedIds.length < ctx.targetCount) {
    const availableTeachers = teachers.filter((t) => {
      if (config.excludedTeacherIds?.includes(t.id)) return false;
      if (selectedIds.includes(t.id)) return false;
      if (ctx.getWeekStreams(ctx.weekKey, t.id).has(ctx.classLevel)) return false;
      if (isBlockedByConstraints(t, ctx.dayIdx, ctx.daySlots)) return false;
      if (isTeacherBusyInSlots(t.id, ctx.daySlots, ctx.busyTeachers)) return false;

      const busyWithOtherClass = Object.entries(ctx.classTeams).some(([otherClassId, teamIds]) => {
        if (otherClassId === ctx.classId || !teamIds.includes(t.id)) {
          return false;
        }
        const otherClassExams = ctx.unlockedExams.filter((e) => e.classIds.includes(otherClassId));
        const otherSlots = buildDaySlots(otherClassExams, ctx.timeSlots);
        return slotsOverlap(ctx.daySlots, otherSlots);
      });

      return !busyWithOtherClass;
    });

    if (availableTeachers.length === 0) break;

    const randomizedPool = seededShuffle(availableTeachers, ctx.seed);
    randomizedPool.sort((a, b) => ctx.teacherLoad[a.id] - ctx.teacherLoad[b.id]);
    const selectedId = randomizedPool[0].id;

    selectedIds.push(selectedId);
    ctx.teacherLoad[selectedId]++;
    ctx.getWeekStreams(ctx.weekKey, selectedId).add(ctx.classLevel);
    markTeacherBusy(ctx.busyTeachers, selectedId, ctx.daySlots);
  }

  return selectedIds;
};

/**
 * Assign invigilators per class (stream) per exam day (min–max range).
 * The team covers Session 1 and Session 2 together.
 * During exam periods normal teaching is suspended — class timetable is not checked.
 */
export const allocateInvigilators = (data: AppData, config: AllocationConfig): AllocationResult => {
  const { teachers, settings, exams, classes } = data;
  const resultExams: ExamSession[] = [];
  const warnings: string[] = [];

  const minTeam = Math.max(1, config.minInvigilators);
  const maxTeam = Math.max(minTeam, config.maxInvigilators);
  const seed = config.seed ?? DEFAULT_SEED;

  const teacherLoad: Record<string, number> = {};
  teachers.forEach((t) => (teacherLoad[t.id] = 0));

  const weeklyStreamsByWeek: Record<string, Record<string, Set<string>>> = {};

  const getWeekStreams = (weekKey: string, teacherId: string): Set<string> => {
    if (!weeklyStreamsByWeek[weekKey]) weeklyStreamsByWeek[weekKey] = {};
    if (!weeklyStreamsByWeek[weekKey][teacherId]) {
      weeklyStreamsByWeek[weekKey][teacherId] = new Set();
    }
    return weeklyStreamsByWeek[weekKey][teacherId];
  };

  const resolveLevel = (classId: string) => getStreamLevel(classId, classes);

  exams
    .filter((e) => e.locked)
    .forEach((ex) => {
      const weekKey = getWeekKey(ex.date);
      (ex.invigilatorIds || []).forEach((tId) => {
        teacherLoad[tId]++;
        ex.classIds.forEach((cid) => {
          getWeekStreams(weekKey, tId).add(resolveLevel(cid));
        });
      });
    });

  const uniqueDates = Array.from(new Set(exams.map((e) => e.date))).sort();

  uniqueDates.forEach((date) => {
    const weekKey = getWeekKey(date);
    const examsOnDate = exams.filter((e) => e.date === date);
    const lockedExams = examsOnDate.filter((e) => e.locked);
    const unlockedExams = examsOnDate.filter((e) => !e.locked);

    resultExams.push(...lockedExams);
    if (unlockedExams.length === 0) return;

    const busyTeachers: Record<string, { start: number; end: number }[]> = {};

    lockedExams.forEach((exam) => {
      const { start, end } = getExamTimeRange(exam);
      (exam.invigilatorIds || []).forEach((tId) => {
        if (!busyTeachers[tId]) busyTeachers[tId] = [];
        busyTeachers[tId].push({ start, end });
      });
    });

    const classesOnDate = Array.from(new Set(unlockedExams.flatMap((e) => e.classIds)));
    const classTeams: Record<string, string[]> = {};
    const shuffledClasses = seededShuffle(classesOnDate, seed);
    const dayIdx = getConstraintDayIndex(date);

    const formatClass = (classId: string) => classes.find((c) => c.id === classId)?.name || classId;

    shuffledClasses.forEach((classId) => {
      const classLevel = resolveLevel(classId);
      const classExams = unlockedExams.filter((e) => e.classIds.includes(classId));
      if (classExams.length === 0) return;

      const daySlots = buildDaySlots(classExams, settings.timeSlots);
      const pickCtx = {
        classId,
        classLevel,
        classExams,
        unlockedExams,
        classTeams,
        daySlots,
        dayIdx,
        weekKey,
        busyTeachers,
        teacherLoad,
        getWeekStreams,
        timeSlots: settings.timeSlots,
        targetCount: 0,
        existingTeam: [] as string[],
        seed,
      };

      const team = pickTeachersForClass(teachers, config, {
        ...pickCtx,
        targetCount: minTeam,
        existingTeam: [],
      });

      let finalTeam = team;
      if (maxTeam > minTeam) {
        finalTeam = pickTeachersForClass(teachers, config, {
          ...pickCtx,
          targetCount: maxTeam,
          existingTeam: team,
        });
      }

      classTeams[classId] = finalTeam;

      // One line per class per day. A short-staffed class used to raise up to
      // three overlapping warnings — under-staffed, none assigned, and one more
      // per sitting — so a handful of gaps read as a wall of text.
      if (finalTeam.length === 0) {
        warnings.push(`${formatClass(classId)} on ${date}: no invigilator available.`);
      } else if (finalTeam.length < minTeam) {
        warnings.push(
          `${formatClass(classId)} on ${date}: ${finalTeam.length} of ${minTeam} invigilators assigned.`,
        );
      }
    });

    unlockedExams.forEach((originalExam) => {
      originalExam.classIds.forEach((cid) => {
        const team = classTeams[cid] || [];
        resultExams.push({
          ...originalExam,
          id: getInvigilationSplitId(originalExam.id, cid),
          classIds: [cid],
          invigilatorIds: [...team],
        });
      });
    });
  });

  return { exams: resultExams, warnings };
};
