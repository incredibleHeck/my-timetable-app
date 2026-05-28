import { ScheduleResult } from "../../generator/types";

/** Count assignments in period columns at or after periodIndex (0-based). */
export function countScheduleSlotsAtOrAfterPeriod(
  schedule: ScheduleResult | undefined,
  periodIndex: number,
): number {
  if (!schedule) return 0;
  let count = 0;
  for (const classId of Object.keys(schedule)) {
    const byDay = schedule[classId];
    if (!byDay) continue;
    for (const dayKey of Object.keys(byDay)) {
      const byPeriod = byDay[Number(dayKey)];
      if (!byPeriod) continue;
      for (const periodKey of Object.keys(byPeriod)) {
        const p = Number(periodKey);
        if (p >= periodIndex && byPeriod[p]) count++;
      }
    }
  }
  return count;
}

/** Remove assignments in period columns >= periodsPerDay. */
export function trimScheduleToPeriods(
  schedule: ScheduleResult | undefined,
  periodsPerDay: number,
): ScheduleResult {
  if (!schedule) return {};
  const trimmed: ScheduleResult = {};
  for (const classId of Object.keys(schedule)) {
    const byDay = schedule[classId];
    if (!byDay) continue;
    trimmed[classId] = {};
    for (const dayKey of Object.keys(byDay)) {
      const day = Number(dayKey);
      const byPeriod = byDay[day];
      if (!byPeriod) continue;
      const newPeriods: Record<number, (typeof byPeriod)[number]> = {};
      for (const periodKey of Object.keys(byPeriod)) {
        const p = Number(periodKey);
        if (p < periodsPerDay && byPeriod[p]) {
          newPeriods[p] = byPeriod[p];
        }
      }
      if (Object.keys(newPeriods).length > 0) {
        trimmed[classId][day] = newPeriods;
      }
    }
    if (Object.keys(trimmed[classId]).length === 0) {
      delete trimmed[classId];
    }
  }
  return trimmed;
}
