import { useMemo } from "react";
import { AppData } from "../../../types";

export const useWorkloadStats = (data: AppData) => {
  const workloadStats = useMemo(() => {
    const { settings, teachers, classes, jointClasses, electives, schedule } = data;
    
    const teachablePeriodIndices = settings.dayStructure
      .map((p, index) => (p.type === "CLASS" ? index : -1))
      .filter((i) => i !== -1);

    const totalWeeklyCapacity = teachablePeriodIndices.length * 5;

    return teachers
      .map((t) => {
        // 1. Requested Workload (Curriculum-based) with De-duplication
        let assignedPeriods = 0;
        const countedJointClassIds = new Set<string>();
        const countedElectiveIds = new Set<string>();

        classes.forEach((c) => {
          c.curriculum.forEach((curr) => {
            // Check if this is part of a Joint Class
            const joint = jointClasses?.find(jc => 
              jc.subjectId === curr.subjectId && jc.classIds.includes(c.id)
            );

            // Determine effective teacher for this item
            const effectiveTeacherId = joint?.teacherId || curr.assignedTeacherId;

            if (effectiveTeacherId === t.id && !curr.isWorkloadExempt) {
              // Check if this is part of an Elective Block
              const elective = electives?.find(e => 
                e.subjectIds.includes(curr.subjectId) && e.classIds.includes(c.id)
              );

              if (joint) {
                if (!countedJointClassIds.has(joint.id)) {
                  assignedPeriods += curr.periodsPerWeek;
                  countedJointClassIds.add(joint.id);
                }
              } else if (elective) {
                if (!countedElectiveIds.has(elective.id)) {
                  assignedPeriods += curr.periodsPerWeek;
                  countedElectiveIds.add(elective.id);
                }
              } else {
                // Regular class
                assignedPeriods += curr.periodsPerWeek;
              }
            }
          });
        });

        // 2. Scheduled Workload (Timetable-based) - Count unique time slots
        const uniqueScheduledSlots = new Set<string>();
        Object.keys(schedule).forEach(classId => {
          const classSchedule = schedule[classId];
          Object.keys(classSchedule).forEach(dayStr => {
            const daySlots = classSchedule[parseInt(dayStr)];
            Object.keys(daySlots).forEach(periodStr => {
              const slot = daySlots[parseInt(periodStr)];
              if (slot.teacherId === t.id) {
                uniqueScheduledSlots.add(`${dayStr}_${periodStr}`);
              }
            });
          });
        });
        const scheduledPeriods = uniqueScheduledSlots.size;

        // 3. Availability and Utilization
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
          scheduledPeriods,
          availableSlots,
          blockedSlots: blockedTeachableSlots,
          utilizationPct,
        };
      })
      .sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [
    data.teachers,
    data.classes,
    data.jointClasses,
    data.schedule,
    data.settings.periodsPerDay,
    data.settings.dayStructure,
  ]);

  return { workloadStats };
};