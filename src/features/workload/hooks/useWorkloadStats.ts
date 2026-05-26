import { useMemo } from "react";
import { AppData } from "../../../types";

export interface ClassWorkloadBreakdown {
  classId: string;
  className: string;
  periods: number;
}

export const useWorkloadStats = (data: AppData) => {
  const workloadStats = useMemo(() => {
    const { settings, teachers, classes, jointClasses, electives, schedule } =
      data;

    const maxWeeklyCapacity = settings.maxTeachingPeriodsPerWeek ?? 24;

    const teachablePeriodIndices = settings.dayStructure
      .map((p, index) => (p.type === "CLASS" ? index : -1))
      .filter((i) => i !== -1);

    return teachers
      .map((t) => {
        let assignedPeriods = 0;
        const countedJointClassIds = new Set<string>();
        const countedElectiveIds = new Set<string>();
        const classBreakdownMap = new Map<string, ClassWorkloadBreakdown>();

        const addToBreakdown = (classId: string, className: string, periods: number) => {
          const existing = classBreakdownMap.get(classId);
          if (existing) {
            existing.periods += periods;
          } else {
            classBreakdownMap.set(classId, { classId, className, periods });
          }
        };

        classes.forEach((c) => {
          c.curriculum.forEach((curr) => {
            const joint = jointClasses?.find(
              (jc) =>
                jc.subjectId === curr.subjectId && jc.classIds.includes(c.id),
            );

            const effectiveTeacherId = joint?.teacherId || curr.assignedTeacherId;

            if (effectiveTeacherId === t.id && !curr.isWorkloadExempt) {
              const elective = electives?.find(
                (e) =>
                  e.subjectIds.includes(curr.subjectId) &&
                  e.classIds.includes(c.id),
              );

              if (joint) {
                if (!countedJointClassIds.has(joint.id)) {
                  assignedPeriods += curr.periodsPerWeek;
                  countedJointClassIds.add(joint.id);
                  joint.classIds.forEach((cid) => {
                    const cls = classes.find((x) => x.id === cid);
                    if (cls) {
                      addToBreakdown(cls.id, cls.name, curr.periodsPerWeek);
                    }
                  });
                }
              } else if (elective) {
                if (!countedElectiveIds.has(elective.id)) {
                  assignedPeriods += curr.periodsPerWeek;
                  countedElectiveIds.add(elective.id);
                  elective.classIds.forEach((cid) => {
                    const cls = classes.find((x) => x.id === cid);
                    if (cls) {
                      addToBreakdown(cls.id, cls.name, curr.periodsPerWeek);
                    }
                  });
                }
              } else {
                assignedPeriods += curr.periodsPerWeek;
                addToBreakdown(c.id, c.name, curr.periodsPerWeek);
              }
            }
          });
        });

        const classBreakdown = [...classBreakdownMap.values()].sort((a, b) =>
          a.className.localeCompare(b.className, undefined, { numeric: true }),
        );

        const uniqueScheduledSlots = new Set<string>();
        Object.keys(schedule).forEach((classId) => {
          const classSchedule = schedule[classId];
          Object.keys(classSchedule).forEach((dayStr) => {
            const daySlots = classSchedule[parseInt(dayStr)];
            Object.keys(daySlots).forEach((periodStr) => {
              const slot = daySlots[parseInt(periodStr)];
              if (slot.teacherId === t.id) {
                uniqueScheduledSlots.add(`${dayStr}_${periodStr}`);
              }
            });
          });
        });
        const scheduledPeriods = uniqueScheduledSlots.size;

        let blockedTeachableSlots = 0;
        if (t.constraints) {
          t.constraints.forEach((dayRow) => {
            dayRow.forEach((isBlocked, pIdx) => {
              if (isBlocked && teachablePeriodIndices.includes(pIdx)) {
                blockedTeachableSlots++;
              }
            });
          });
        }

        const availableSlots =
          teachablePeriodIndices.length * 5 - blockedTeachableSlots;

        const utilizationPct =
          maxWeeklyCapacity > 0
            ? (assignedPeriods / maxWeeklyCapacity) * 100
            : assignedPeriods > 0
              ? 100
              : 0;

        return {
          t,
          assignedPeriods,
          scheduledPeriods,
          availableSlots,
          maxWeeklyCapacity,
          blockedSlots: blockedTeachableSlots,
          utilizationPct,
          classBreakdown,
        };
      })
      .sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [
    data.teachers,
    data.classes,
    data.jointClasses,
    data.electives,
    data.schedule,
    data.settings.periodsPerDay,
    data.settings.dayStructure,
    data.settings.maxTeachingPeriodsPerWeek,
  ]);

  return { workloadStats };
};
