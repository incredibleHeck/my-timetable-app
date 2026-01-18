import { AppData, Teacher, Subject, ClassGroup } from "../../../types";
import { AllocationUnit } from "./types";
import { calculatePriority } from "./heuristics";

/**
 * REFACTORED: Preparation Layer
 * Ensures 100% Curriculum Respect and prepares metadata for MRV/LCV.
 */
export const prepareAllocationUnits = (data: AppData): AllocationUnit[] => {
  const units: AllocationUnit[] = [];
  const { classes, jointClasses, subjects, teachers } = data;

  const teacherMap = new Map(teachers.map((t) => [t.id, t]));
  const subjectMap = new Map(subjects.map((s) => [s.id, s]));
  const classMap = new Map(classes.map((c) => [c.id, c]));

  const isCoreSubject = (name?: string) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return (
      n.includes("math") ||
      n.includes("english") ||
      n.includes("science") ||
      n.includes("physics") ||
      n.includes("chem") ||
      n.includes("bio")
    );
  };

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
    const curr = repClass?.curriculum.find(c => c.subjectId === jc.subjectId);
    
    if (!curr) return;

    const createJoint = (suffix: string, duration: number) => {
      const u: AllocationUnit = {
        id: `JOINT-${jc.id}-${suffix}`,
        subjectId: jc.subjectId,
        subjectName: subject?.name || "Unknown",
        duration,
        classIds: jc.classIds,
        classNames: jc.classIds.map(id => classMap.get(id)?.name || ""),
        teacherIds: jc.teacherId ? [jc.teacherId] : [],
        teacherNames: [jc.teacherId ? teacherMap.get(jc.teacherId)?.name || "Unknown" : "Unassigned"],
        priority: 0,
        defaultRoomId,
        requiredRoomType,
        jointClassId: jc.id,
        isCore: isCoreSubject(subject?.name)
      };
      u.priority = calculatePriority(u, data, teacherMap, subjectMap);
      units.push(u);
    };

    for (let i = 0; i < (curr.doubles || 0); i++) createJoint(`D-${i}`, 2);
    for (let i = 0; i < (curr.singles || 0); i++) createJoint(`S-${i}`, 1);

    // Mark as processed
    jc.classIds.forEach(cid => processedCurriculumItems.add(`${cid}-${jc.subjectId}`));
  });

  // 4. PROCESS STANDARD CLASSES & ELECTIVE BLOCKS
  classes.forEach((cls) => {
    cls.curriculum.forEach((curr) => {
      const compositeKey = `${cls.id}-${curr.subjectId}`;
      if (processedCurriculumItems.has(compositeKey)) return;

      const subject = subjectMap.get(curr.subjectId);
      const requiredRoomType = resolveRoomRequirement(subject);
      
      const createUnit = (suffix: string, duration: number) => {
        const u: AllocationUnit = {
          id: `${cls.id}-${curr.subjectId}-${suffix}`,
          subjectId: curr.subjectId,
          subjectName: subject?.name || "Unknown",
          duration,
          classIds: [cls.id],
          classNames: [cls.name],
          teacherIds: curr.assignedTeacherId ? [curr.assignedTeacherId] : [],
          teacherNames: [curr.assignedTeacherId ? teacherMap.get(curr.assignedTeacherId)?.name || "Unknown" : "Unassigned"],
          priority: 0,
          defaultRoomId: cls.defaultRoomId || cls.classroomId,
          requiredRoomType,
          electiveBlockId: (curr as any).electiveBlockId,
          isCore: isCoreSubject(subject?.name)
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
  const totalRequiredPeriods = classes.reduce((acc, c) => 
    acc + c.curriculum.reduce((sum, curr) => sum + (curr.singles || 0) + (curr.doubles || 0) * 2, 0), 0
  );
  
  // Note: For Joint units, we must count them for EACH class they serve.
  const totalGeneratedPeriods = units.reduce((acc, u) => acc + (u.duration * u.classIds.length), 0);

  if (totalRequiredPeriods !== totalGeneratedPeriods) {
    console.warn(`Curriculum Mismatch: Required ${totalRequiredPeriods}, Generated ${totalGeneratedPeriods}`);
  }

  // 6. SHUFFLE & STATIC MRV SORT
  return units
    .sort(() => Math.random() - 0.5)
    .sort((a, b) => b.priority - a.priority);
};