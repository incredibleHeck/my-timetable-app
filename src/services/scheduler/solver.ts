import { AppData, ScheduleResult, Conflict, ClassGroup } from "../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { getPeriodType, getNextClassPeriod } from "./utils";

export const solveSmart = (
  units: AllocationUnit[],
  data: AppData
): { schedule: ScheduleResult; conflicts: Conflict[] } => {
  const globalPeriods = data.settings.periodsPerDay;

  // FIX 1: Dynamic Days (Don't hardcode 5)
  const days = (data.settings as any).daysPerWeek || 5;

  const maxSystemPeriods = Math.max(
    globalPeriods,
    ...data.classes.map((c) => c.periodCount || 0)
  );

  const globalDayStructure = data.settings.dayStructure;

  // Cache Single Resource Subjects
  const singleResourceSubjectIds = new Set(
    data.subjects.filter((s) => s.isSingleResource).map((s) => s.id)
  );

  // Initialize State
  const state: SchedulerState = {
    schedule: {},
    teacherOccupancy: {},
    classOccupancy: {},
    classDailySubjects: {},
    singleResourceUsage: {},
  };

  // Hydrate State
  data.classes.forEach((c) => {
    const pCount = c.periodCount || globalPeriods;
    state.schedule[c.id] = {};
    state.classOccupancy[c.id] = Array(days)
      .fill(null)
      .map(() => Array(pCount).fill(false));
    state.classDailySubjects[c.id] = {};
    for (let d = 0; d < days; d++)
      state.classDailySubjects[c.id][d] = new Set();
  });

  data.teachers.forEach((t) => {
    state.teacherOccupancy[t.id] = Array(days)
      .fill(null)
      .map(() => Array(maxSystemPeriods).fill(false));
    t.constraints.forEach((row, d) => {
      row.forEach((isBlocked, p) => {
        if (isBlocked && d < days && p < maxSystemPeriods)
          state.teacherOccupancy[t.id][d][p] = true;
      });
    });
  });

  singleResourceSubjectIds.forEach((id) => {
    state.singleResourceUsage[id] = Array(days)
      .fill(null)
      .map(() => Array(maxSystemPeriods).fill(false));
  });

  const conflicts: Conflict[] = [];

  // --- SOLVING LOOP ---
  for (const unit of units) {
    let placed = false;
    const unitClasses = unit.classIds
      .map((id) => data.classes.find((c) => c.id === id))
      .filter((c) => !!c) as ClassGroup[];

    // Check if Core Subject (For Morning Bias)
    const lowerName = unit.subjectName.toLowerCase();
    const isCore =
      lowerName.includes("math") ||
      lowerName.includes("english") ||
      lowerName.includes("science");

    const unitPeriodLimit = Math.min(
      ...unitClasses.map((c) => c.periodCount || globalPeriods)
    );

    let possibleSlots: { d: number; p: number; p2: number; score: number }[] =
      [];

    for (let d = 0; d < days; d++) {
      for (let p = 0; p < unitPeriodLimit; p++) {
        // 1. Period Type Check (Global Structure Strictness)
        // FIX 3: Strictly enforce that we can only place in "CLASS" periods
        const globalType = getPeriodType(globalDayStructure, p);
        if (globalType !== "CLASS") continue;

        const allClassesAvailable = unitClasses.every((c) => {
          const struct = c.structure?.length ? c.structure : globalDayStructure;
          // If class has custom structure, check that too
          return getPeriodType(struct, p) === "CLASS";
        });
        if (!allClassesAvailable) continue;

        // 2. Duration Check
        let p2 = -1;
        if (unit.duration === 2) {
          const primaryClass = unitClasses[0];
          const primaryStructure = primaryClass?.structure?.length
            ? primaryClass.structure
            : globalDayStructure;

          const primaryLimit = primaryClass.periodCount || globalPeriods;

          const next = getNextClassPeriod(p, primaryStructure, primaryLimit);
          if (next === null) continue;
          p2 = next;

          // Double check Global Structure for P2
          if (getPeriodType(globalDayStructure, p2) !== "CLASS") continue;

          const allClassesAvailableP2 = unitClasses.every((c) => {
            const limit = c.periodCount || globalPeriods;
            if (p2 >= limit) return false;
            const struct = c.structure?.length
              ? c.structure
              : globalDayStructure;
            return getPeriodType(struct, p2) === "CLASS";
          });
          if (!allClassesAvailableP2) continue;
        }

        // 3. Fixed Occasions (Assemblies, etc)
        if (data.settings.fixedOccasions?.[d]?.[p]) continue;
        if (unit.duration === 2 && data.settings.fixedOccasions?.[d]?.[p2])
          continue;

        // Class Specific Fixed Sessions
        const isClassBlocked = unitClasses.some(
          (c) =>
            c.fixedSessions?.[d]?.[p] ||
            (unit.duration === 2 && c.fixedSessions?.[d]?.[p2])
        );
        if (isClassBlocked) continue;

        // 4. Class Occupancy
        let classClash = false;
        for (const cid of unit.classIds) {
          if (state.classOccupancy[cid][d][p]) {
            classClash = true;
            break;
          }
        }
        if (classClash) continue;

        if (unit.duration === 2) {
          for (const cid of unit.classIds) {
            if (state.classOccupancy[cid][d][p2]) {
              classClash = true;
              break;
            }
          }
          if (classClash) continue;
        }

        // 5. Teacher Occupancy
        let teacherClash = false;
        for (const tid of unit.teacherIds) {
          if (state.teacherOccupancy[tid][d][p]) {
            teacherClash = true;
            break;
          }
          if (unit.duration === 2 && state.teacherOccupancy[tid][d][p2]) {
            teacherClash = true;
            break;
          }
        }
        if (teacherClash) continue;

        // 5b. Fatigue Guard (Consecutive Periods)
        const maxConsecutive = data.settings.maxConsecutivePeriods || 4;
        let fatigueConflict = false;

        for (const tid of unit.teacherIds) {
          const dayMap = state.teacherOccupancy[tid][d];
          let currentRun = 0;
          for (let i = 0; i < dayMap.length; i++) {
            let isOccupied = dayMap[i];
            if (i === p || (unit.duration === 2 && i === p2)) isOccupied = true;

            if (isOccupied) currentRun++;
            else currentRun = 0;

            if (currentRun > maxConsecutive) {
              fatigueConflict = true;
              break;
            }
          }
          if (fatigueConflict) break;
        }
        if (fatigueConflict) continue;

        // 6. Single Resource
        if (singleResourceSubjectIds.has(unit.subjectId)) {
          if (state.singleResourceUsage[unit.subjectId][d][p]) continue;
          if (
            unit.duration === 2 &&
            state.singleResourceUsage[unit.subjectId][d][p2]
          )
            continue;
        }

        // 7. Max Periods & Sandwich
        let dailyLimitExceeded = false;
        let sandwichConflict = false;

        const cid = unit.classIds[0];
        const struct = unitClasses[0].structure?.length
          ? unitClasses[0].structure
          : globalDayStructure;

        if (state.classDailySubjects[cid][d].has(unit.subjectId)) {
          let existingPeriods = 0;
          let prevSlot = -99;
          let nextSlot = 999;

          const daySchedule = state.schedule[cid][d];
          for (const pStr in daySchedule) {
            const pIdx = parseInt(pStr);
            const slot = daySchedule[pStr];
            if (slot.subjectId === unit.subjectId) {
              existingPeriods++;
              if (pIdx < p) prevSlot = Math.max(prevSlot, pIdx);
              if (pIdx > p) nextSlot = Math.min(nextSlot, pIdx);
            }
          }

          if (existingPeriods + unit.duration > 2) {
            dailyLimitExceeded = true;
          } else {
            // Sandwich Logic (Gap Detection)
            if (prevSlot !== -99) {
              for (let gap = prevSlot + 1; gap < p; gap++) {
                if (getPeriodType(struct, gap) === "CLASS") {
                  sandwichConflict = true;
                  break;
                }
              }
            }
            if (!sandwichConflict && nextSlot !== 999) {
              const endOfCurrent = unit.duration === 2 ? p2 : p;
              for (let gap = endOfCurrent + 1; gap < nextSlot; gap++) {
                if (getPeriodType(struct, gap) === "CLASS") {
                  sandwichConflict = true;
                  break;
                }
              }
            }
          }
        }

        if (dailyLimitExceeded || sandwichConflict) continue;

        // --- SCORING ---
        let score = 0;
        score += globalPeriods - p; // Pack mornings

        if (isCore) {
          if (p < 4) score += 50;
          else score -= 10;
        }

        // Teacher Continuity
        unit.teacherIds.forEach((tid) => {
          if (p > 0 && state.teacherOccupancy[tid][d][p - 1]) score += 15;
          const endP = unit.duration === 2 ? p2 : p;
          if (
            endP < maxSystemPeriods - 1 &&
            state.teacherOccupancy[tid][d][endP + 1]
          )
            score += 15;
        });

        score += Math.random();
        possibleSlots.push({ d, p, p2, score });
      }
    }

    possibleSlots.sort((a, b) => b.score - a.score);

    if (possibleSlots.length > 0) {
      const { d, p, p2 } = possibleSlots[0];

      unit.classIds.forEach((cid) => {
        if (!state.schedule[cid][d]) state.schedule[cid][d] = {};
        state.schedule[cid][d][p] = {
          subjectId: unit.subjectId,
          teacherId: unit.teacherIds[0] || "Unassigned",
          classId: cid,
          isFixed: false,
        };
        state.classOccupancy[cid][d][p] = true;
        state.classDailySubjects[cid][d].add(unit.subjectId);

        if (unit.duration === 2 && p2 !== -1) {
          state.schedule[cid][d][p2] = {
            subjectId: unit.subjectId,
            teacherId: unit.teacherIds[0] || "Unassigned",
            classId: cid,
            isFixed: true,
          };
          state.classOccupancy[cid][d][p2] = true;
        }
      });

      unit.teacherIds.forEach((tid) => {
        state.teacherOccupancy[tid][d][p] = true;
        if (unit.duration === 2 && p2 !== -1)
          state.teacherOccupancy[tid][d][p2] = true;
      });

      if (singleResourceSubjectIds.has(unit.subjectId)) {
        state.singleResourceUsage[unit.subjectId][d][p] = true;
        if (unit.duration === 2 && p2 !== -1)
          state.singleResourceUsage[unit.subjectId][d][p2] = true;
      }

      placed = true;
    }

    if (!placed) {
      conflicts.push({
        classId: unit.classIds.join(", "),
        className: unit.classNames.join(", "),
        subjectId: unit.subjectId,
        subjectName: unit.subjectName,
        teacherName: unit.teacherNames.join(", ") || "Unassigned",
        duration: unit.duration,
        reason: "Could not find a valid slot (Constraints/Resource/Fatigue)",
        // FIX 2: Provide default day/period for Unplaced Lessons to satisfy TS
        day: -1,
        period: -1,
        severity: "HIGH",
      });
    }
  }

  return { schedule: state.schedule, conflicts };
};
