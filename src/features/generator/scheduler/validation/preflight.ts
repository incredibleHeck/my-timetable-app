import { AppData } from "../../../../types";
import { prepareAllocationUnits } from "../logic/preparation";
import { getDaysPerWeek } from "../utils/utils";
import { getType } from "./utils";
import { isOccasionBlocked } from "../../../../utils/utils";

export interface PreflightIssue {
  severity: "error" | "warning";
  message: string;
  classId?: string;
  className?: string;
  teacherId?: string;
  teacherName?: string;
}

export interface PreflightResult {
  ok: boolean;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
}

/** Count instructional CLASS slots available to a class across the week. */
function countWeeklyClassSlots(data: AppData, classId: string): number {
  const cls = data.classes.find((c) => c.id === classId);
  if (!cls) return 0;

  const structure = cls.structure || data.settings.dayStructure;
  const periodLimit = Math.min(cls.periodCount ?? 99, structure.length);
  const days = getDaysPerWeek(data.settings);
  let total = 0;

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < periodLimit; p++) {
      if (getType(structure, p) !== "CLASS") continue;
      if (isOccasionBlocked(data.settings.fixedOccasions?.[d]?.[p])) continue;
      if (cls.fixedSessions?.[d]?.[p]) continue;
      total++;
    }
  }

  return total;
}

/** Required curriculum periods for one class (includes joint-class units). */
function countRequiredPeriodsForClass(
  data: AppData,
  classId: string,
  units: ReturnType<typeof prepareAllocationUnits>,
): number {
  return units.filter((u) => u.classIds.includes(classId)).reduce((sum, u) => sum + u.duration, 0);
}

/** Available weekly slots for a teacher (days × periods minus blocked constraints). */
function countTeacherWeeklyCapacity(data: AppData, teacherId: string): number {
  const teacher = data.teachers.find((t) => t.id === teacherId);
  if (!teacher) return 0;

  const days = getDaysPerWeek(data.settings);
  const globalPeriods = data.settings.periodsPerDay;
  const maxDaily = teacher.maxPeriodsPerDay ?? data.settings.maxTeacherPeriodsPerDay ?? 6;

  let available = 0;
  for (let d = 0; d < days; d++) {
    let dayFree = 0;
    for (let p = 0; p < globalPeriods; p++) {
      if (isOccasionBlocked(data.settings.fixedOccasions?.[d]?.[p])) continue;
      if (teacher.constraints?.[d]?.[p]) continue;
      dayFree++;
    }
    available += Math.min(dayFree, maxDaily);
  }
  return available;
}

/**
 * Pre-flight feasibility check before starting the solver worker.
 * Errors block generation; warnings allow proceed with a toast.
 */
export function runPreflightCheck(data: AppData): PreflightResult {
  const errors: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];

  const units = prepareAllocationUnits(data);

  if (units.length === 0) {
    errors.push({
      severity: "error",
      message: "No lessons to schedule. Add curriculum assignments first.",
    });
    return { ok: false, errors, warnings };
  }

  const unassigned = units.filter((u) => u.teacherIds.length === 0);
  if (unassigned.length > 0) {
    warnings.push({
      severity: "warning",
      message: `${unassigned.length} lesson unit(s) have no teacher assigned.`,
    });
  }

  for (const cls of data.classes) {
    const required = countRequiredPeriodsForClass(data, cls.id, units);
    const capacity = countWeeklyClassSlots(data, cls.id);

    if (required === 0) continue;

    if (required > capacity) {
      errors.push({
        severity: "error",
        classId: cls.id,
        className: cls.name,
        message: `${cls.name}: curriculum needs ${required} periods but only ${capacity} class slots are available this week.`,
      });
    } else if (required > capacity * 0.95) {
      warnings.push({
        severity: "warning",
        classId: cls.id,
        className: cls.name,
        message: `${cls.name}: timetable is ${Math.round((required / capacity) * 100)}% full (${required}/${capacity} slots).`,
      });
    }
  }

  const teacherLoad = new Map<string, number>();
  for (const u of units) {
    for (const tid of u.teacherIds) {
      teacherLoad.set(tid, (teacherLoad.get(tid) || 0) + u.duration);
    }
  }

  for (const [teacherId, required] of teacherLoad) {
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (!teacher) continue;

    const capacity = countTeacherWeeklyCapacity(data, teacherId);
    if (required > capacity) {
      errors.push({
        severity: "error",
        teacherId,
        teacherName: teacher.name,
        message: `${teacher.name}: assigned ${required} periods but only ~${capacity} are available (constraints + daily limits).`,
      });
    } else if (required > capacity * 0.9) {
      warnings.push({
        severity: "warning",
        teacherId,
        teacherName: teacher.name,
        message: `${teacher.name}: workload is ${Math.round((required / capacity) * 100)}% of available capacity.`,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
