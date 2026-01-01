import { useState } from "react";
import { AppData, ScheduleSlot } from "../../../types";
import { DAYS } from "../../../utils/constants";

export const useScheduleSwap = (
  data: AppData,
  activeId: string,
  mode: "CLASS" | "TEACHER",
  onUpdate: (d: AppData) => void
) => {
  const [swapSource, setSwapSource] = useState<{
    d: number;
    p: number;
    duration: number;
  } | null>(null);

  // --- HELPERS ---
  const getSafeType = (item: any) =>
    (typeof item === "object" ? item.type : item) || "CLASS";

  const getNextClassIndex = (p: number, classId: string): number | null => {
    const cls = data.classes.find((c) => c.id === classId);
    const struct = cls?.structure || data.settings.dayStructure;
    const limit = cls?.periodCount || data.settings.periodsPerDay;
    for (let i = p + 1; i < limit; i++) {
      const item = struct[i];
      if (getSafeType(item) === "CLASS") return i;
    }
    return null;
  };

  const getDuration = (classId: string, d: number, p: number): number => {
    const slot = data.schedule[classId]?.[d]?.[p];
    if (!slot) return 1;
    const p2 = getNextClassIndex(p, classId);
    if (p2 !== null) {
      const nextSlot = data.schedule[classId]?.[d]?.[p2];
      if (nextSlot && nextSlot.isFixed && nextSlot.subjectId === slot.subjectId)
        return 2;
    }
    return 1;
  };

  const getJointSiblingIds = (
    classId: string,
    d: number,
    p: number
  ): string[] => {
    const slot = data.schedule[classId]?.[d]?.[p];
    if (!slot) return [classId];
    const joint = data.jointClasses.find(
      (j) => j.classIds.includes(classId) && j.subjectId === slot.subjectId
    );
    return joint ? joint.classIds : [classId];
  };

  const countSubjectOnDay = (
    classId: string,
    day: number,
    subjectId: string
  ): number => {
    const daySched = data.schedule[classId]?.[day] || {};
    let count = 0;
    Object.values(daySched).forEach((slot) => {
      if ((slot as ScheduleSlot).subjectId === subjectId) count++;
    });
    return count;
  };

  const validateMove = (
    teacherId: string | undefined,
    d: number,
    p: number,
    p2: number | null,
    excludeClassId: string
  ): string | null => {
    if (!teacherId) return null;
    const teacher = data.teachers.find((t) => t.id === teacherId);
    if (!teacher) return null;

    // 1. Constraints
    if (teacher.constraints?.[d]?.[p])
      return `${teacher.name} is blocked at ${DAYS[d]} P${p + 1}`;
    if (p2 !== null && teacher.constraints?.[d]?.[p2])
      return `${teacher.name} is blocked at ${DAYS[d]} P${p2 + 1}`;

    // 2. Overlaps
    for (const cls of data.classes) {
      if (cls.id === excludeClassId) continue;
      const s1 = data.schedule[cls.id]?.[d]?.[p];
      if (s1 && s1.teacherId === teacherId)
        return `${teacher.name} busy with ${cls.name}`;
      if (p2 !== null) {
        const s2 = data.schedule[cls.id]?.[d]?.[p2];
        if (s2 && s2.teacherId === teacherId)
          return `${teacher.name} busy with ${cls.name}`;
      }
    }
    return null;
  };

  // --- MAIN ACTION ---
  const handleSwap = (d: number, p: number) => {
    if (mode !== "CLASS") return;
    const slot = data.schedule[activeId]?.[d]?.[p];

    // Auto-redirect to start of double period
    if (slot?.isFixed) {
      let curr = p - 1;
      while (curr >= 0) {
        const prev = data.schedule[activeId]?.[d]?.[curr];
        if (prev && prev.subjectId === slot.subjectId && !prev.isFixed) {
          handleSwap(d, curr);
          return;
        }
        curr--;
      }
      return;
    }

    // 1. Select Source
    if (!swapSource) {
      if (slot) {
        const dur = getDuration(activeId, d, p);
        setSwapSource({ d, p, duration: dur });
      }
      return;
    }

    // 2. Select Target & Execute
    const targetDuration = slot ? getDuration(activeId, d, p) : 1;
    if (swapSource.duration !== targetDuration && slot) {
      const newDur = getDuration(activeId, d, p);
      setSwapSource({ d, p, duration: newDur }); // Switch selection
      return;
    }

    // Identify all involved classes (BFS for Joint Classes)
    const affectedClasses = new Set<string>([activeId]);
    const queue = [activeId];
    const sD = swapSource.d,
      sP = swapSource.p;

    while (queue.length > 0) {
      const currId = queue.pop()!;
      [getJointSiblingIds(currId, sD, sP), getJointSiblingIds(currId, d, p)]
        .flat()
        .forEach((sib) => {
          if (!affectedClasses.has(sib)) {
            affectedClasses.add(sib);
            queue.push(sib);
          }
        });
    }

    const classesToMove = Array.from(affectedClasses);
    const newSchedule = JSON.parse(JSON.stringify(data.schedule));

    // Validate & Execute
    for (const clsId of classesToMove) {
      if (!newSchedule[clsId]) newSchedule[clsId] = {};
      const clsDurS = getDuration(clsId, sD, sP);
      const clsDurT = getDuration(clsId, d, p);
      const sP2 = clsDurS === 2 ? getNextClassIndex(sP, clsId) : null;
      const tP2 =
        clsDurS === 2 || clsDurT === 2 ? getNextClassIndex(p, clsId) : null;

      if (swapSource.duration === 2 && tP2 === null) {
        alert(
          `Cannot fit double period for ${
            data.classes.find((c) => c.id === clsId)?.name
          }`
        );
        setSwapSource(null);
        return;
      }

      const sSlot = newSchedule[clsId][sD]?.[sP];
      const tSlot = newSchedule[clsId][d]?.[p];

      // Daily Limit Check
      if (sD !== d) {
        if (
          sSlot &&
          sSlot.subjectId !== tSlot?.subjectId &&
          countSubjectOnDay(clsId, d, sSlot.subjectId) + swapSource.duration > 2
        ) {
          alert("Daily limit exceeded.");
          setSwapSource(null);
          return;
        }
        if (
          tSlot &&
          tSlot.subjectId !== sSlot?.subjectId &&
          countSubjectOnDay(clsId, sD, tSlot.subjectId) + targetDuration > 2
        ) {
          alert("Daily limit exceeded.");
          setSwapSource(null);
          return;
        }
      }

      // Teacher Conflict Check
      if (sSlot) {
        const err = validateMove(
          sSlot.teacherId,
          d,
          p,
          swapSource.duration === 2 ? tP2 : null,
          clsId
        );
        if (err) {
          alert(err);
          setSwapSource(null);
          return;
        }
      }
      if (tSlot) {
        const err = validateMove(
          tSlot.teacherId,
          sD,
          sP,
          clsDurT === 2 ? sP2 : null,
          clsId
        );
        if (err) {
          alert(err);
          setSwapSource(null);
          return;
        }
      }
    }

    // Commit Changes
    for (const clsId of classesToMove) {
      const sP2 = getNextClassIndex(sP, clsId);
      const tP2 = getNextClassIndex(p, clsId);
      const sSlot = data.schedule[clsId]?.[sD]?.[sP];
      const tSlot = data.schedule[clsId]?.[d]?.[p];

      // Clear Old
      if (newSchedule[clsId][sD]) {
        delete newSchedule[clsId][sD][sP];
        if (sP2 !== null) delete newSchedule[clsId][sD][sP2];
      }
      if (newSchedule[clsId][d]) {
        delete newSchedule[clsId][d][p];
        if (tP2 !== null) delete newSchedule[clsId][d][tP2];
      }

      // Place New
      if (sSlot) {
        newSchedule[clsId][d][p] = sSlot;
        if (sSlot && getDuration(clsId, sD, sP) === 2 && tP2 !== null)
          newSchedule[clsId][d][tP2] = { ...sSlot, isFixed: true };
      }
      if (tSlot) {
        newSchedule[clsId][sD][sP] = tSlot;
        if (tSlot && getDuration(clsId, d, p) === 2 && sP2 !== null)
          newSchedule[clsId][sD][sP2] = { ...tSlot, isFixed: true };
      }
    }

    onUpdate({ ...data, schedule: newSchedule });
    setSwapSource(null);
  };

  return { swapSource, setSwapSource, handleSwap, getNextClassIndex };
};
