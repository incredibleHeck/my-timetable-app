import { AppData, ScheduleSlot, TimeSlot, ClassGroup } from "../../types";
import { calculateClassSchedule } from "../../utils/timeUtils";
import { FileService } from "../fileSystem";
import { notify } from "../../components/ui/Toast";

/**
 * iCalendar (.ics) export — RFC 5545.
 *
 * A timetable is a weekly recurring structure, so each lesson becomes one
 * VEVENT anchored to the current week's Monday with a weekly RRULE. Times are
 * emitted as *floating* local times (no TZID/Z suffix) so the lesson shows at
 * the same wall-clock time in whichever calendar the teacher subscribes from.
 */

export const DEFAULT_ICAL_WEEKS = 18;

/** RFC 5545 text escaping for SUMMARY/LOCATION/DESCRIPTION values. */
const escapeText = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Fold content lines to <=75 octets per RFC 5545 (char-based approximation). */
const foldLine = (line: string): string => {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let idx = 75;
  while (idx < line.length) {
    parts.push(" " + line.slice(idx, idx + 74));
    idx += 74;
  }
  return parts.join("\r\n");
};

const pad = (n: number): string => n.toString().padStart(2, "0");

/** Monday (local) of the current week — the recurrence anchor. */
const anchorMonday = (from: Date = new Date()): Date => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const isoDay = d.getDay() === 0 ? 7 : d.getDay(); // Mon=1 .. Sun=7
  d.setDate(d.getDate() - (isoDay - 1));
  return d;
};

/** Format a date + "HH:mm" as a floating local iCal timestamp (YYYYMMDDTHHMMSS). */
const formatFloating = (date: Date, hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(h || 0)}${pad(
    m || 0,
  )}00`;
};

/** UTC DTSTAMP (YYYYMMDDTHHMMSSZ). */
const nowStamp = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

interface LessonRun {
  classId: string;
  day: number; // 0 = Monday .. 4 = Friday
  startPeriod: number;
  endPeriod: number;
  slot: ScheduleSlot;
}

const sameLesson = (a: ScheduleSlot, b: ScheduleSlot): boolean =>
  a.subjectId === b.subjectId && a.teacherId === b.teacherId && a.roomId === b.roomId;

/** Resolve the per-period time ranges for a class (respects per-class structure). */
const classTimes = (data: AppData, cls: ClassGroup): TimeSlot[] => {
  const structure = cls.structure?.length ? cls.structure : data.settings.dayStructure;
  return calculateClassSchedule(cls, data.settings, structure);
};

/**
 * Collect merged lesson runs for a class. Contiguous periods with the same
 * subject/teacher/room (e.g. double periods) collapse into a single run.
 */
const collectClassRuns = (
  data: AppData,
  classId: string,
  filter?: (slot: ScheduleSlot) => boolean,
): LessonRun[] => {
  const runs: LessonRun[] = [];
  const classSchedule = data.schedule[classId];
  if (!classSchedule) return runs;

  for (let day = 0; day < 5; day++) {
    const dayMap = classSchedule[day];
    if (!dayMap) continue;

    const periods = Object.keys(dayMap)
      .map(Number)
      .sort((a, b) => a - b);

    let i = 0;
    while (i < periods.length) {
      const p = periods[i];
      const slot = dayMap[p];
      if (!slot || (filter && !filter(slot))) {
        i++;
        continue;
      }

      let endPeriod = p;
      let j = i + 1;
      while (
        j < periods.length &&
        periods[j] === endPeriod + 1 &&
        sameLesson(dayMap[periods[j]], slot)
      ) {
        endPeriod = periods[j];
        j++;
      }

      runs.push({ classId, day, startPeriod: p, endPeriod, slot });
      i = j;
    }
  }

  return runs;
};

const buildCalendar = (eventBlocks: string[][]): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EduScheduler Pro//Timetable//EN",
    "CALSCALE:GREGORIAN",
    ...eventBlocks.flat(),
    "END:VCALENDAR",
  ];
  // Fold each individual content line to <=75 octets, then join with CRLF.
  return lines.map(foldLine).join("\r\n") + "\r\n";
};

interface EventInput {
  uid: string;
  day: number;
  start: string; // HH:mm
  end: string; // HH:mm
  summary: string;
  location?: string;
  description?: string;
  weeks: number;
}

const buildEvent = (monday: Date, stamp: string, e: EventInput): string[] => {
  const eventDate = new Date(monday);
  eventDate.setDate(monday.getDate() + e.day);

  const lines = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${formatFloating(eventDate, e.start)}`,
    `DTEND:${formatFloating(eventDate, e.end)}`,
    `RRULE:FREQ=WEEKLY;COUNT=${e.weeks}`,
    `SUMMARY:${escapeText(e.summary)}`,
  ];
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  lines.push("END:VEVENT");
  return lines;
};

const sanitizeFilename = (name: string): string =>
  name.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "schedule";

/** Build the .ics text for a single class's weekly timetable. */
export const buildClassICal = (
  data: AppData,
  classId: string,
  weeks: number = DEFAULT_ICAL_WEEKS,
): string => {
  const cls = data.classes.find((c) => c.id === classId);
  if (!cls) return buildCalendar([]);

  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const teacherName = new Map(data.teachers.map((t) => [t.id, t.name]));
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  const times = classTimes(data, cls);
  const monday = anchorMonday();
  const stamp = nowStamp();

  const events = collectClassRuns(data, classId).map((run) => {
    const start =
      times[run.startPeriod]?.start ?? data.settings.timeSlots?.[run.startPeriod]?.start;
    const end = times[run.endPeriod]?.end ?? data.settings.timeSlots?.[run.endPeriod]?.end;
    const teacher = teacherName.get(run.slot.teacherId);
    const room = run.slot.roomId ? roomName.get(run.slot.roomId) : undefined;

    return buildEvent(monday, stamp, {
      uid: `class-${classId}-d${run.day}-p${run.startPeriod}@eduscheduler`,
      day: run.day,
      start: start ?? "08:00",
      end: end ?? "09:00",
      summary: subjectName.get(run.slot.subjectId) ?? "Lesson",
      location: room,
      description: teacher ? `Teacher: ${teacher}` : undefined,
      weeks,
    });
  });

  return buildCalendar(events);
};

/** Build the .ics text for a single teacher's weekly timetable across all classes. */
export const buildTeacherICal = (
  data: AppData,
  teacherId: string,
  weeks: number = DEFAULT_ICAL_WEEKS,
): string => {
  const subjectName = new Map(data.subjects.map((s) => [s.id, s.name]));
  const classById = new Map(data.classes.map((c) => [c.id, c]));
  const roomName = new Map(data.rooms.map((r) => [r.id, r.name]));
  const monday = anchorMonday();
  const stamp = nowStamp();

  // Gather this teacher's runs across every class, then de-duplicate lessons
  // that share the same day/time/subject (joint classes taught once).
  const allRuns = data.classes.flatMap((c) =>
    collectClassRuns(data, c.id, (slot) => slot.teacherId === teacherId),
  );

  const byKey = new Map<string, { run: LessonRun; classNames: string[] }>();
  for (const run of allRuns) {
    const key = `d${run.day}-p${run.startPeriod}-${run.slot.subjectId}`;
    const className = classById.get(run.classId)?.name ?? run.classId;
    const existing = byKey.get(key);
    if (existing) {
      if (!existing.classNames.includes(className)) existing.classNames.push(className);
    } else {
      byKey.set(key, { run, classNames: [className] });
    }
  }

  const events = [...byKey.values()].map(({ run, classNames }) => {
    const cls = classById.get(run.classId);
    const times = cls ? classTimes(data, cls) : [];
    const start =
      times[run.startPeriod]?.start ?? data.settings.timeSlots?.[run.startPeriod]?.start;
    const end = times[run.endPeriod]?.end ?? data.settings.timeSlots?.[run.endPeriod]?.end;
    const room = run.slot.roomId ? roomName.get(run.slot.roomId) : undefined;

    return buildEvent(monday, stamp, {
      uid: `teacher-${teacherId}-d${run.day}-p${run.startPeriod}-${run.slot.subjectId}@eduscheduler`,
      day: run.day,
      start: start ?? "08:00",
      end: end ?? "09:00",
      summary: subjectName.get(run.slot.subjectId) ?? "Lesson",
      location: room,
      description: `Class: ${classNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ")}`,
      weeks,
    });
  });

  return buildCalendar(events);
};

const saveICal = async (ics: string, baseName: string): Promise<void> => {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const fileName = `${sanitizeFilename(baseName)}.ics`;
  const result = await FileService.saveExport(blob, fileName, "ics");
  if (result.success) {
    notify("Calendar (.ics) exported. Import or subscribe to it in your calendar app.", "success");
  }
};

/** Export a class timetable as a downloadable .ics file. */
export const exportClassICal = async (
  data: AppData,
  classId: string,
  weeks?: number,
): Promise<void> => {
  const cls = data.classes.find((c) => c.id === classId);
  const ics = buildClassICal(data, classId, weeks);
  await saveICal(ics, `${data.settings.schoolName || "Timetable"}_${cls?.name || "Class"}`);
};

/** Export a teacher timetable as a downloadable .ics file. */
export const exportTeacherICal = async (
  data: AppData,
  teacherId: string,
  weeks?: number,
): Promise<void> => {
  const teacher = data.teachers.find((t) => t.id === teacherId);
  const ics = buildTeacherICal(data, teacherId, weeks);
  await saveICal(ics, `${data.settings.schoolName || "Timetable"}_${teacher?.name || "Teacher"}`);
};
