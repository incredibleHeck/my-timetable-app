import { AppData, DutyAssignment, Teacher } from "../../../types";
import { generateId } from "../../../utils/utils";

interface GeneratorConfig {
  viewType: "DAILY" | "WEEKLY";
  numWeeks: number;
  minTeachers: number;
  maxTeachers: number;
  excludedTeacherIds: string[];
}

export const generateDutyRoster = (
  data: AppData,
  config: GeneratorConfig
): DutyAssignment[] => {
  const { viewType, numWeeks, minTeachers, maxTeachers, excludedTeacherIds } = config;
  const newAssignments: DutyAssignment[] = [];
  
  // Filter out excluded teachers
  const availableTeachers = data.teachers.filter(t => !excludedTeacherIds.includes(t.id));
  if (availableTeachers.length === 0) return [];

  let assignedInCycle = new Set<string>();
  const rowCount = viewType === "DAILY" ? 5 : numWeeks;

  for (let r = 0; r < rowCount; r++) {
    const targetCount = Math.floor(Math.random() * (maxTeachers - minTeachers + 1)) + minTeachers;
    
    // Pick from pool of teachers not yet assigned in this cycle
    let pool = availableTeachers.filter(t => !assignedInCycle.has(t.id));
    
    // If pool is too small, reset cycle (everyone is available again)
    if (pool.length < targetCount) {
      assignedInCycle.clear();
      pool = [...availableTeachers];
    }
    
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    selected.forEach((t, slotIdx) => {
      assignedInCycle.add(t.id);
      newAssignments.push({
        id: generateId(),
        locationId: "general",
        day: r, // Row Index
        period: slotIdx, // Slot Index
        teacherId: t.id
      });
    });
  }

  return newAssignments;
};
