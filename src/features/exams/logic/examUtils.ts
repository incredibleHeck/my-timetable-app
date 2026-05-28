import {
  AppData,
  ClassGroup,
  ExamSession,
  Room,
  Settings,
  TimeSlot,
} from "../../../types";

export const parseTime = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

export const formatTime = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export const isOverlapping = (
  s1: number,
  e1: number,
  s2: number,
  e2: number
): boolean => s1 < e2 && e1 > s2;

export const getExamTimeRange = (
  exam: Pick<ExamSession, "startTime" | "duration">
): { start: number; end: number } => {
  const start = parseTime(exam.startTime);
  return { start, end: start + exam.duration };
};

export const examsOverlap = (a: ExamSession, b: ExamSession): boolean => {
  if (a.date !== b.date) return false;
  const ra = getExamTimeRange(a);
  const rb = getExamTimeRange(b);
  return isOverlapping(ra.start, ra.end, rb.start, rb.end);
};

export const getStreamLevel = (
  classId: string,
  classes: ClassGroup[]
): string => {
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return classId;
  if (cls.level) return cls.level;
  const match = cls.name.match(/(\d+)/);
  return match ? match[1] : cls.name;
};

/** Mon=0 … Fri=4; weekend returns null (skip teacher constraint matrix). */
export const getConstraintDayIndex = (dateStr: string): number | null => {
  const dateObj = new Date(dateStr + "T12:00:00");
  const jsDay = dateObj.getDay();
  if (jsDay === 0 || jsDay === 6) return null;
  return jsDay - 1;
};

export const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const getDayEndMinutes = (timeSlots?: TimeSlot[]): number => {
  if (!timeSlots?.length) return 16 * 60;
  let latest = 0;
  for (const slot of timeSlots) {
    const end = parseTime(slot.end);
    if (end > latest) latest = end;
  }
  return latest > 0 ? latest : 16 * 60;
};

export const getPeriodIndex = (
  timeStr: string,
  timeSlots: TimeSlot[]
): number => {
  const timeMins = parseTime(timeStr);
  let bestIdx = 0;
  let minDiff = Infinity;
  timeSlots.forEach((slot, idx) => {
    const startMins = parseTime(slot.start);
    const diff = Math.abs(timeMins - startMins);
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
};

/** All period indices whose slot interval overlaps [startMins, endMins). */
export const getPeriodIndicesOverlapping = (
  timeSlots: TimeSlot[],
  startMins: number,
  endMins: number
): number[] => {
  const indices: number[] = [];
  timeSlots.forEach((slot, idx) => {
    const slotStart = parseTime(slot.start);
    const slotEnd = parseTime(slot.end);
    if (isOverlapping(startMins, endMins, slotStart, slotEnd)) {
      indices.push(idx);
    }
  });
  return indices.length > 0 ? indices : [getPeriodIndex(formatTime(startMins), timeSlots)];
};

/** ISO-style week key for calendar-week stream tracking. */
export const getWeekKey = (dateStr: string): string => {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${weekNo.toString().padStart(2, "0")}`;
};

export interface ExamSessionColumn {
  index: number;
  label: string;
  defaultStartTime: string;
  minStartMins: number;
  maxStartMins: number;
  headerHint: string;
}

export interface ExamGridDefaults {
  sessionsPerDay: number;
  sessionCutoff: string;
  session1DefaultTime: string;
  session2DefaultTime: string;
  columns: ExamSessionColumn[];
}

/** Build exam day session columns (grid + scheduler). */
export const getExamSessionColumns = (settings: Settings): ExamSessionColumn[] => {
  const grid = settings.examGrid;
  const slots = settings.timeSlots || [];
  const sessionsPerDay = Math.max(1, Math.min(4, grid?.sessionsPerDay ?? 2));

  const dayStart = parseTime(
    grid?.session1DefaultTime ||
      slots[0]?.start ||
      settings.schoolStartTime ||
      "09:00"
  );
  const dayEnd = getDayEndMinutes(slots);

  if (sessionsPerDay === 1) {
    return [
      {
        index: 0,
        label: "Session 1",
        defaultStartTime:
          grid?.sessionDefaultTimes?.[0] ||
          grid?.session1DefaultTime ||
          formatTime(dayStart),
        minStartMins: dayStart,
        maxStartMins: dayEnd,
        headerHint: `From ${formatTime(dayStart)}`,
      },
    ];
  }

  if (sessionsPerDay === 2 && (grid?.sessionCutoff || grid?.session2DefaultTime)) {
    let sessionCutoff = grid?.sessionCutoff;
    const s1 =
      grid?.sessionDefaultTimes?.[0] ||
      grid?.session1DefaultTime ||
      formatTime(dayStart);
    let s2 = grid?.sessionDefaultTimes?.[1] || grid?.session2DefaultTime;

    if (!sessionCutoff && s1 && s2) {
      sessionCutoff = formatTime(Math.floor((parseTime(s1) + parseTime(s2)) / 2));
    }
    if (!sessionCutoff && slots.length > 1) {
      const mid = Math.floor(slots.length / 2);
      const firstBlock = slots.slice(0, mid);
      const secondBlock = slots.slice(mid);
      if (firstBlock.length && secondBlock.length) {
        const lastFirstEnd = parseTime(firstBlock[firstBlock.length - 1].end);
        const firstSecondStart = parseTime(secondBlock[0].start);
        sessionCutoff = formatTime(
          Math.floor((lastFirstEnd + firstSecondStart) / 2)
        );
      }
    }
    sessionCutoff = sessionCutoff || "11:30";
    const cutoffMins = parseTime(sessionCutoff);

    if (!s2 && slots.length > 0) {
      const mid = Math.floor(slots.length / 2);
      s2 = slots[mid]?.start || slots[slots.length - 1]?.start;
    }
    s2 = s2 || "14:00";

    return [
      {
        index: 0,
        label: "Session 1",
        defaultStartTime: s1,
        minStartMins: dayStart,
        maxStartMins: cutoffMins,
        headerHint: `Start before ${sessionCutoff}`,
      },
      {
        index: 1,
        label: "Session 2",
        defaultStartTime: s2,
        minStartMins: cutoffMins,
        maxStartMins: dayEnd,
        headerHint: `Start ${sessionCutoff} or later`,
      },
    ];
  }

  const windowSize = Math.floor((dayEnd - dayStart) / sessionsPerDay);
  const columns: ExamSessionColumn[] = [];
  for (let i = 0; i < sessionsPerDay; i++) {
    const minStart = dayStart + i * windowSize;
    const maxStart = i === sessionsPerDay - 1 ? dayEnd : minStart + windowSize;
    columns.push({
      index: i,
      label: `Session ${i + 1}`,
      defaultStartTime:
        grid?.sessionDefaultTimes?.[i] || formatTime(minStart),
      minStartMins: minStart,
      maxStartMins: maxStart,
      headerHint: `${formatTime(minStart)} – ${formatTime(maxStart)}`,
    });
  }
  return columns;
};

export const getSessionIndexForStartTime = (
  startTime: string,
  columns: ExamSessionColumn[]
): number => {
  const t = parseTime(startTime);
  for (let i = columns.length - 1; i >= 0; i--) {
    if (t >= columns[i].minStartMins) return i;
  }
  return 0;
};

export const examFitsInSession = (
  startTime: string,
  duration: number,
  column: ExamSessionColumn
): boolean => {
  const start = parseTime(startTime);
  const end = start + duration;
  return start >= column.minStartMins && end <= column.maxStartMins;
};

export const getExamGridDefaults = (settings: Settings): ExamGridDefaults => {
  const columns = getExamSessionColumns(settings);
  const sessionCutoff =
    columns.length >= 2
      ? formatTime(columns[1].minStartMins)
      : formatTime(columns[0]?.maxStartMins ?? 12 * 60);

  return {
    sessionsPerDay: columns.length,
    sessionCutoff,
    session1DefaultTime: columns[0]?.defaultStartTime ?? "09:00",
    session2DefaultTime: columns[1]?.defaultStartTime ?? "14:00",
    columns,
  };
};

/** Invigilation team for one class (stream) on one exam day — same pair for all sessions. */
export const getClassDayInvigilationTeam = (
  exams: ExamSession[],
  classId: string,
  date: string
): string[] => {
  const cellExams = exams.filter(
    (e) => e.date === date && e.classIds.includes(classId)
  );
  if (cellExams.length === 0) return [];

  const ids = new Set<string>();
  cellExams.forEach((e) => (e.invigilatorIds || []).forEach((id) => ids.add(id)));
  return Array.from(ids);
};

export const pickExamRoom = (
  classIds: string[],
  classes: ClassGroup[],
  rooms: Room[]
): string | undefined => {
  if (classIds.length === 0 || rooms.length === 0) return undefined;

  const totalStudents = classIds.reduce((sum, cid) => {
    const cls = classes.find((c) => c.id === cid);
    return sum + (cls?.studentCount || 0);
  }, 0);

  const defaultRooms = classIds
    .map((cid) => classes.find((c) => c.id === cid)?.defaultRoomId)
    .filter(Boolean) as string[];

  const sharedDefault =
    defaultRooms.length > 0 && defaultRooms.every((r) => r === defaultRooms[0])
      ? defaultRooms[0]
      : undefined;

  if (sharedDefault) {
    const room = rooms.find((r) => r.id === sharedDefault);
    if (room && (!room.capacity || totalStudents <= room.capacity)) {
      return sharedDefault;
    }
  }

  const fitting = rooms
    .filter((r) => !r.capacity || totalStudents <= r.capacity)
    .sort((a, b) => (a.capacity || 9999) - (b.capacity || 9999));

  return fitting[0]?.id || sharedDefault || rooms[0]?.id;
};

export const isTeacherBusyInClassSchedule = (
  teacherId: string,
  exam: ExamSession,
  data: AppData
): boolean => {
  const dayIdx = getConstraintDayIndex(exam.date);
  if (dayIdx === null || !data.schedule) return false;

  const { start, end } = getExamTimeRange(exam);
  const periodIndices = getPeriodIndicesOverlapping(
    data.settings.timeSlots,
    start,
    end
  );

  for (const classSchedule of Object.values(data.schedule)) {
    const daySchedule = classSchedule[dayIdx];
    if (!daySchedule) continue;

    for (const periodIdx of periodIndices) {
      const slot = daySchedule[periodIdx];
      if (slot?.teacherId === teacherId) return true;
    }
  }

  return false;
};

export const getInvigilationSplitId = (
  originalExamId: string,
  classId: string
): string => `${originalExamId}__${classId}`;

/** Deterministic shuffle for reproducible auto-schedule. */
export const seededShuffle = <T>(array: T[], seed = 42): T[] => {
  const arr = [...array];
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
