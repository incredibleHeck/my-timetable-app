import React from "react";
import { Card } from "../../../components/ui";
import { DoorOpen, Clock, BookOpen, CalendarCheck, Building2, Coffee } from "lucide-react";
import { Analytics } from "../hooks/useAnalytics";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "emerald" | "amber" | "violet";
  hint: string;
}

const TILE_COLORS: Record<StatTileProps["color"], string> = {
  blue: "bg-blue-50 text-blue-600 border-blue-100",
  emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
  amber: "bg-amber-50 text-amber-600 border-amber-100",
  violet: "bg-violet-50 text-violet-600 border-violet-100",
};

const StatTile: React.FC<StatTileProps> = ({ label, value, icon, color, hint }) => (
  <Card className="p-5 border-slate-100 dark:border-slate-700">
    <div className={`inline-flex p-2.5 rounded-xl mb-3 ${TILE_COLORS[color]}`}>{icon}</div>
    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{value}</h3>
    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{hint}</p>
  </Card>
);

// Occupancy: high = well-used (green), low = under-used (slate).
const occupancyColor = (pct: number): string => {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 40) return "bg-amber-500";
  return "bg-slate-300";
};

interface AnalyticsDashboardProps {
  analytics: Analytics;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ analytics }) => {
  const { summary, rooms, teacherGaps, subjects, hasSchedule } = analytics;

  if (!hasSchedule) {
    return (
      <Card className="p-12 text-center border-slate-100 dark:border-slate-700">
        <div className="inline-flex p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
          <CalendarCheck size={24} />
        </div>
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">
          No schedule to analyse yet
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Generate a timetable in the Scheduler to see room occupancy, teacher gaps, and subject
          spread.
        </p>
      </Card>
    );
  }

  const teachersWithGaps = teacherGaps.filter((t) => t.gapPeriods > 0);
  const maxSubjectPeriods = subjects[0]?.periods ?? 1;

  return (
    <div className="space-y-6">
      {/* Summary tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Lessons Scheduled"
          value={summary.totalLessons}
          icon={<CalendarCheck size={18} />}
          color="blue"
          hint={`${summary.teachingSlotsPerWeek} teaching slots / week`}
        />
        <StatTile
          label="Avg Room Occupancy"
          value={`${summary.avgRoomOccupancyPct}%`}
          icon={<Building2 size={18} />}
          color="emerald"
          hint={`Across ${summary.roomsCount} room${summary.roomsCount !== 1 ? "s" : ""}`}
        />
        <StatTile
          label="Teacher Gap Periods"
          value={summary.totalGapPeriods}
          icon={<Coffee size={18} />}
          color="amber"
          hint={`${teachersWithGaps.length} teacher${teachersWithGaps.length !== 1 ? "s" : ""} affected`}
        />
        <StatTile
          label="Subjects Timetabled"
          value={summary.scheduledSubjects}
          icon={<BookOpen size={18} />}
          color="violet"
          hint="Distinct subjects in the grid"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Room utilisation */}
        <Card className="p-6 border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <DoorOpen size={16} className="text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Room Utilisation
            </h3>
          </div>
          {rooms.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No rooms defined.</p>
          ) : (
            <ul className="space-y-3">
              {rooms.map((room) => (
                <li key={room.roomId}>
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {room.roomName}
                      {room.isHomeRoom && (
                        <span className="ml-1.5 text-[9px] font-bold uppercase text-slate-400">
                          home
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {room.occupiedSlots}/{room.capacitySlots} · {room.occupancyPct}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${occupancyColor(
                        room.occupancyPct,
                      )}`}
                      style={{ width: `${room.occupancyPct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Teacher gaps */}
        <Card className="p-6 border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-slate-500 dark:text-slate-400" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Teacher Idle / Gap Periods
            </h3>
          </div>
          {teachersWithGaps.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No gaps — every teacher's day runs back-to-back. 🎉
            </p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
              {teachersWithGaps.map((t) => (
                <li
                  key={t.teacherId}
                  className="flex items-center justify-between text-xs border-b border-slate-50 pb-2 last:border-0"
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {t.teacherName}
                  </span>
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <span className="text-slate-400">{t.teachingPeriods} taught</span>
                    <span
                      className={`font-bold tabular-nums px-2 py-0.5 rounded-full ${
                        t.gapPeriods >= 4
                          ? "bg-red-50 text-red-600"
                          : t.gapPeriods >= 2
                            ? "bg-amber-50 text-amber-600"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {t.gapPeriods} gap{t.gapPeriods !== 1 ? "s" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Subject distribution */}
      <Card className="p-6 border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen size={16} className="text-slate-500 dark:text-slate-400" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Subject Distribution
          </h3>
        </div>
        {subjects.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No subjects scheduled.</p>
        ) : (
          <ul className="space-y-3">
            {subjects.map((s) => (
              <li key={s.subjectId} className="flex items-center gap-3">
                <span className="w-28 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                  {s.subjectName}
                </span>
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${(s.periods / maxSubjectPeriods) * 100}%`,
                      backgroundColor: s.color,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap w-20 text-right">
                  {s.periods} · {s.pct}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};
