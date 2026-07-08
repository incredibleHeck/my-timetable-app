import { AppData } from "../../../types";
import { countScheduledForSubject } from "../scheduler/validation/final-conflicts";
import { getType } from "../scheduler/validation/utils";
import { getNextClassPeriod } from "../scheduler/utils/utils";
import { ScheduleSlot } from "../types";

export interface PendingPlacement {
  id: string;
  classId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  duration: 1 | 2;
  roomId?: string;
  warning?: string;
}

function normalizeId(id: string): string {
  return String(id).trim();
}

function inferSlotDuration(
  daySchedule: Record<number, ScheduleSlot>,
  period: number,
  structure: AppData["settings"]["dayStructure"],
  periodLimit: number,
): 1 | 2 {
  const p2 = getNextClassPeriod(
    period,
    structure as Parameters<typeof getNextClassPeriod>[1],
    periodLimit,
  );
  if (p2 === null) return 1;
  const next = daySchedule[p2];
  const head = daySchedule[period];
  if (next && next.isFixed && head?.subjectId && next.subjectId === head.subjectId) {
    return 2;
  }
  return 1;
}

function getClassSchedule(
  schedule: AppData["schedule"],
  classId: string,
): Record<number, Record<number, ScheduleSlot>> | undefined {
  return schedule[classId] ?? schedule[String(classId)];
}

function countScheduledSinglesAndDoubles(
  data: AppData,
  classId: string,
  subjectId: string,
): { singles: number; doubles: number } {
  const classSchedule = getClassSchedule(data.schedule, classId);
  if (!classSchedule) return { singles: 0, doubles: 0 };

  const cls = data.classes.find((c) => normalizeId(c.id) === normalizeId(classId));
  const structure = cls?.structure || data.settings.dayStructure;
  const periodLimit = cls?.periodCount ?? data.settings.periodsPerDay;
  const targetSubject = normalizeId(subjectId);

  let singles = 0;
  let doubles = 0;

  for (const dayStr of Object.keys(classSchedule)) {
    const day = Number(dayStr);
    if (Number.isNaN(day)) continue;

    const daySchedule = classSchedule[day];
    if (!daySchedule) continue;

    for (const periodStr of Object.keys(daySchedule)) {
      const period = Number(periodStr);
      if (Number.isNaN(period)) continue;

      const slot = daySchedule[period];
      if (!slot?.subjectId || slot.isFixed) continue;
      if (normalizeId(slot.subjectId) !== targetSubject) continue;
      if (getType(structure, period) !== "CLASS") continue;

      const duration = inferSlotDuration(
        daySchedule,
        period,
        structure as import("../../../types").PeriodConfig[],
        periodLimit,
      );
      if (duration === 2) {
        doubles++;
      } else {
        singles++;
      }
    }
  }

  return { singles, doubles };
}

function resolveTeacher(
  data: AppData,
  classId: string,
  subjectId: string,
): { teacherId: string; teacherName: string } | null {
  const cls = data.classes.find((c) => c.id === classId);
  const curriculum = cls?.curriculum.find(
    (c) => normalizeId(c.subjectId) === normalizeId(subjectId),
  );
  if (curriculum?.assignedTeacherId) {
    const teacher = data.teachers.find((t) => t.id === curriculum.assignedTeacherId);
    if (teacher) {
      return { teacherId: teacher.id, teacherName: teacher.name };
    }
  }

  const joint = data.jointClasses?.find(
    (jc) => normalizeId(jc.subjectId) === normalizeId(subjectId) && jc.classIds.includes(classId),
  );
  if (joint?.teacherId) {
    const teacher = data.teachers.find((t) => t.id === joint.teacherId);
    if (teacher) {
      return { teacherId: teacher.id, teacherName: teacher.name };
    }
  }

  return null;
}

function resolveRoomId(data: AppData, _classId: string, subjectId: string): string | undefined {
  const subject = data.subjects.find((s) => normalizeId(s.id) === normalizeId(subjectId));
  return subject?.requiredRoomId ?? undefined;
}

/** Lessons still missing from the grid for one class (curriculum minus placed). */
export function getPendingPlacementsForClass(data: AppData, classId: string): PendingPlacement[] {
  const cls = data.classes.find((c) => c.id === classId);
  if (!cls) return [];

  const pending: PendingPlacement[] = [];
  let counter = 0;

  for (const item of cls.curriculum) {
    const subject = data.subjects.find((s) => normalizeId(s.id) === normalizeId(item.subjectId));
    const teacher = resolveTeacher(data, classId, item.subjectId);
    if (!teacher) continue;

    const roomId = resolveRoomId(data, classId, item.subjectId);
    const subjectName = subject?.name || "Unknown";
    const base = {
      classId,
      subjectId: item.subjectId,
      subjectName,
      teacherId: teacher.teacherId,
      teacherName: teacher.teacherName,
      roomId,
    };

    const hasSinglesDoubles = (item.singles || 0) + (item.doubles || 0) > 0;

    if (hasSinglesDoubles) {
      const placed = countScheduledSinglesAndDoubles(data, classId, item.subjectId);
      const pendingSingles = Math.max(0, (item.singles || 0) - placed.singles);
      const pendingDoubles = Math.max(0, (item.doubles || 0) - placed.doubles);

      for (let i = 0; i < pendingDoubles; i++) {
        pending.push({
          ...base,
          id: `${classId}-${item.subjectId}-d-${counter++}`,
          duration: 2,
        });
      }
      for (let i = 0; i < pendingSingles; i++) {
        pending.push({
          ...base,
          id: `${classId}-${item.subjectId}-s-${counter++}`,
          duration: 1,
        });
      }
    } else {
      const expected = item.periodsPerWeek || 0;
      if (expected <= 0) continue;

      const scheduled = countScheduledForSubject(data, classId, item.subjectId);
      const missing = Math.max(0, expected - scheduled);

      for (let i = 0; i < missing; i++) {
        pending.push({
          ...base,
          id: `${classId}-${item.subjectId}-p-${counter++}`,
          duration: 1,
        });
      }
    }
  }

  return pending;
}
