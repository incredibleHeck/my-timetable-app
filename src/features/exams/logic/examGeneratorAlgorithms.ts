import { AppData, ExamSession } from "../../../types";
import { generateId } from "../../../utils/utils";
import {
  formatTime,
  getDayEndMinutes,
  parseTime,
  pickExamRoom,
  seededShuffle,
  toLocalDateString,
} from "./examUtils";

export type ScheduleMode = "UNIFORM" | "RANDOM";

interface GeneratorConfig {
  subjects: { id: string; papers: number; duration: number }[];
  selectedClassIds?: string[];
  mode: ScheduleMode;
  startDate: string;
  startTime: string;
  maxPerDay: number;
  gapMinutes: number;
  syncStreams: boolean;
  deterministic?: boolean;
}

export interface UnscheduledUnit {
  subjectId: string;
  paperNumber: number;
  classIds: string[];
}

export interface GenerateExamsResult {
  sessions: ExamSession[];
  unscheduled: UnscheduledUnit[];
}

const shuffle = <T>(array: T[]): T[] => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const generateExams = (
  data: AppData,
  config: GeneratorConfig
): GenerateExamsResult => {
  const empty: GenerateExamsResult = { sessions: [], unscheduled: [] };
  if (!config.subjects || config.subjects.length === 0) return empty;

  const newSessions: ExamSession[] = [];
  const unscheduled: UnscheduledUnit[] = [];
  const GLOBAL_MAX_DAYS = 60;
  const startMin = parseTime(config.startTime);
  const dayEndLimit = getDayEndMinutes(data.settings.timeSlots);

  const targetClasses =
    config.selectedClassIds && config.selectedClassIds.length > 0
      ? data.classes.filter((c) => config.selectedClassIds?.includes(c.id))
      : data.classes;

  if (targetClasses.length === 0) return empty;

  const classSchedules: Record<
    string,
    { start: number; end: number; date: string }[]
  > = {};
  targetClasses.forEach((c) => (classSchedules[c.id] = []));

  const maxPapers = Math.max(0, ...config.subjects.map((c) => c.papers));
  const baseDate = new Date(config.startDate + "T12:00:00");

  for (let p = 1; p <= maxPapers; p++) {
    const currentSubjects = config.subjects
      .filter((s) => s.papers >= p)
      .sort((a, b) => b.duration - a.duration);

    if (config.mode === "UNIFORM") {
      currentSubjects.forEach((sub) => {
        const involvedClassIds = targetClasses
          .filter((c) =>
            c.curriculum.some((curr) => curr.subjectId === sub.id)
          )
          .map((c) => c.id);

        if (involvedClassIds.length === 0) return;

        attemptSchedule(
          data,
          [involvedClassIds],
          sub,
          p,
          newSessions,
          classSchedules,
          config,
          baseDate,
          startMin,
          GLOBAL_MAX_DAYS,
          dayEndLimit,
          unscheduled
        );
      });
    } else {
      let schedulingUnits: {
        classIds: string[];
        subject: (typeof currentSubjects)[0];
      }[] = [];

      currentSubjects.forEach((sub) => {
        const involvedClasses = targetClasses.filter((c) =>
          c.curriculum.some((curr) => curr.subjectId === sub.id)
        );

        if (config.syncStreams) {
          const levelGroups: Record<string, string[]> = {};
          involvedClasses.forEach((c) => {
            const key = c.level || c.name.replace(/\D/g, "") || c.id;
            if (!levelGroups[key]) levelGroups[key] = [];
            levelGroups[key].push(c.id);
          });
          Object.values(levelGroups).forEach((group) => {
            schedulingUnits.push({ classIds: group, subject: sub });
          });
        } else {
          involvedClasses.forEach((c) => {
            schedulingUnits.push({ classIds: [c.id], subject: sub });
          });
        }
      });

      schedulingUnits = config.deterministic
        ? seededShuffle(schedulingUnits)
        : shuffle(schedulingUnits);
      schedulingUnits.forEach((unit) => {
        attemptSchedule(
          data,
          [unit.classIds],
          unit.subject,
          p,
          newSessions,
          classSchedules,
          config,
          baseDate,
          startMin,
          GLOBAL_MAX_DAYS,
          dayEndLimit,
          unscheduled
        );
      });
    }
  }

  return { sessions: newSessions, unscheduled };
};

const attemptSchedule = (
  data: AppData,
  groups: string[][],
  subject: { id: string; duration: number },
  paperNum: number,
  sessions: ExamSession[],
  ledger: Record<string, { start: number; end: number; date: string }[]>,
  config: GeneratorConfig,
  baseDate: Date,
  startMin: number,
  maxDays: number,
  dayEndLimit: number,
  unscheduled: UnscheduledUnit[]
) => {
  groups.forEach((groupClassIds) => {
    let dayOffset = 0;
    let scheduled = false;

    while (!scheduled && dayOffset < maxDays) {
      const currentD = new Date(baseDate);
      currentD.setDate(baseDate.getDate() + dayOffset);

      if (currentD.getDay() === 0 || currentD.getDay() === 6) {
        dayOffset++;
        continue;
      }

      const dateStr = toLocalDateString(currentD);
      let attemptTime = startMin;

      while (attemptTime + subject.duration <= dayEndLimit) {
        const attemptEnd = attemptTime + subject.duration;

        const allFree = groupClassIds.every((cid) => {
          const booked = ledger[cid].filter((b) => b.date === dateStr);
          return !booked.some(
            (b) =>
              attemptTime < b.end + config.gapMinutes &&
              attemptEnd + config.gapMinutes > b.start
          );
        });

        const underLimit = groupClassIds.every((cid) => {
          const count = ledger[cid].filter((b) => b.date === dateStr).length;
          return count < config.maxPerDay;
        });

        const subjectClash = sessions.some(
          (s) =>
            s.subjectId === subject.id &&
            s.date === dateStr &&
            s.classIds.some((c) => groupClassIds.includes(c))
        );

        if (allFree && underLimit && !subjectClash) {
          sessions.push({
            id: generateId(),
            subjectId: subject.id,
            classIds: groupClassIds,
            date: dateStr,
            startTime: formatTime(attemptTime),
            duration: subject.duration,
            paperNumber: paperNum,
            paperLabel: `Paper ${paperNum}`,
            status: "DRAFT",
            roomId: pickExamRoom(groupClassIds, data.classes, data.rooms),
            locked: false,
          });

          groupClassIds.forEach((cid) => {
            ledger[cid].push({
              date: dateStr,
              start: attemptTime,
              end: attemptEnd,
            });
          });

          scheduled = true;
          break;
        }
        attemptTime += 30;
      }
      if (!scheduled) dayOffset++;
    }

    if (!scheduled) {
      unscheduled.push({
        subjectId: subject.id,
        paperNumber: paperNum,
        classIds: groupClassIds,
      });
    }
  });
};
