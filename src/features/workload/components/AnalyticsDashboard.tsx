import React from "react";
import { Panel, PanelRegion } from "../../../components/ui";
import { Analytics, UNDERUSED_ROOM_PCT } from "../hooks/useAnalytics";

interface StatTileProps {
  label: string;
  value: string | number;
  hint: string;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, hint }) => (
  <div className="rounded-lg border border-edge bg-surface px-4 py-3">
    <p className="text-xl font-semibold tabular-nums text-content">{value}</p>
    <p className="mt-0.5 text-xs font-medium text-content-secondary">{label}</p>
    <p className="mt-0.5 text-2xs leading-relaxed text-content-muted">{hint}</p>
  </div>
);

/** Occupancy is the one figure here with a good and a bad end. */
const occupancyTone = (pct: number): string => {
  if (pct >= 70) return "bg-success";
  if (pct >= UNDERUSED_ROOM_PCT) return "bg-accent";
  return "bg-edge-strong";
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

interface AnalyticsDashboardProps {
  analytics: Analytics;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ analytics }) => {
  const { summary, rooms, teacherFreePeriods, subjects, hasSchedule } = analytics;

  if (!hasSchedule) {
    return (
      <div className="rounded-lg border border-dashed border-edge px-5 py-12 text-center">
        <p className="text-sm text-content">No timetable to analyse yet.</p>
        <p className="mt-1 text-xs text-content-muted">
          Generate one in the Auto-Generator to see room occupancy, teacher free periods and subject
          spread.
        </p>
      </div>
    );
  }

  const teachingStaff = teacherFreePeriods.filter((t) => t.teachingPeriods > 0);
  const maxSubjectPeriods = subjects[0]?.periods ?? 1;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Lessons scheduled"
          value={summary.totalLessons}
          hint={`${summary.teachingSlotsPerWeek} teaching slots per week`}
        />
        <StatTile
          label="Average room occupancy"
          value={`${summary.avgRoomOccupancyPct}%`}
          hint={`Across ${summary.roomsCount} ${plural(summary.roomsCount, "room", "rooms")}`}
        />
        {/* Free periods are marking and preparation time, so this tile states a
            total rather than flagging a count of teachers "affected". */}
        <StatTile
          label="Teacher free periods"
          value={summary.totalFreePeriods}
          hint={
            teachingStaff.length > 0
              ? `Marking and prep time across ${teachingStaff.length} teaching staff`
              : "No teaching staff scheduled"
          }
        />
        <StatTile
          label="Under-used rooms"
          value={summary.underusedRooms}
          hint={`Below ${UNDERUSED_ROOM_PCT}% of weekly slots`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Room utilisation"
          description="Share of the week's teaching slots each room is in use for."
        >
          <PanelRegion className="px-5 py-4">
            {rooms.length === 0 ? (
              <p className="text-xs text-content-muted">No rooms defined.</p>
            ) : (
              <ul className="custom-scrollbar max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {rooms.map((room) => (
                  <li key={room.roomId}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-xs text-content-secondary">
                        {room.roomName}
                        {room.isHomeRoom && (
                          <span className="ml-1.5 text-2xs text-content-muted">home</span>
                        )}
                      </span>
                      <span className="whitespace-nowrap text-2xs tabular-nums text-content-muted">
                        {room.occupiedSlots}/{room.capacitySlots} · {room.occupancyPct}%
                      </span>
                    </div>
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface-inset">
                      <div
                        className={`h-full ${occupancyTone(room.occupancyPct)}`}
                        style={{ width: `${room.occupancyPct}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PanelRegion>
        </Panel>

        {/* Was "Teacher Idle / Gap Periods", sorted most-first with a red badge
            past four — which put the teacher with the most marking time at the
            top of the list and coloured them as the worst problem on screen. */}
        <Panel
          title="Teacher free periods"
          description="Non-teaching periods between a teacher's first and last lesson of the day — time to mark, prepare and rest. Listed with the least first."
          action={
            summary.teachersWithNoFreePeriod > 0 ? (
              <span className="text-xs tabular-nums text-content-muted">
                {summary.teachersWithNoFreePeriod} with none
              </span>
            ) : undefined
          }
        >
          <PanelRegion className="px-5 py-4">
            {teachingStaff.length === 0 ? (
              <p className="text-xs text-content-muted">
                No teacher has lessons in this timetable.
              </p>
            ) : (
              <ul className="custom-scrollbar max-h-72 divide-y divide-edge-subtle overflow-y-auto pr-1">
                {teachingStaff.map((t) => (
                  <li key={t.teacherId} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="truncate text-xs text-content-secondary">{t.teacherName}</span>
                    <span className="flex shrink-0 items-center gap-3 whitespace-nowrap text-2xs tabular-nums text-content-muted">
                      <span>{t.teachingPeriods} taught</span>
                      <span className="text-content">
                        {t.freePeriods} free
                        {t.mostInOneDay > 1 && (
                          <span className="text-content-muted"> · {t.mostInOneDay} in a day</span>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </PanelRegion>
        </Panel>
      </div>

      <Panel
        title="Subject distribution"
        description="How the week's lessons divide across subjects."
      >
        <PanelRegion className="px-5 py-4">
          {subjects.length === 0 ? (
            <p className="text-xs text-content-muted">No subjects scheduled.</p>
          ) : (
            <ul className="space-y-2.5">
              {subjects.map((s) => (
                <li key={s.subjectId} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 truncate text-xs text-content-secondary">
                    {s.subjectName}
                  </span>
                  <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-surface-inset">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.periods / maxSubjectPeriods) * 100}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  </div>
                  <span className="w-20 shrink-0 whitespace-nowrap text-right text-2xs tabular-nums text-content-muted">
                    {s.periods} · {s.pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </PanelRegion>
      </Panel>
    </div>
  );
};
