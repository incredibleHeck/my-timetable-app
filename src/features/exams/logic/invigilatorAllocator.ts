import { AppData, ExamSession } from "../../../types";
import { generateId } from "../../../utils/utils";

interface AllocationConfig {
  minInvigilators: number;
  maxInvigilators: number;
  excludedTeacherIds?: string[];
}

// Helper: Parse HH:MM to minutes
const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Helper: Check if two time ranges overlap
const isOverlapping = (s1: number, e1: number, s2: number, e2: number) => {
  return s1 < e2 && e1 > s2;
};

// Helper: True random shuffle (Fisher-Yates)
const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const allocateInvigilators = (
  data: AppData,
  config: AllocationConfig
): ExamSession[] => {
  const { teachers, settings, exams, classes } = data;

  // We will build a new list of exams
  const resultExams: ExamSession[] = [];

  // 1. Prepare Load Tracker (to balance assignments)
  const teacherLoad: Record<string, number> = {};
  teachers.forEach((t) => (teacherLoad[t.id] = 0));

  // 2. Prepare Weekly Stream Tracker (No duplicate levels per teacher per week)
  // Maps TeacherID -> Set of Stream Levels (e.g. "10", "11")
  const teacherWeeklyStreams: Record<string, Set<string>> = {};
  teachers.forEach(t => (teacherWeeklyStreams[t.id] = new Set()));

  // Helper to resolve stream level safely (Groups 1A, 1B as "1")
  const getStreamLevel = (classId: string) => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return classId;
    if (cls.level) return cls.level;

    // Smart parsing: Extract digits or base prefix (e.g., "10A" -> "10", "Grade 1" -> "1")
    const match = cls.name.match(/(\d+)/);
    return match ? match[1] : cls.name;
  };

  // Pre-populate trackers with locked exams across the WHOLE week
  exams.filter(e => e.locked).forEach(ex => {
    (ex.invigilatorIds || []).forEach(tId => {
      teacherLoad[tId]++;
      ex.classIds.forEach(cid => {
        const lvl = getStreamLevel(cid);
        if (teacherWeeklyStreams[tId]) teacherWeeklyStreams[tId].add(lvl);
      });
    });
  });

  // 3. Map HH:MM to Period Index for constraints
  const getPeriodIndex = (timeStr: string) => {
    const timeMins = parseTime(timeStr);
    let bestIdx = 0;
    let minDiff = Infinity;

    settings.timeSlots.forEach((slot, idx) => {
      const startMins = parseTime(slot.start);
      const diff = Math.abs(timeMins - startMins);
      if (diff < minDiff) {
        minDiff = diff;
        bestIdx = idx;
      }
    });
    return bestIdx;
  };

  // 4. Process assignments Date by Date
  const uniqueDates = Array.from(new Set(exams.map((e) => e.date))).sort();

  uniqueDates.forEach((date) => {
    // Separate exams into Locked (Keep as is) and Unlocked (Re-assign)
    const examsOnDate = exams.filter((e) => e.date === date);
    const lockedExams = examsOnDate.filter((e) => e.locked);
    const unlockedExams = examsOnDate.filter((e) => !e.locked);

    // Push locked exams to result immediately
    resultExams.push(...lockedExams);

    // If no exams to schedule, skip
    if (unlockedExams.length === 0) return;

    // --- PRE-PROCESSING: Respect Locked Assignments for overlapping check ---
    const busyTeachers: Record<string, { start: number; end: number }[]> = {};

    lockedExams.forEach((exam) => {
      const start = parseTime(exam.startTime);
      const end = start + exam.duration;

      (exam.invigilatorIds || []).forEach((tId) => {
        if (!busyTeachers[tId]) busyTeachers[tId] = [];
        busyTeachers[tId].push({ start, end });
      });
    });

    // --- MAIN ALLOCATION FOR UNLOCKED EXAMS ---

    // Get unique classes involved in UNLOCKED exams
    const classesOnDate = Array.from(
      new Set(unlockedExams.flatMap((e) => e.classIds))
    );

    // Track assigned teams for this day to prevent conflicts between simultaneous exams
    const classTeams: Record<string, string[]> = {};

    // Shuffle classes to ensure fairness
    const shuffledClasses = shuffleArray(classesOnDate);

    // STEP A: Assign MINIMUM teachers
    shuffledClasses.forEach((classId) => {
      const classLevel = getStreamLevel(classId);
      const classExams = unlockedExams.filter((e) =>
        e.classIds.includes(classId)
      );
      if (classExams.length === 0) return;

      const daySlots = classExams.map((e) => {
        const start = parseTime(e.startTime);
        return {
          start,
          end: start + e.duration,
          periodIdx: getPeriodIndex(e.startTime),
        };
      });

      const dateObj = new Date(date);
      let dayIdx = dateObj.getDay() - 1;
      if (dayIdx < 0 || dayIdx > 4) dayIdx = 0; // Normalize weekend/default

      // Filter Available Teachers
      const availableTeachers = teachers.filter((t) => {
        // 0. Exclusion Check: Is teacher manually excluded from invigilation?
        if (config.excludedTeacherIds?.includes(t.id)) return false;

        // 1. Weekly Stream Restriction: Has teacher invigilated this level already this week?
        if (teacherWeeklyStreams[t.id].has(classLevel)) return false;

        // 2. Check Constraint Matrix (Is teacher working today?)
        const isBlockedBySettings = daySlots.some(
          (slot) => t.constraints?.[dayIdx]?.[slot.periodIdx] === true
        );
        if (isBlockedBySettings) return false;

        // 3. Check Locked Exams (Is teacher already booked at this time?)
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

        // 4. Check Dynamic Assignments (Concurrent exams)
        const isBusyDynamic = Object.entries(classTeams).some(
          ([otherClassId, teamIds]) => {
            if (!teamIds.includes(t.id)) return false;
            const otherClassExams = unlockedExams.filter((e) =>
              e.classIds.includes(otherClassId)
            );
            return otherClassExams.some((oe) => {
              const oStart = parseTime(oe.startTime);
              const oEnd = oStart + oe.duration;
              return daySlots.some((s) =>
                isOverlapping(s.start, s.end, oStart, oEnd)
              );
            });
          }
        );

        return !isBusyDynamic;
      });

      // Sort by Load (Ascending) then Shuffle for randomness among equals
      const randomizedPool = shuffleArray(availableTeachers);
      randomizedPool.sort((a, b) => teacherLoad[a.id] - teacherLoad[b.id]);

      // Assign Minimum
      const selectedIds = randomizedPool
        .slice(0, config.minInvigilators)
        .map((t) => t.id);

      classTeams[classId] = selectedIds;
      selectedIds.forEach((id) => {
        teacherLoad[id]++;
        teacherWeeklyStreams[id].add(classLevel);
      });
    });

    // STEP B: Distribute EXTRA teachers (Workload Filling)
    if (config.maxInvigilators > config.minInvigilators) {
      shuffledClasses.forEach((classId) => {
        const classLevel = getStreamLevel(classId);
        const currentTeam = classTeams[classId] || [];
        if (currentTeam.length >= config.maxInvigilators) return;

        const classExams = unlockedExams.filter((e) =>
          e.classIds.includes(classId)
        );
        const daySlots = classExams.map((e) => {
          const start = parseTime(e.startTime);
          return {
            start,
            end: start + e.duration,
            periodIdx: getPeriodIndex(e.startTime),
          };
        });

        const dateObj = new Date(date);
        let dayIdx = dateObj.getDay() - 1;
        if (dayIdx < 0 || dayIdx > 4) dayIdx = 0;

        const extrasNeeded = config.maxInvigilators - currentTeam.length;

        const availableExtras = teachers.filter((t) => {
          if (currentTeam.includes(t.id)) return false; // Already assigned

          // 0. Exclusion Check
          if (config.excludedTeacherIds?.includes(t.id)) return false;

          // 1. Weekly Stream Restriction
          if (teacherWeeklyStreams[t.id].has(classLevel)) return false;

          // 2. Settings Check
          const isBlockedBySettings = daySlots.some(
            (slot) => t.constraints?.[dayIdx]?.[slot.periodIdx] === true
          );
          if (isBlockedBySettings) return false;

          // 3. Locked Exams Check
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

          // 4. Dynamic Check
          const isBusyDynamic = Object.entries(classTeams).some(
            ([otherClassId, teamIds]) => {
              if (!teamIds.includes(t.id)) return false;
              const otherClassExams = unlockedExams.filter((e) =>
                e.classIds.includes(otherClassId)
              );
              return otherClassExams.some((oe) => {
                const oStart = parseTime(oe.startTime);
                const oEnd = oStart + oe.duration;
                return daySlots.some((s) =>
                  isOverlapping(s.start, s.end, oStart, oEnd)
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
          teacherWeeklyStreams[id].add(classLevel);
        });
      });
    }

    // STEP C: Apply to Sessions (Fork/Split Logic)
    unlockedExams.forEach((originalExam) => {
      originalExam.classIds.forEach((cid) => {
        resultExams.push({
          ...originalExam,
          id: generateId(),
          classIds: [cid],
          invigilatorIds: classTeams[cid] || [],
        });
      });
    });
  });

  return resultExams;
};
