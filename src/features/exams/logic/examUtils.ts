import { ClassGroup, ExamSession, TimeSlot } from "../../../types";

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
