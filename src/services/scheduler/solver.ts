import { AppData, ScheduleResult, Conflict, ClassGroup, ScheduleSlot } from "../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { getPeriodType, getNextClassPeriod } from "./utils";

export const solveSmart = (
  units: AllocationUnit[],
  data: AppData
): { schedule: ScheduleResult; conflicts: Conflict[] } => {
  const globalPeriods = data.settings.periodsPerDay;
  const days = (data.settings as any).daysPerWeek || 5;
  const maxSystemPeriods = Math.max(
    globalPeriods,
    ...data.classes.map((c) => Math.max(c.periodCount || 0, c.structure?.length || 0))
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
    roomOccupancy: {},
  };

  // Hydrate State
  data.classes.forEach((c) => {
    const pCount = Math.max(c.periodCount || globalPeriods, c.structure?.length || 0);
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

  const rooms = data.rooms || [];
  rooms.forEach((r) => {
    state.roomOccupancy[r.id] = Array(days)
      .fill(null)
      .map(() => Array(maxSystemPeriods).fill(false));
  });

  singleResourceSubjectIds.forEach((id) => {
    state.singleResourceUsage[id] = Array(days)
      .fill(null)
      .map(() => Array(maxSystemPeriods).fill(false));
  });

  const conflicts: Conflict[] = [];
  const processedElectiveBlocks = new Set<string>();

  // Helper: Find Room
  const findAvailableRoom = (
    d: number,
    p: number,
    duration: number,
    p2: number,
    preferredIds?: string[],
    requiredType?: string,
    excludedRoomIds: Set<string> = new Set()
  ): string | undefined => {
    // If no rooms defined in system, and no requirement, return undefined (No room needed)
    if (rooms.length === 0) return undefined;
    
    // If no requirement specified, and we are not enforcing strict room usage for everything, return undefined
    // (You can toggle this if you want ALL classes to have rooms)
    if (!preferredIds?.length && !requiredType) return undefined;

    const validRooms = rooms.filter((r) => {
      if (excludedRoomIds.has(r.id)) return false;
      if (requiredType && r.type !== requiredType) return false;
      if (preferredIds?.length && !preferredIds.includes(r.id)) return false;
      
      // Check Occupancy
      if (state.roomOccupancy[r.id][d][p]) return false;
      if (duration === 2 && state.roomOccupancy[r.id][d][p2]) return false;
      
      return true;
    });

    // Heuristic: Pick room with smallest capacity that fits? 
    // For now, just pick first valid.
    return validRooms.length > 0 ? validRooms[0].id : undefined;
  };

  // --- SOLVING LOOP ---
  for (const unit of units) {
    if (unit.electiveBlockId && processedElectiveBlocks.has(unit.electiveBlockId)) {
      continue;
    }

    // Determine Mode: Single or Gang
    const isGang = !!unit.electiveBlockId;
    const gangUnits = isGang 
      ? units.filter(u => u.electiveBlockId === unit.electiveBlockId)
      : [unit];

    if (isGang && unit.electiveBlockId) {
      processedElectiveBlocks.add(unit.electiveBlockId);
    }

    // Shared constraints (Class)
    // Note: Gang units share the same classIds (usually).
    const unitClasses = gangUnits[0].classIds
      .map((id) => data.classes.find((c) => c.id === id))
      .filter((c) => !!c) as ClassGroup[];

    // Use strict period limit from the Class
    const unitPeriodLimit = Math.min(
      ...unitClasses.map((c) => Math.max(c.periodCount || globalPeriods, c.structure?.length || 0))
    );

    let possibleSlots: { 
      d: number; 
      p: number; 
      p2: number; 
      score: number; 
      // Map Unit ID -> Room ID
      roomAssignments: Record<string, string | undefined>;
    }[] = [];

    // Search Space
    for (let d = 0; d < days; d++) {
      for (let p = 0; p < unitPeriodLimit; p++) {
        
        // 1. Check Structure (Prioritize Class Overrides)
        // If all classes involved consider this a CLASS period, it's valid, 
        // even if the global structure says it's a BREAK.
        const allClassesAvailable = unitClasses.every((c) => {
          const struct = c.structure?.length ? c.structure : globalDayStructure;
          return getPeriodType(struct, p) === "CLASS";
        });
        if (!allClassesAvailable) continue;

        // Duration Check
        const duration = gangUnits[0].duration;
        let p2 = -1;
        
        if (duration === 2) {
            const primaryClass = unitClasses[0];
            const primaryStructure = primaryClass?.structure?.length
              ? primaryClass.structure
              : globalDayStructure;
            const primaryLimit = primaryClass.periodCount || globalPeriods;
  
            const next = getNextClassPeriod(p, primaryStructure, primaryLimit);
            if (next === null) continue;
            p2 = next;
  
            const allClassesAvailableP2 = unitClasses.every((c) => {
              const limit = c.periodCount || globalPeriods;
              if (p2 >= limit) return false;
              const struct = c.structure?.length ? c.structure : globalDayStructure;
              return getPeriodType(struct, p2) === "CLASS";
            });
            if (!allClassesAvailableP2) continue;
        }

        // 3. Fixed Occasions
        if (data.settings.fixedOccasions?.[d]?.[p]) continue;
        if (duration === 2 && data.settings.fixedOccasions?.[d]?.[p2]) continue;

        // Class Fixed Sessions
        const isClassBlocked = unitClasses.some(
          (c) =>
            c.fixedSessions?.[d]?.[p] ||
            (duration === 2 && c.fixedSessions?.[d]?.[p2])
        );
        if (isClassBlocked) continue;

        // 4. Class Occupancy (Only need to check once for the group)
        let classClash = false;
        for (const cid of gangUnits[0].classIds) {
          if (state.classOccupancy[cid][d][p]) { classClash = true; break; }
          if (duration === 2 && state.classOccupancy[cid][d][p2]) { classClash = true; break; }
        }
        if (classClash) continue;

        // 5. Check PER UNIT constraints (Teachers, Rooms, Single Resource)
        let gangValid = true;
        const currentRoomAssignments: Record<string, string | undefined> = {};
        const takenRoomsInThisSlot = new Set<string>();

        for (const u of gangUnits) {
            // Teacher Occupancy
            for (const tid of u.teacherIds) {
                if (state.teacherOccupancy[tid][d][p] || (duration === 2 && state.teacherOccupancy[tid][d][p2])) {
                    gangValid = false; break;
                }
            }
            if (!gangValid) break;

            // Single Resource
             if (singleResourceSubjectIds.has(u.subjectId)) {
                if (state.singleResourceUsage[u.subjectId][d][p] || (duration === 2 && state.singleResourceUsage[u.subjectId][d][p2])) {
                    gangValid = false; break;
                }
             }
             if (!gangValid) break;

             // Room Check
             const roomId = findAvailableRoom(
                 d, p, duration, p2, 
                 u.preferredRoomIds, u.requiredRoomType, 
                 takenRoomsInThisSlot
             );
             
             // If room required but not found
             if ((u.requiredRoomType || u.preferredRoomIds?.length) && !roomId) {
                 gangValid = false; break;
             }

             if (roomId) {
                 takenRoomsInThisSlot.add(roomId);
                 currentRoomAssignments[u.id] = roomId;
             }
        }

        if (!gangValid) continue;

        // 6. Fatigue Guard (Check all teachers in gang)
        // ... (Simplified: Skipping expensive fatigue check for gang to save tokens/time, or implement if critical)
        // Implementing basic fatigue check:
        const maxConsecutive = data.settings.maxConsecutivePeriods || 4;
        let fatigueConflict = false;
        for (const u of gangUnits) {
            for (const tid of u.teacherIds) {
                const dayMap = state.teacherOccupancy[tid][d];
                let currentRun = 0;
                for (let i = 0; i < dayMap.length; i++) {
                    let isOccupied = dayMap[i];
                    if (i === p || (duration === 2 && i === p2)) isOccupied = true;
                    if (isOccupied) currentRun++; else currentRun = 0;
                    if (currentRun > maxConsecutive) { fatigueConflict = true; break; }
                }
                if (fatigueConflict) break;
            }
            if (fatigueConflict) break;
        }
        if (fatigueConflict) continue;

        // 7. Daily Subject Limit & Sandwich/Gap Detection
        let dailyLimitConflict = false;
        let gapConflict = false;

        for (const cid of gangUnits[0].classIds) {
          if (state.classDailySubjects[cid][d].has(unit.subjectId)) {
            let existingPeriods = 0;
            let prevSlot = -99;
            let nextSlot = 999;

            const daySchedule = state.schedule[cid][d];
            if (daySchedule) {
              for (const pStr in daySchedule) {
                const pIdx = parseInt(pStr);
                const slot = daySchedule[pStr];
                if (slot.subjectId === unit.subjectId) {
                  existingPeriods++;
                  if (pIdx < p) prevSlot = Math.max(prevSlot, pIdx);
                  if (pIdx > p) nextSlot = Math.min(nextSlot, pIdx);
                }
              }
            }

            // A. Daily Limit: Max 2 periods per day
            if (existingPeriods + duration > 2) {
              dailyLimitConflict = true;
              break;
            }

            // B. Gap Detection (Sandwich): Prevent gaps between sessions of same subject
            const struct = unitClasses[0].structure?.length ? unitClasses[0].structure : globalDayStructure;

            if (prevSlot !== -99) {
              for (let gap = prevSlot + 1; gap < p; gap++) {
                if (getPeriodType(struct, gap) === "CLASS") {
                  gapConflict = true;
                  break;
                }
              }
            }
            if (!gapConflict && nextSlot !== 999) {
              const endOfCurrent = duration === 2 ? p2 : p;
              for (let gap = endOfCurrent + 1; gap < nextSlot; gap++) {
                if (getPeriodType(struct, gap) === "CLASS") {
                  gapConflict = true;
                  break;
                }
              }
            }
            if (gapConflict) break;
          }
        }
        if (dailyLimitConflict || gapConflict) continue;

        // --- SCORING ---
        let score = 0;
        score += globalPeriods - p; // Pack mornings

        // Core Subject Morning Bias
        const lowerName = gangUnits[0].subjectName.toLowerCase();
        const isCore = lowerName.includes("math") || lowerName.includes("english") || lowerName.includes("science");
        if (isCore) {
            if (p < 4) score += 50;
            else score -= 10;
        }

        // Teacher Constraints Scoring
        gangUnits.forEach(u => {
            u.teacherIds.forEach(tid => {
                 // 1. Workload Balancing (Distribute load across days)
                 // Count how many periods this teacher already has on this day
                 let dailyLoad = 0;
                 state.teacherOccupancy[tid][d].forEach(isBusy => { if(isBusy) dailyLoad++; });
                 score -= (dailyLoad * 10); // Penalty for piling up on one day

                 // 2. Continuity (Minimize gaps)
                 // If teacher is teaching immediately before, BIG BONUS (Cluster classes)
                 if (p > 0 && state.teacherOccupancy[tid][d][p-1]) score += 25;
                 
                 // If teacher is teaching immediately after (Check p2+1 or p+1)
                 const endP = duration === 2 ? p2 : p;
                 if (endP < maxSystemPeriods - 1 && state.teacherOccupancy[tid][d][endP+1]) score += 25;
            });
        });

        score += Math.random();
        possibleSlots.push({ d, p, p2, score, roomAssignments: currentRoomAssignments });
      }
    }

    // Sort and Pick
    possibleSlots.sort((a, b) => b.score - a.score);

    if (possibleSlots.length > 0) {
        const { d, p, p2, roomAssignments } = possibleSlots[0];

        // Apply for ALL Gang Units
        gangUnits.forEach((u, idx) => {
            const isRepresentative = idx === 0; // The first unit owns the class schedule slot

            // 1. Schedule Entry (Only for Representative, or we overwrite)
            if (isRepresentative) {
                 u.classIds.forEach(cid => {
                     if (!state.schedule[cid][d]) state.schedule[cid][d] = {};
                     state.schedule[cid][d][p] = {
                         subjectId: u.subjectId,
                         teacherId: u.teacherIds[0] || "Unassigned",
                         classId: cid,
                         isFixed: false,
                         electiveBlockId: u.electiveBlockId,
                         roomId: roomAssignments[u.id]
                     };
                     state.classOccupancy[cid][d][p] = true;
                     state.classDailySubjects[cid][d].add(u.subjectId);

                     if (u.duration === 2 && p2 !== -1) {
                         state.schedule[cid][d][p2] = {
                             subjectId: u.subjectId,
                             teacherId: u.teacherIds[0] || "Unassigned",
                             classId: cid,
                             isFixed: true,
                             electiveBlockId: u.electiveBlockId,
                             roomId: roomAssignments[u.id]
                         };
                         state.classOccupancy[cid][d][p2] = true;
                     }
                 });
            }

            // 2. Teacher Occupancy (For ALL units)
            u.teacherIds.forEach(tid => {
                state.teacherOccupancy[tid][d][p] = true;
                if (u.duration === 2 && p2 !== -1) state.teacherOccupancy[tid][d][p2] = true;
            });

            // 3. Single Resource (For ALL units)
            if (singleResourceSubjectIds.has(u.subjectId)) {
                state.singleResourceUsage[u.subjectId][d][p] = true;
                if (u.duration === 2 && p2 !== -1) state.singleResourceUsage[u.subjectId][d][p2] = true;
            }

            // 4. Room Occupancy (For ALL units)
            const rId = roomAssignments[u.id];
            if (rId) {
                state.roomOccupancy[rId][d][p] = true;
                if (u.duration === 2 && p2 !== -1) state.roomOccupancy[rId][d][p2] = true;
            }
        });

    } else {
        // Handle Conflict
        gangUnits.forEach(u => {
            conflicts.push({
                classId: u.classIds.join(", "),
                className: u.classNames.join(", "),
                subjectId: u.subjectId,
                subjectName: u.subjectName,
                teacherName: u.teacherNames.join(", ") || "Unassigned",
                duration: u.duration,
                reason: isGang ? "Elective Block Conflict (Resources/Rooms)" : "Could not find a valid slot",
                day: -1,
                period: -1,
                severity: "HIGH",
            });
        });
    }
  }

  return { schedule: state.schedule, conflicts };
};
