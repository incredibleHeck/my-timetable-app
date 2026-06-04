import { AppData, DutyAssignment } from "../../../types";
import { generateId } from "../../../utils/utils";

interface GeneratorConfig {
  viewType: "DAILY" | "WEEKLY";
  numWeeks: number;
  minTeachers: number;
  maxTeachers: number;
  excludedTeacherIds: string[];
}

export const generateDutyRoster = (data: AppData, config: GeneratorConfig): DutyAssignment[] => {
  const { viewType, numWeeks, minTeachers, maxTeachers, excludedTeacherIds } = config;
  const newAssignments: DutyAssignment[] = [];

  // Filter out excluded teachers
  const availableTeachers = data.teachers.filter((t) => !excludedTeacherIds.includes(t.id));
  if (availableTeachers.length === 0) return [];

  const assignedGlobal = new Set<string>();
  const rowCount = viewType === "DAILY" ? 5 : numWeeks;

  for (let r = 0; r < rowCount; r++) {
    const desiredCount = Math.floor(Math.random() * (maxTeachers - minTeachers + 1)) + minTeachers;

    // Pick from pool of teachers not yet assigned in the ENTIRE generated roster
    const pool = availableTeachers.filter((t) => !assignedGlobal.has(t.id));

    // If pool is empty, we simply cannot assign more teachers for the remaining rows/days
    if (pool.length === 0) break;

    // We can only assign as many as we have left in the pool
    const targetCount = Math.min(desiredCount, pool.length);

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    selected.forEach((t, slotIdx) => {
      assignedGlobal.add(t.id);
      newAssignments.push({
        id: generateId(),
        locationId: "general",
        day: r, // Row Index (Day or Week)
        period: slotIdx, // Slot Index
        teacherId: t.id,
      });
    });
  }

  return newAssignments;
};
