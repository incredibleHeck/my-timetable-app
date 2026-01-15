import { AppData } from "../../../types";
import { AllocationUnit } from "./types";
import { calculatePriority } from "./heuristics";

export const prepareAllocationUnits = (data: AppData): AllocationUnit[] => {
  const units: AllocationUnit[] = [];

  // 1. Pre-compute Lookups (O(1) access speedup)
  const teacherMap = new Map(data.teachers.map((t) => [t.id, t]));
  const subjectMap = new Map(data.subjects.map((s) => [s.id, s]));
  const classMap = new Map(data.classes.map((c) => [c.id, c]));

  // 2. Pre-compute Joint Usage to avoid expensive nested loop checks
  // Format: "subjectId|classId" -> true
  const jointUsageSet = new Set<string>();
  data.jointClasses.forEach((jc) => {
    jc.classIds.forEach((cid) => jointUsageSet.add(`${jc.subjectId}|${cid}`));
  });

  // 3. Pre-compute Elective Block Lookup
  // Format: "classId|subjectId" -> electiveBlockId
  const electiveLookup = new Map<string, string>();
  if (data.electives) {
    data.electives.forEach((eb) => {
      eb.classIds.forEach((cid) => {
        eb.subjectIds.forEach((sid) => {
          electiveLookup.set(`${cid}|${sid}`, eb.id);
        });
      });
    });
  }

  // A. Process Joint Classes
  data.jointClasses.forEach((jc) => {
    // Get curriculum from the first class (Representative)
    // We assume the curriculum is consistent across the joint group
    const repClass = classMap.get(jc.classIds[0]);
    if (!repClass) return;

    const curr = repClass.curriculum.find((x) => x.subjectId === jc.subjectId);
    if (!curr) return;

    // USE jc.teacherId if present, else fallback to curriculum
    const teacherId = jc.teacherId || curr.assignedTeacherId;
    const teacherName = teacherId
      ? teacherMap.get(teacherId)?.name || "Unknown"
      : "Unassigned";
    const subject = subjectMap.get(jc.subjectId);
    const subjectName = subject?.name || "Unknown";
    const classNames = jc.classIds.map(
      (cid) => classMap.get(cid)?.name || "Unknown"
    );

    // Create Double Periods
    for (let i = 0; i < curr.doubles; i++) {
      const u: AllocationUnit = {
        id: `JOINT_${jc.id}_D_${i}`,
        subjectId: jc.subjectId,
        subjectName,
        duration: 2,
        classIds: jc.classIds,
        classNames,
        teacherIds: teacherId ? [teacherId] : [],
        teacherNames: [teacherName],
        priority: 0,
        preferredRoomIds: subject?.preferredRoomIds,
        requiredRoomType: subject?.requiredRoomType,
      };
      u.priority = calculatePriority(u, data.teachers);
      units.push(u);
    }

    // Create Single Periods
    for (let i = 0; i < curr.singles; i++) {
      const u: AllocationUnit = {
        id: `JOINT_${jc.id}_S_${i}`,
        subjectId: jc.subjectId,
        subjectName,
        duration: 1,
        classIds: jc.classIds,
        classNames,
        teacherIds: teacherId ? [teacherId] : [],
        teacherNames: [teacherName],
        priority: 0,
        preferredRoomIds: subject?.preferredRoomIds,
        requiredRoomType: subject?.requiredRoomType,
      };
      u.priority = calculatePriority(u, data.teachers);
      units.push(u);
    }
  });

  // B. Process Standard Classes
  data.classes.forEach((cls) => {
    cls.curriculum.forEach((curr) => {
      // FAST CHECK: Is this handled by a joint class?
      if (jointUsageSet.has(`${curr.subjectId}|${cls.id}`)) return;

      const teacherId = curr.assignedTeacherId;
      const teacherName = teacherId
        ? teacherMap.get(teacherId)?.name || "Unknown"
        : "Unassigned";
      const subject = subjectMap.get(curr.subjectId);
      const subjectName = subject?.name || "Unknown";
      
      const electiveBlockId = electiveLookup.get(`${cls.id}|${curr.subjectId}`);

      // Create Double Periods
      for (let i = 0; i < curr.doubles; i++) {
        const u: AllocationUnit = {
          id: `${cls.id}_${curr.subjectId}_D_${i}`,
          subjectId: curr.subjectId,
          subjectName,
          duration: 2,
          classIds: [cls.id],
          classNames: [cls.name],
          teacherIds: teacherId ? [teacherId] : [],
          teacherNames: [teacherName],
          priority: 0,
          electiveBlockId,
          preferredRoomIds: subject?.preferredRoomIds,
          requiredRoomType: subject?.requiredRoomType,
        };
        u.priority = calculatePriority(u, data.teachers);
        units.push(u);
      }

      // Create Single Periods
      for (let i = 0; i < curr.singles; i++) {
        const u: AllocationUnit = {
          id: `${cls.id}_${curr.subjectId}_S_${i}`,
          subjectId: curr.subjectId,
          subjectName,
          duration: 1,
          classIds: [cls.id],
          classNames: [cls.name],
          teacherIds: teacherId ? [teacherId] : [],
          teacherNames: [teacherName],
          priority: 0,
          electiveBlockId,
          preferredRoomIds: subject?.preferredRoomIds,
          requiredRoomType: subject?.requiredRoomType,
        };
        u.priority = calculatePriority(u, data.teachers);
        units.push(u);
      }
    });
  });

  // Shuffle first to ensure randomness in regeneration for equal-priority items
  // (Using Fisher-Yates shuffle algorithm)
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  // Sort by Priority (Highest first)
  return units.sort((a, b) => b.priority - a.priority);
};
