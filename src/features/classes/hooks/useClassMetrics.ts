import { AppData, ClassGroup } from "../../../types";

export const useClassMetrics = (data: AppData) => {
  const getLoadMetrics = (cls: ClassGroup) => {
    // Use class-specific structure if defined, otherwise global default
    const structure =
      cls.structure && cls.structure.length > 0 ? cls.structure : data.settings.dayStructure;

    // Use class specific period count or global
    const pCount = cls.periodCount || data.settings.periodsPerDay;

    let capacity = 0;
    let fixedLoad = 0;

    // Calculate Capacity based on 'CLASS' slots in a 5-day week
    // And account for Fixed Occasions (Global OR Class-Specific) taking up load
    for (let d = 0; d < 5; d++) {
      for (let p = 0; p < pCount; p++) {
        // Determine type of this slot
        let pType = "CLASS";
        if (p < structure.length) {
          const item = structure[p];
          pType = (typeof item === "object" ? item.type : item) || "CLASS";
        }

        if (pType === "CLASS") {
          capacity++;
          // 1. Global Fixed Event
          if (data.settings.fixedOccasions[d]?.[p]) {
            fixedLoad++;
          }
          // 2. Class-Specific Fixed Event (e.g. Year 7 Clubs)
          else if (cls.fixedSessions?.[d]?.[p]) {
            fixedLoad++;
          }
        }
      }
    }

    const curriculumLoad = cls.curriculum.reduce((acc, curr) => acc + curr.periodsPerWeek, 0);

    return {
      assigned: curriculumLoad + fixedLoad,
      capacity,
    };
  };

  return { getLoadMetrics };
};
