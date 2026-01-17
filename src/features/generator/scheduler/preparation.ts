import { AppData } from "../../../types";
import { AllocationUnit } from "./types";
import { calculatePriority } from "./heuristics";

/**
 * HELPER: Determine specific room requirements based on Subject metadata.
 * Bridges the gap between static data and the solver's resource awareness.
 */
const resolveRoomRequirement = (subject: any): string | undefined => {
  if (!subject) return undefined;

  // 1. Explicit constraint in Subject data (Preferred)
  if (subject.requiredRoomType) return subject.requiredRoomType;

  // 2. Inferred from "Single Resource" flag (Legacy / Fallback)
  if (subject.isSingleResource) {
    const name = subject.name.toLowerCase();
    // Map common subject names to standard room types if not explicitly set
    if (
      name.includes("computing") ||
      name.includes("ict") ||
      name.includes("information")
    )
      return "Computer Lab";
    if (name.includes("music")) return "Music Room";
    if (
      name.includes("physical") ||
      name.includes("pe") ||
      name.includes("sport")
    )
      return "Field";
    if (
      name.includes("science") ||
      name.includes("physics") ||
      name.includes("chem") ||
      name.includes("bio")
    )
      return "Science Lab";
    if (name.includes("art")) return "Art Studio";

    // Default fallback for other single resources
    return "Specialist Room";
  }

  return undefined;
};

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
      repClass.defaultRoomId || repClass.classroomId || (repClass as any).roomId;
    const subject = subjectMap.get(jc.subjectId);

    // Resolve Room Type
    const requiredType = resolveRoomRequirement(subject);

    const createJointUnit = (idSuffix: string, duration: number) => {
      const u: AllocationUnit = {
        id: `JOINT-${jc.id}-${idSuffix}`,
        subjectId: jc.subjectId,
        subjectName: subject?.name || "Unknown",
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
        requiredRoomType: requiredType, // <--- Added
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
    const homeroomId = cls.defaultRoomId || cls.classroomId || (cls as any).roomId;

    cls.curriculum.forEach((curr) => {
      // SKIP if this is handled by a joint class
      if (jointLookup.has(`${curr.subjectId}-${cls.id}`)) return;

      const subject = subjectMap.get(curr.subjectId);
      // Resolve Room Type
      const requiredType = resolveRoomRequirement(subject);

      const createUnit = (idSuffix: string, duration: number) => {
        const u: AllocationUnit = {
          id: `${cls.id}-${curr.subjectId}-${idSuffix}`,
          subjectId: curr.subjectId,
          subjectName: subject?.name || "Unknown",
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
          requiredRoomType: requiredType, // <--- Added
          electiveBlockId: (curr as any).electiveBlockId,
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
  // We perform a random shuffle first to break ties between equal priority units (e.g. 2 different Math classes)
  // Then we sort by priority so the constraint-heavy units float to the top.
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  return units.sort((a, b) => b.priority - a.priority);
};
