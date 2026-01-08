import { AppData, ExamSession, Subject, ClassGroup } from "../../../types";
import { generateId } from "../../../utils/utils";

export type ScheduleMode = "UNIFORM" | "RANDOM";

interface GeneratorConfig {
  subjects: { id: string; papers: number; duration: number }[];
  selectedClassIds?: string[]; // NEW: Optional filter for classes
  mode: ScheduleMode;
  startDate: string;
  startTime: string;
  maxPerDay: number;
  gapMinutes: number;
  syncStreams: boolean; // NEW: Forces classes of same level to sync
}

// Helper: Parse HH:MM to minutes
const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Helper: Format minutes to HH:MM
const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// Helper: Shuffle
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
): ExamSession[] => {
  if (!config.subjects || config.subjects.length === 0) return [];
  
  const newSessions: ExamSession[] = [];
  const GLOBAL_MAX_DAYS = 60;
  const startMin = parseTime(config.startTime);

  // Filter classes based on selection
  const targetClasses = config.selectedClassIds && config.selectedClassIds.length > 0
    ? data.classes.filter(c => config.selectedClassIds?.includes(c.id))
    : data.classes;

  if (targetClasses.length === 0) return [];

  // Ledger: ClassID -> Busy Time Ranges
  const classSchedules: Record<
    string,
    { start: number; end: number; date: string }[]
  > = {};
  targetClasses.forEach((c) => (classSchedules[c.id] = []));

  const maxPapers = Math.max(0, ...config.subjects.map((c) => c.papers));
  const baseDate = new Date(config.startDate);

  // LOOP THROUGH PAPERS (1, then 2...)
  for (let p = 1; p <= maxPapers; p++) {
    // Get subjects for this paper, sorted by duration (Longest first)
    const currentSubjects = config.subjects
      .filter((s) => s.papers >= p)
      .sort((a, b) => b.duration - a.duration);

    // -----------------------------------------------------------------------
    // MODE A: UNIFORM (Entire Cohort Sync)
    // -----------------------------------------------------------------------
    if (config.mode === "UNIFORM") {
      currentSubjects.forEach((sub) => {
        const involvedClassIds = targetClasses
          .filter((c) => c.curriculum.some((curr) => curr.subjectId === sub.id))
          .map((c) => c.id);

        if (involvedClassIds.length === 0) return;

        attemptSchedule(
          [involvedClassIds], // Treat as one giant block
          sub,
          p,
          data,
          newSessions,
          classSchedules,
          config,
          baseDate,
          startMin,
          GLOBAL_MAX_DAYS
        );
      });
    }

    // -----------------------------------------------------------------------
    // MODE B: RANDOM (With Stream Linking)
    // -----------------------------------------------------------------------
    else {
      let schedulingUnits: {
        classIds: string[];
        subject: (typeof currentSubjects)[0];
      }[] = [];

      currentSubjects.forEach((sub) => {
        const involvedClasses = targetClasses.filter((c) =>
          c.curriculum.some((curr) => curr.subjectId === sub.id)
        );

        if (config.syncStreams) {
          // GROUP BY LEVEL (or Joint Class)
          // We group classes that share the same 'level' property (e.g. "10", "11")
          const levelGroups: Record<string, string[]> = {};

          involvedClasses.forEach((c) => {
            const key = c.level || c.name.replace(/\D/g, "") || c.id; // Fallback to ID if no level
            if (!levelGroups[key]) levelGroups[key] = [];
            levelGroups[key].push(c.id);
          });

          // Add these groups as units
          Object.values(levelGroups).forEach((group) => {
            schedulingUnits.push({ classIds: group, subject: sub });
          });
        } else {
          // Pure Random (Individual)
          involvedClasses.forEach((c) => {
            schedulingUnits.push({ classIds: [c.id], subject: sub });
          });
        }
      });

      // SHUFFLE THE UNITS
      schedulingUnits = shuffle(schedulingUnits);

      // Schedule them
      schedulingUnits.forEach((unit) => {
        attemptSchedule(
          [unit.classIds],
          unit.subject,
          p,
          data,
          newSessions,
          classSchedules,
          config,
          baseDate,
          startMin,
          GLOBAL_MAX_DAYS
        );
      });
    }
  }

  return newSessions;
};

// CORE SCHEDULING FUNCTION
const attemptSchedule = (
  groups: string[][], // Array of class ID arrays. Uniform = [[A,B,C]], Random = [[A], [B]]
  subject: { id: string; duration: number },
  paperNum: number,
  data: AppData,
  sessions: ExamSession[],
  ledger: Record<string, any[]>,
  config: GeneratorConfig,
  baseDate: Date,
  startMin: number,
  maxDays: number
) => {
  groups.forEach((groupClassIds) => {
    let dayOffset = 0;
    let scheduled = false;

    while (!scheduled && dayOffset < maxDays) {
      const currentD = new Date(baseDate);
      currentD.setDate(baseDate.getDate() + dayOffset);

      // Skip Weekends
      if (currentD.getDay() === 0 || currentD.getDay() === 6) {
        dayOffset++;
        continue;
      }

      const dateStr = currentD.toISOString().split("T")[0];
      let attemptTime = startMin;
      const dayEndLimit = 16 * 60; // 4 PM

      while (attemptTime + subject.duration <= dayEndLimit) {
        const attemptEnd = attemptTime + subject.duration;

        // 1. Availability Check
        const allFree = groupClassIds.every((cid) => {
          const booked = ledger[cid].filter((b) => b.date === dateStr);
          return !booked.some(
            (b) =>
              attemptTime < b.end + config.gapMinutes &&
              attemptEnd + config.gapMinutes > b.start
          );
        });

        // 2. Daily Limit Check
        const underLimit = groupClassIds.every((cid) => {
          const count = ledger[cid].filter((b) => b.date === dateStr).length;
          return count < config.maxPerDay;
        });

        // 3. Paper Clash Check (No Math P2 on same day as Math P1)
        const subjectClash = sessions.some(
          (s) =>
            s.subjectId === subject.id &&
            s.date === dateStr &&
            s.classIds.some((c) => groupClassIds.includes(c))
        );

        if (allFree && underLimit && !subjectClash) {
          // Success
          const timeStr = formatTime(attemptTime);

          sessions.push({
            id: generateId(),
            subjectId: subject.id,
            classIds: groupClassIds,
            date: dateStr,
            startTime: timeStr,
            duration: subject.duration,
            paperNumber: paperNum,
            paperLabel: `Paper ${paperNum}`,
            status: "DRAFT",
            roomId: undefined,
            locked: false,
          });

          // Update Ledger
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
        attemptTime += 30; // 30 min increments
      }
      if (!scheduled) dayOffset++;
    }
  });
};
