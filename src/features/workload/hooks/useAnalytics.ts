import { useMemo } from "react";
import { AppData } from "../../../types";

export interface RoomUtilization {
  roomId: string;
  roomName: string;
  isHomeRoom: boolean;
  occupiedSlots: number;
  capacitySlots: number;
  occupancyPct: number;
}

export interface TeacherGapStat {
  teacherId: string;
  teacherName: string;
  teachingPeriods: number;
  gapPeriods: number;
  busiestDayGaps: number;
}

export interface SubjectDistribution {
  subjectId: string;
  subjectName: string;
  color: string;
  periods: number;
  pct: number;
}

export interface AnalyticsSummary {
  totalLessons: number;
  teachingSlotsPerWeek: number;
  avgRoomOccupancyPct: number;
  totalGapPeriods: number;
  roomsCount: number;
  teachersCount: number;
  scheduledSubjects: number;
}

export interface Analytics {
  summary: AnalyticsSummary;
  rooms: RoomUtilization[];
  teacherGaps: TeacherGapStat[];
  subjects: SubjectDistribution[];
  hasSchedule: boolean;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Derives school-wide scheduling analytics from the generated timetable:
 * room occupancy, teacher idle/gap windows, and subject spread. All figures
 * come from `data.schedule` + `data.settings.dayStructure`, so they update
 * automatically whenever the schedule changes.
 */
export const useAnalytics = (data: AppData): Analytics => {
  return useMemo(() => {
    const { settings, rooms, teachers, subjects, schedule } = data;
    const days = settings.daysPerWeek ?? 5;

    // Indices of teaching (CLASS) periods within a day.
    const teachingIndices = settings.dayStructure
      .map((p, i) => (p.type === "CLASS" ? i : -1))
      .filter((i) => i >= 0);
    const teachingIndexSet = new Set(teachingIndices);
    const capacityPerWeek = teachingIndices.length * days;

    // Single pass over the schedule to aggregate everything.
    const roomOccupied = new Map<string, Set<string>>(); // roomId -> "day:period"
    const teacherDayPeriods = new Map<string, Map<number, Set<number>>>(); // teacher -> day -> periods
    const subjectCount = new Map<string, number>();
    let totalLessons = 0;

    for (const classId of Object.keys(schedule)) {
      const byDay = schedule[classId];
      if (!byDay) continue;

      for (const dayKey of Object.keys(byDay)) {
        const day = Number(dayKey);
        const byPeriod = byDay[day];
        if (!byPeriod) continue;

        for (const periodKey of Object.keys(byPeriod)) {
          const period = Number(periodKey);
          const slot = byPeriod[period];
          if (!slot) continue;

          totalLessons++;

          if (slot.subjectId) {
            subjectCount.set(slot.subjectId, (subjectCount.get(slot.subjectId) ?? 0) + 1);
          }

          if (slot.roomId) {
            let set = roomOccupied.get(slot.roomId);
            if (!set) {
              set = new Set<string>();
              roomOccupied.set(slot.roomId, set);
            }
            set.add(`${day}:${period}`);
          }

          if (slot.teacherId && teachingIndexSet.has(period)) {
            let byDayMap = teacherDayPeriods.get(slot.teacherId);
            if (!byDayMap) {
              byDayMap = new Map<number, Set<number>>();
              teacherDayPeriods.set(slot.teacherId, byDayMap);
            }
            let periods = byDayMap.get(day);
            if (!periods) {
              periods = new Set<number>();
              byDayMap.set(day, periods);
            }
            periods.add(period);
          }
        }
      }
    }

    // --- Room occupancy ---
    const roomStats: RoomUtilization[] = rooms
      .map((room) => {
        const occupiedSlots = roomOccupied.get(room.id)?.size ?? 0;
        const occupancyPct =
          capacityPerWeek > 0 ? Math.min((occupiedSlots / capacityPerWeek) * 100, 100) : 0;
        return {
          roomId: room.id,
          roomName: room.name,
          isHomeRoom: !!room.isHomeRoom,
          occupiedSlots,
          capacitySlots: capacityPerWeek,
          occupancyPct: round1(occupancyPct),
        };
      })
      .sort((a, b) => b.occupancyPct - a.occupancyPct);

    // --- Teacher gaps (idle CLASS periods between first and last lesson of a day) ---
    const teacherGaps: TeacherGapStat[] = teachers
      .map((teacher) => {
        const byDayMap = teacherDayPeriods.get(teacher.id);
        let teachingPeriods = 0;
        let gapPeriods = 0;
        let busiestDayGaps = 0;

        if (byDayMap) {
          for (const periods of byDayMap.values()) {
            if (periods.size === 0) continue;
            teachingPeriods += periods.size;

            const sorted = [...periods].sort((a, b) => a - b);
            const first = sorted[0];
            const last = sorted[sorted.length - 1];

            let dayGaps = 0;
            for (const idx of teachingIndices) {
              if (idx > first && idx < last && !periods.has(idx)) dayGaps++;
            }
            gapPeriods += dayGaps;
            if (dayGaps > busiestDayGaps) busiestDayGaps = dayGaps;
          }
        }

        return {
          teacherId: teacher.id,
          teacherName: teacher.name,
          teachingPeriods,
          gapPeriods,
          busiestDayGaps,
        };
      })
      .sort((a, b) => b.gapPeriods - a.gapPeriods || b.teachingPeriods - a.teachingPeriods);

    // --- Subject distribution ---
    const subjectStats: SubjectDistribution[] = subjects
      .map((subject) => {
        const periods = subjectCount.get(subject.id) ?? 0;
        return {
          subjectId: subject.id,
          subjectName: subject.name,
          color: subject.color || "#94a3b8",
          periods,
          pct: totalLessons > 0 ? round1((periods / totalLessons) * 100) : 0,
        };
      })
      .filter((s) => s.periods > 0)
      .sort((a, b) => b.periods - a.periods);

    const avgRoomOccupancyPct =
      roomStats.length > 0
        ? round1(roomStats.reduce((sum, r) => sum + r.occupancyPct, 0) / roomStats.length)
        : 0;

    const summary: AnalyticsSummary = {
      totalLessons,
      teachingSlotsPerWeek: capacityPerWeek,
      avgRoomOccupancyPct,
      totalGapPeriods: teacherGaps.reduce((sum, t) => sum + t.gapPeriods, 0),
      roomsCount: rooms.length,
      teachersCount: teachers.length,
      scheduledSubjects: subjectStats.length,
    };

    return {
      summary,
      rooms: roomStats,
      teacherGaps,
      subjects: subjectStats,
      hasSchedule: totalLessons > 0,
    };
  }, [data]);
};
