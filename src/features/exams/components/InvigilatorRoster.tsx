import React, { useMemo } from "react";
import { AppData, ExamSession } from "../../../types";
import { getClassDayInvigilationTeam } from "../logic/examUtils";

interface Props {
  data: AppData;
  exams: ExamSession[];
}

export const InvigilatorRoster: React.FC<Props> = ({ data, exams }) => {
  const { classes, teachers } = data;

  const uniqueDates = useMemo(() => Array.from(new Set(exams.map((e) => e.date))).sort(), [exams]);

  const sortedClasses = useMemo(
    () => [...classes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [classes],
  );

  const getInvigilatorsForCell = (classId: string, date: string): string[] | null => {
    const hasExams = exams.some((e) => e.date === date && e.classIds.includes(classId));
    if (!hasExams) return null;
    const teamIds = getClassDayInvigilationTeam(exams, classId, date);
    if (teamIds.length === 0) return [];
    return teamIds.map((id) => teachers.find((t) => t.id === id)?.name).filter(Boolean) as string[];
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-edge bg-surface">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-edge px-4 py-3">
        <div>
          <h3 className="text-sm font-medium text-content">Invigilation roster</h3>
          <p className="mt-0.5 text-xs text-content-muted">
            One team per class per day, covering every session.
          </p>
        </div>
        <span className="text-xs tabular-nums text-content-muted">
          {uniqueDates.length} {uniqueDates.length === 1 ? "exam day" : "exam days"}
        </span>
      </div>

      <div className="custom-scrollbar flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-surface-muted">
            <tr>
              <th className="sticky left-0 z-30 min-w-[7rem] border-b border-r border-edge bg-surface-muted px-3 py-2.5 text-left text-2xs font-medium uppercase tracking-wide text-content-muted">
                Class
              </th>
              {uniqueDates.map((date) => {
                const parsed = new Date(date + "T12:00:00");
                return (
                  <th
                    key={date}
                    className="min-w-[8.5rem] border-b border-r border-edge px-3 py-2 text-center"
                  >
                    <div className="text-2xs uppercase tracking-wide text-content-muted">
                      {parsed.toLocaleDateString("en-GB", { weekday: "short" })}
                    </div>
                    <div className="text-xs font-medium tabular-nums text-content">
                      {parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedClasses.map((cls) => (
              <tr key={cls.id}>
                <td className="sticky left-0 z-10 border-b border-r border-edge bg-canvas px-3 py-2 text-xs font-medium text-content-secondary">
                  {cls.name}
                </td>
                {uniqueDates.map((date) => {
                  const names = getInvigilatorsForCell(cls.id, date);
                  return (
                    <td
                      key={date}
                      className="border-b border-r border-edge-subtle px-2 py-2 align-top"
                    >
                      {names === null ? (
                        <span className="block text-center text-2xs text-content-muted">—</span>
                      ) : names.length === 0 ? (
                        <span className="block text-center text-2xs text-accent-ink">
                          Unassigned
                        </span>
                      ) : (
                        <ul className="space-y-1">
                          {names.map((name, idx) => (
                            <li
                              key={idx}
                              className="rounded border border-edge bg-surface-muted px-1.5 py-0.5 text-center text-2xs text-content-secondary"
                            >
                              {name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
