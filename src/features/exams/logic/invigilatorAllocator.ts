import { AppData, ExamSession } from "../../../types";
import {
  getConstraintDayIndex,
  getExamTimeRange,
  getInvigilationSplitId,
  getPeriodIndicesOverlapping,
  getStreamLevel,
  getWeekKey,
  isOverlapping,
  isTeacherBusyInClassSchedule,
  parseTime,
} from "./examUtils";

export interface AllocationConfig {
  minInvigilators: number;
  maxInvigilators: number;
  excludedTeacherIds?: string[];
}

export interface AllocationResult {
  exams: ExamSession[];
  warnings: string[];
}

const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

type DaySlotRange = {
  start: number;
  end: number;
  periodIndices: number[];
};

const buildDaySlots = (
  classExams: ExamSession[],
  timeSlots: AppData["settings"]["timeSlots"]
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
  daySlots: DaySlotRange[]
): boolean => {
  if (dayIdx === null) return false;
  return daySlots.some((slot) =>
    slot.periodIndices.some(
      (pIdx) => teacher.constraints?.[dayIdx]?.[pIdx] === true
    )
  );
};

const isTeachingDuringSlots = (
  teacherId: string,
  classExams: ExamSession[],
  data: AppData
): boolean =>
  classExams.some((e) => isTeacherBusyInClassSchedule(teacherId, e, data));

export const allocateInvigilators = (
  data: AppData,
  config: AllocationConfig
): AllocationResult => {
  const { teachers, settings, exams, classes } = data;
  const resultExams: ExamSession[] = [];
  const warnings: string[] = [];

  const teacherLoad: Record<string, number> = {};
  teachers.forEach((t) => (teacherLoad[t.id] = 0));

  /** weekKey -> teacherId -> Set of stream levels */
  const weeklyStreamsByWeek: Record<string, Record<string, Set<string>>> = {};

  const getWeekStreams = (weekKey: string, teacherId: string): Set<string> => {
    if (!weeklyStreamsByWeek[weekKey]) weeklyStreamsByWeek[weekKey] = {};
    if (!weeklyStreamsByWeek[weekKey][teacherId]) {
      weeklyStreamsByWeek[weekKey][teacherId] = new Set();
    }
    return weeklyStreamsByWeek[weekKey][teacherId];
  };

  const resolveLevel = (classId: string) =>
    getStreamLevel(classId, classes);

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

    const classesOnDate = Array.from(
      new Set(unlockedExams.flatMap((e) => e.classIds))
    );
    const classTeams: Record<string, string[]> = {};
    const shuffledClasses = shuffleArray(classesOnDate);
    const dayIdx = getConstraintDayIndex(date);

    const formatClass = (classId: string) =>
      classes.find((c) => c.id === classId)?.name || classId;

    shuffledClasses.forEach((classId) => {
      const classLevel = resolveLevel(classId);
      const classExams = unlockedExams.filter((e) =>
        e.classIds.includes(classId)
      );
      if (classExams.length === 0) return;

      const daySlots = buildDaySlots(classExams, settings.timeSlots);

      const availableTeachers = teachers.filter((t) => {
        if (config.excludedTeacherIds?.includes(t.id)) return false;
        if (getWeekStreams(weekKey, t.id).has(classLevel)) return false;
        if (isBlockedByConstraints(t, dayIdx, daySlots)) return false;
        if (isTeachingDuringSlots(t.id, classExams, data)) return false;

        if (busyTeachers[t.id]) {
          const isBusyLocked = busyTeachers[t.id].some((busySlot) =>
            daySlots.some((reqSlot) =>
              isOverlapping(
                busySlot.start,
                busySlot.end,
                reqSlot.start,
                reqSlot.end
              )
            )
          );
          if (isBusyLocked) return false;
        }

        const isBusyDynamic = Object.entries(classTeams).some(
          ([otherClassId, teamIds]) => {
            if (!teamIds.includes(t.id)) return false;
            const otherClassExams = unlockedExams.filter((e) =>
              e.classIds.includes(otherClassId)
            );
            return otherClassExams.some((oe) => {
              const oRange = getExamTimeRange(oe);
              return daySlots.some((s) =>
                isOverlapping(s.start, s.end, oRange.start, oRange.end)
              );
            });
          }
        );

        return !isBusyDynamic;
      });

      if (availableTeachers.length < config.minInvigilators) {
        warnings.push(
          `Under-staffed: ${formatClass(classId)} on ${date} needs ${config.minInvigilators} invigilators but only ${availableTeachers.length} available.`
        );
      }

      const randomizedPool = shuffleArray(availableTeachers);
      randomizedPool.sort((a, b) => teacherLoad[a.id] - teacherLoad[b.id]);

      const selectedIds = randomizedPool
        .slice(0, config.minInvigilators)
        .map((t) => t.id);

      classTeams[classId] = selectedIds;
      selectedIds.forEach((id) => {
        teacherLoad[id]++;
        getWeekStreams(weekKey, id).add(classLevel);
      });

      if (selectedIds.length === 0) {
        warnings.push(
          `No invigilators assigned: ${formatClass(classId)} on ${date}.`
        );
      }
    });

    if (config.maxInvigilators > config.minInvigilators) {
      shuffledClasses.forEach((classId) => {
        const classLevel = resolveLevel(classId);
        const currentTeam = classTeams[classId] || [];
        if (currentTeam.length >= config.maxInvigilators) return;

        const classExams = unlockedExams.filter((e) =>
          e.classIds.includes(classId)
        );
        const daySlots = buildDaySlots(classExams, settings.timeSlots);
        const extrasNeeded = config.maxInvigilators - currentTeam.length;

        const availableExtras = teachers.filter((t) => {
          if (currentTeam.includes(t.id)) return false;
          if (config.excludedTeacherIds?.includes(t.id)) return false;
          if (getWeekStreams(weekKey, t.id).has(classLevel)) return false;
          if (isBlockedByConstraints(t, dayIdx, daySlots)) return false;
          if (isTeachingDuringSlots(t.id, classExams, data)) return false;

          if (busyTeachers[t.id]) {
            const isBusyLocked = busyTeachers[t.id].some((busySlot) =>
              daySlots.some((reqSlot) =>
                isOverlapping(
                  busySlot.start,
                  busySlot.end,
                  reqSlot.start,
                  reqSlot.end
                )
              )
            );
            if (isBusyLocked) return false;
          }

          const isBusyDynamic = Object.entries(classTeams).some(
            ([otherClassId, teamIds]) => {
              if (!teamIds.includes(t.id)) return false;
              const otherClassExams = unlockedExams.filter((e) =>
                e.classIds.includes(otherClassId)
              );
              return otherClassExams.some((oe) => {
                const oRange = getExamTimeRange(oe);
                return daySlots.some((s) =>
                  isOverlapping(s.start, s.end, oRange.start, oRange.end)
                );
              });
            }
          );
          return !isBusyDynamic;
        });

        const randomizedExtras = shuffleArray(availableExtras);
        randomizedExtras.sort((a, b) => teacherLoad[a.id] - teacherLoad[b.id]);

        const extraIds = randomizedExtras
          .slice(0, extrasNeeded)
          .map((t) => t.id);

        classTeams[classId] = [...currentTeam, ...extraIds];
        extraIds.forEach((id) => {
          teacherLoad[id]++;
          getWeekStreams(weekKey, id).add(classLevel);
        });
      });
    }

    unlockedExams.forEach((originalExam) => {
      originalExam.classIds.forEach((cid) => {
        const team = classTeams[cid] || [];
        if (team.length === 0) {
          warnings.push(
            `No invigilators for ${formatClass(cid)} — ${originalExam.startTime} on ${date}.`
          );
        }
        resultExams.push({
          ...originalExam,
          id: getInvigilationSplitId(originalExam.id, cid),
          classIds: [cid],
          invigilatorIds: team,
        });
      });
    });
  });

  return { exams: resultExams, warnings };
};
