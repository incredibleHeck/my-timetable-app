import { useMemo } from "react";
import { AppData } from "../../../types";

export const useWorkloadStats = (data: AppData) => {
  const workloadStats = useMemo(() => {
    const teachablePeriodIndices = data.settings.dayStructure
      .map((p, index) => (p.type === "CLASS" ? index : -1))
      .filter((i) => i !== -1);

    const totalWeeklyCapacity = teachablePeriodIndices.length * 5;

    return data.teachers
      .map((t) => {
        let assignedPeriods = 0;
        data.classes.forEach((c) => {
          c.curriculum.forEach((curr) => {
            if (curr.assignedTeacherId === t.id)
              assignedPeriods += curr.periodsPerWeek;
          });
        });

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

        const availableSlots = totalWeeklyCapacity - blockedTeachableSlots;

        const utilizationPct =
          availableSlots > 0
            ? (assignedPeriods / availableSlots) * 100
            : assignedPeriods > 0
            ? 100
            : 0;

        return {
          t,
          assignedPeriods,
          availableSlots,
          blockedSlots: blockedTeachableSlots,
          utilizationPct,
        };
      })
      .sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [
    data.teachers,
    data.classes,
    data.settings.periodsPerDay,
    data.settings.dayStructure,
  ]);

  return { workloadStats };
};
