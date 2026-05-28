import { DutyAssignment, DutyRoster } from "../../../types";

/** Legacy duty roster shape before daily/weekly split. */
export interface LegacyDutyRoster extends DutyRoster {
  assignments?: DutyAssignment[];
  slotCount?: number;
  rowCount?: number;
}

export function isLegacyDutyRoster(roster: DutyRoster): roster is LegacyDutyRoster {
  const legacy = roster as LegacyDutyRoster;
  return (
    legacy.assignments !== undefined ||
    legacy.slotCount !== undefined ||
    legacy.rowCount !== undefined
  );
}

export function migrateDutyRoster(roster: DutyRoster): DutyRoster {
  if (!isLegacyDutyRoster(roster)) {
    return {
      ...roster,
      dailyAssignments: roster.dailyAssignments ?? [],
      weeklyAssignments: roster.weeklyAssignments ?? [],
      dailyParams: roster.dailyParams ?? { min: 4, max: 6 },
      weeklyParams: roster.weeklyParams ?? { min: 4, max: 6, weeks: 4 },
    };
  }

  const legacy = roster;
  const { assignments, slotCount, rowCount, ...rest } = legacy;

  return {
    ...rest,
    dailyAssignments: rest.dailyAssignments ?? (rest.type === "DAILY" ? (assignments ?? []) : []),
    weeklyAssignments:
      rest.weeklyAssignments ?? (rest.type === "WEEKLY" ? (assignments ?? []) : []),
    dailyParams: rest.dailyParams ?? { min: 4, max: slotCount ?? 6 },
    weeklyParams: rest.weeklyParams ?? {
      min: 4,
      max: slotCount ?? 6,
      weeks: rowCount ?? 4,
    },
  };
}
