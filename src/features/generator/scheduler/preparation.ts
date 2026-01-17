import { AppData } from "../../../types";
import { AllocationUnit } from "./types";
import { calculatePriority } from "./heuristics";

export const prepareAllocationUnits = (data: AppData): AllocationUnit[] => {
  const units: AllocationUnit[] = [];
  const { classes, jointClasses, subjects, teachers } = data;

  // 1. MAPS FOR SPEED
  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  // 2. JOINT CLASS LOOKUP
  // Prevents standard classes from creating separate units for joint subjects
  const jointLookup = new Set<string>();
  jointClasses.forEach((jc) => {
    jc.classIds.forEach((cid) => jointLookup.add(`${jc.subjectId}-${cid}`));
  });

  // 3. PROCESS JOINT CLASSES
  jointClasses.forEach((jc) => {
    const repClass = classMap.get(jc.classIds[0]);
    if (!repClass) return;

    // Find the shared curriculum requirements for this joint subject
    const jointCurr = repClass.curriculum.find(
      (c) => c.subjectId === jc.subjectId
    );
    if (!jointCurr) return;

    const homeroomId =
      (repClass as any).classroomId || (repClass as any).roomId;

    const createJointUnit = (idSuffix: string, duration: number) => {
      const u: AllocationUnit = {
        id: `JOINT-${jc.id}-${idSuffix}`,
        subjectId: jc.subjectId,
        subjectName: subjectMap.get(jc.subjectId)?.name || "Unknown",
        duration,
        classIds: jc.classIds,
        classNames: jc.classIds.map((id) => classMap.get(id)?.name || ""),
        teacherIds: jc.teacherId ? [jc.teacherId] : [],
        teacherNames: [
          jc.teacherId
            ? teacherMap.get(jc.teacherId)?.name || "Unknown"
            : "Unassigned",
        ],
        priority: 0,
        defaultRoomId: homeroomId,
        jointClassId: jc.id,
      };

      u.priority = calculatePriority(u, teachers, data);
      units.push(u);
    };

    // Use 'jointCurr' here
    for (let i = 0; i < jointCurr.doubles; i++) createJointUnit(`D-${i}`, 2);
    for (let i = 0; i < jointCurr.singles; i++) createJointUnit(`S-${i}`, 1);
  });

  // 4. PROCESS STANDARD CLASSES
  classes.forEach((cls) => {
    const homeroomId = (cls as any).classroomId || (cls as any).roomId;

    cls.curriculum.forEach((curr) => {
      // SKIP if this is handled by a joint class
      if (jointLookup.has(`${curr.subjectId}-${cls.id}`)) return;

      const createUnit = (idSuffix: string, duration: number) => {
        const u: AllocationUnit = {
          id: `${cls.id}-${curr.subjectId}-${idSuffix}`,
          subjectId: curr.subjectId,
          subjectName: subjectMap.get(curr.subjectId)?.name || "Unknown",
          duration,
          classIds: [cls.id],
          classNames: [cls.name],
          teacherIds: curr.assignedTeacherId ? [curr.assignedTeacherId] : [],
          teacherNames: [
            curr.assignedTeacherId
              ? teacherMap.get(curr.assignedTeacherId)?.name || "Unknown"
              : "Unassigned",
          ],
          priority: 0,
          defaultRoomId: homeroomId,
        };

        u.priority = calculatePriority(u, teachers, data);
        units.push(u);
      };

      // Use 'curr' here
      for (let i = 0; i < curr.doubles; i++) createUnit(`D-${i}`, 2);
      for (let i = 0; i < curr.singles; i++) createUnit(`S-${i}`, 1);
    });
  });

  // 5. SHUFFLE AND SORT
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  return units.sort((a, b) => b.priority - a.priority);
};
