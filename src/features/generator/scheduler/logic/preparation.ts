import { AppData, Subject } from "../../../../types";
import { AllocationUnit } from "../core/types";
import { calculatePriority } from "../solver/heuristics";
import { resolveSubjectIsCore } from "./subject-core";

/**
 * REFACTORED: Preparation Layer
 * Ensures 100% Curriculum Respect and prepares metadata for MRV/LCV.
 */
interface LooseCurriculumItem {
  electiveBlockId?: string;
}

export const prepareAllocationUnits = (data: AppData): AllocationUnit[] => {
  const units: AllocationUnit[] = [];
  const { classes, jointClasses, subjects, teachers } = data;

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const isCoreSubject = (subject?: Subject) => resolveSubjectIsCore(subject);

  // 1. TRACKER: Ensure we don't double-count joint/elective subjects
  const processedCurriculumItems = new Set<string>(); // "classId-subjectId"

  // 2. HELPERS
  const resolveRoomRequirement = (subject: Subject | undefined): string | undefined => {
    if (!subject) return undefined;
    return subject.requiredRoomType || (subject.isSingleResource ? "Specialist Room" : undefined);
  };

  const getCommonRoomId = (classIds: string[]) => {
    const firstClass = classMap.get(classIds[0]);
    return firstClass?.defaultRoomId || firstClass?.classroomId;
  };

  // 3. PROCESS JOINT CLASSES (High Constraint Atoms)
  jointClasses.forEach((jc) => {
    const subject = subjectMap.get(jc.subjectId);
    const requiredRoomType = resolveRoomRequirement(subject);
    const defaultRoomId = getCommonRoomId(jc.classIds);

    // Find curriculum counts from the first class (assumed identical for partners)
    const repClass = classMap.get(jc.classIds[0]);
    const curr = repClass?.curriculum.find((c) => c.subjectId === jc.subjectId);

    if (!curr) return;

    const createJoint = (suffix: string, duration: number) => {
      // RANK 2: STRUCTURAL HIERARCHY
      // Use the 'level' from the first class or parse it from the name
      const levelStr = repClass?.level || repClass?.name || "";
      const rankLevel = parseGradeLevel(levelStr);

      const u: AllocationUnit = {
        id: `JOINT-${jc.id}-${suffix}`,
        subjectId: jc.subjectId,
        subjectName: subject?.name || "Unknown",
        duration,
        classIds: jc.classIds,
        classNames: jc.classIds.map((id) => classMap.get(id)?.name || ""),
        teacherIds: jc.teacherId ? [jc.teacherId] : [],
        teacherNames: [
          jc.teacherId ? teacherMap.get(jc.teacherId)?.name || "Unknown" : "Unassigned",
        ],
        priority: 0,
        rankLevel, // RANK 2 metadata
        defaultRoomId,
        requiredRoomType,
        jointClassId: jc.id,
        isCore: isCoreSubject(subject),
      };
      u.priority = calculatePriority(u, data, teacherMap, subjectMap);
      units.push(u);
    };

    for (let i = 0; i < (curr.doubles || 0); i++) createJoint(`D-${i}`, 2);
    for (let i = 0; i < (curr.singles || 0); i++) createJoint(`S-${i}`, 1);

    // Mark as processed
    jc.classIds.forEach((cid) => processedCurriculumItems.add(`${cid}-${jc.subjectId}`));
  });

  // 4. PROCESS STANDARD CLASSES & ELECTIVE BLOCKS
  classes.forEach((cls) => {
    cls.curriculum.forEach((curr) => {
      const compositeKey = `${cls.id}-${curr.subjectId}`;
      if (processedCurriculumItems.has(compositeKey)) return;

      const subject = subjectMap.get(curr.subjectId);
      const requiredRoomType = resolveRoomRequirement(subject);

      const createUnit = (suffix: string, duration: number) => {
        // RANK 2: STRUCTURAL HIERARCHY
        const rankLevel = parseGradeLevel(cls.level || cls.name);

        const u: AllocationUnit = {
          id: `${cls.id}-${curr.subjectId}-${suffix}`,
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
          rankLevel, // RANK 2 metadata
          defaultRoomId: cls.defaultRoomId || cls.classroomId,
          requiredRoomType,
          electiveBlockId: (curr as LooseCurriculumItem).electiveBlockId,
          isCore: isCoreSubject(subject),
        };
        u.priority = calculatePriority(u, data, teacherMap, subjectMap);
        units.push(u);
      };

      for (let i = 0; i < (curr.doubles || 0); i++) createUnit(`D-${i}`, 2);
      for (let i = 0; i < (curr.singles || 0); i++) createUnit(`S-${i}`, 1);

      processedCurriculumItems.add(compositeKey);
    });
  });

  // 5. FINAL CURRICULUM AUDIT
  const totalRequiredPeriods = classes.reduce(
    (acc, c) =>
      acc +
      c.curriculum.reduce((sum, curr) => sum + (curr.singles || 0) + (curr.doubles || 0) * 2, 0),
    0,
  );

  // Note: For Joint units, we must count them for EACH class they serve.
  const totalGeneratedPeriods = units.reduce((acc, u) => acc + u.duration * u.classIds.length, 0);

  if (totalRequiredPeriods !== totalGeneratedPeriods) {
    console.warn(
      `Curriculum Mismatch: Required ${totalRequiredPeriods}, Generated ${totalGeneratedPeriods}`,
    );
  }

  // 6. RANK 2 SORTING: Higher grades first, then by MRV Priority
  return units.sort((a, b) => {
    // Higher rankLevel means higher grade (e.g. 12 > 11)
    if (b.rankLevel !== a.rankLevel) {
      return b.rankLevel - a.rankLevel;
    }
    // Tie-breaker: MRV priority within the same grade
    return b.priority - a.priority;
  });
};

/**
 * UTILITY: parseGradeLevel
 * Extracts a numeric value from Grade/Year strings.
 */
function parseGradeLevel(levelStr: string): number {
  const n = levelStr.toLowerCase();
  // Match "Year 12", "Grade 12", "12A" -> 12
  const match = n.match(/(\d+)/);
  if (match) return parseInt(match[1]);

  // Fallback for names
  if (n.includes("grad")) return 13; // Graduation?
  if (n.includes("kinder")) return 0;

  return 0;
}
