import { AppData, ExamSession, Teacher } from "../../../types";
import { generateId } from "../../../utils/utils";

interface AllocationConfig {
  minInvigilators: number;
  maxInvigilators: number;
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

export const allocateInvigilators = (
  data: AppData,
  config: AllocationConfig
): ExamSession[] => {
  const { teachers, settings, exams, classes } = data;
  const newExams = [...exams];

  // 1. Prepare Load Tracker (to balance assignments)
  const teacherLoad: Record<string, number> = {};
  teachers.forEach((t) => (teacherLoad[t.id] = 0));

  // 2. Map HH:MM to Period Index for constraints
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

  // 3. Process assignments Date by Date
  const uniqueDates = Array.from(new Set(exams.map((e) => e.date))).sort();

  uniqueDates.forEach((date) => {
    const examsOnDate = newExams.filter((e) => e.date === date);
    const classesOnDate = Array.from(
      new Set(examsOnDate.flatMap((e) => e.classIds))
    );

    // Track which teachers are assigned to which class "Team" on this specific date
    // classTeams[classId] = string[] (teacher IDs)
    const classTeams: Record<string, string[]> = {};

    // Sort classes to randomize who gets first pick of teachers
    const shuffledClasses = [...classesOnDate].sort(() => Math.random() - 0.5);

    // STEP A: Assign MINIMUM teachers to every class team for this day
    shuffledClasses.forEach((classId) => {
      const classExams = examsOnDate.filter((e) => e.classIds.includes(classId));
      if (classExams.length === 0) return;

      // Determine all-day availability requirement for this class
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

      // Find teachers available for ALL exams this class writes today
      const availableTeachers = teachers.filter((t) => {
        // 1. Check constraints for all periods used today
        const isBlockedAny = daySlots.some(
          (slot) => t.constraints?.[dayIdx]?.[slot.periodIdx] === true
        );
        if (isBlockedAny) return false;

        // 2. Check if already assigned to another class team that overlaps in time
        const isConflict = Object.entries(classTeams).some(
          ([otherClassId, teamIds]) => {
            if (!teamIds.includes(t.id)) return false;
            const otherClassExams = examsOnDate.filter((e) =>
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

        return !isConflict;
      });

      // Sort available teachers by overall workload (least busy first)
      availableTeachers.sort((a, b) => teacherLoad[a.id] - teacherLoad[b.id]);

      // Assign Min
      const selectedIds = availableTeachers
        .slice(0, config.minInvigilators)
        .map((t) => t.id);
      
      classTeams[classId] = selectedIds;
      selectedIds.forEach((id) => teacherLoad[id]++);
    });

    // STEP B: Distribute EXTRA teachers up to MAX if available (Workload filling)
    if (config.maxInvigilators > config.minInvigilators) {
      shuffledClasses.forEach((classId) => {
        const currentTeam = classTeams[classId] || [];
        if (currentTeam.length >= config.maxInvigilators) return;

        const classExams = examsOnDate.filter((e) => e.classIds.includes(classId));
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
          if (currentTeam.includes(t.id)) return false;
          
          // Availability check
          const isBlockedAny = daySlots.some(
            (slot) => t.constraints?.[dayIdx]?.[slot.periodIdx] === true
          );
          if (isBlockedAny) return false;

          // Conflict check
          const isConflict = Object.entries(classTeams).some(
            ([otherClassId, teamIds]) => {
              if (!teamIds.includes(t.id)) return false;
              const otherClassExams = examsOnDate.filter((e) =>
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
          return !isConflict;
        });

        availableExtras.sort((a, b) => teacherLoad[a.id] - teacherLoad[b.id]);
        
        const extraIds = availableExtras.slice(0, extrasNeeded).map((t) => t.id);
        classTeams[classId] = [...currentTeam, ...extraIds];
        extraIds.forEach((id) => teacherLoad[id]++);
      });
    }

    // STEP C: Apply Teams to Exam Sessions (FORK/SPLIT VERSION)
    const resultSessions: ExamSession[] = [];
    
    // We need to iterate through the ORIGINAL sessions because we are replacing them
    examsOnDate.forEach((originalExam) => {
      if (originalExam.locked) {
        resultSessions.push(originalExam);
        return;
      }

      // Instead of one session with multiple classes, we create ONE session PER class.
      // This ensures 10A and 10B have their own distinct invigilator teams in the roster.
      originalExam.classIds.forEach((cid) => {
        resultSessions.push({
          ...originalExam,
          id: generateId(), // Create a unique session per class
          classIds: [cid],
          invigilatorIds: classTeams[cid] || [],
        });
      });
    });

    // Remove the old combined sessions and add the new split ones
    const idsToRemove = examsOnDate.map(e => e.id);
    const filteredList = newExams.filter(e => !idsToRemove.includes(e.id));
    newExams.length = 0; // Clear array
    newExams.push(...filteredList, ...resultSessions);
  });

  return newExams;
};

