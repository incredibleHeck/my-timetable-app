import { ClassGroup } from "../../../../types";

export function getSubjectWeeklyPeriods(
  cls: ClassGroup | undefined,
  subjectId: string,
): number {
  if (!cls) return 0;
  const entry = cls.curriculum.find((c) => c.subjectId === subjectId);
  if (!entry) return 0;
  return (entry.singles || 0) + (entry.doubles || 0) * 2;
}

/** Max periods of one subject on a single day: ceil(N / D) + 1 */
export function getMaxSubjectPeriodsPerDaySpread(
  weeklyPeriods: number,
  daysPerWeek: number,
): number {
  if (weeklyPeriods <= 0 || daysPerWeek <= 0) return Infinity;
  return Math.ceil(weeklyPeriods / daysPerWeek) + 1;
}

export function getMaxSubjectPeriodsPerDayForClass(
  cls: ClassGroup | undefined,
  subjectId: string,
  daysPerWeek: number,
): number {
  return getMaxSubjectPeriodsPerDaySpread(
    getSubjectWeeklyPeriods(cls, subjectId),
    daysPerWeek,
  );
}
