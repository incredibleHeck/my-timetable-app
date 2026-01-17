import { AppData, Conflict } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { initializeState } from "./state";
import { checkHardConstraints } from "./constraints";
import { getPeriodType, getNextClassPeriod } from "./utils";

/**
 * SCORING HEURISTIC
 * Favors morning slots and adds randomness to prevent repetitive patterns.
 */
const calculateScore = (
  d: number,
  p: number,
  unit: AllocationUnit,
  data: AppData
): number => {
  let score = 0;
  const maxPeriods = data.settings.periodsPerDay;
  // Pack mornings first
  if (p < maxPeriods / 2) score += 10;
  // Tie-breaker
  score += Math.random() * 2;
  return score;
};

/**
 * ROOM SELECTION POOL HELPER
 */
const findRoomFromPool = (
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: SchedulerState,
  data: AppData,
  taken: Set<string>,
  filterFn: (r: any) => boolean
): string | undefined => {
  if (!data.rooms) return undefined;

  // Filter and sort small rooms first to preserve large capacity rooms
  const validRooms = data.rooms
    .filter(filterFn)
    .sort((a, b) => a.capacity - b.capacity);

  for (const r of validRooms) {
    if (taken.has(r.id)) continue;
    if (state.roomOccupancy[r.id]?.[d]?.[p]) continue;
    if (unit.duration === 2 && state.roomOccupancy[r.id]?.[d]?.[p2]) continue;

    return r.id;
  }
  return undefined;
};

/**
 * CORE ROOM DETERMINATION LOGIC
 * Strict Rule: Only Single Resource subjects use labs/special rooms.
 * All other subjects are locked to the Class Homeroom.
 */
const determineRoom = (
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: SchedulerState,
  data: AppData,
  taken: Set<string>
): string | undefined => {
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  const homeroomId = unit.defaultRoomId;

  // RULE 1: If NOT a Single Resource subject, it is LOCKED to the Homeroom.
  if (!subject?.isSingleResource) {
    if (!homeroomId) return undefined;

    // Check if Homeroom is free
    if (state.roomOccupancy[homeroomId]?.[d]?.[p]) return undefined;
    if (unit.duration === 2 && state.roomOccupancy[homeroomId]?.[d]?.[p2])
      return undefined;
    if (taken.has(homeroomId)) return undefined;

    return homeroomId;
  }

  // RULE 2: Single Resource subjects (Labs)
  if (subject.isSingleResource) {
    // A. Hard Requirement (Computer Lab, etc)
    if (unit.requiredRoomType) {
      return findRoomFromPool(
        d,
        p,
        p2,
        unit,
        state,
        data,
        taken,
        (r) => r.type === unit.requiredRoomType
      );
    }
    // B. Fallback to Homeroom if no specific lab is assigned/available
    return homeroomId;
  }

  return undefined;
};

/**
 * MAIN SMART SOLVER
 */
export const solveSmart = (units: AllocationUnit[], data: AppData) => {
  const state = initializeState(data); // state.ts now handles the sizing correctly
  const conflicts: Conflict[] = [];
  const processedIds = new Set<string>();

  // FIX 1: Determine the loop limit based on the Max Class Period
  const globalPeriods = data.settings.periodsPerDay;
  const maxClassPeriods = Math.max(...data.classes.map(c => c.periodCount || 0));
  const loopMaxPeriods = Math.max(globalPeriods, maxClassPeriods);
  const days = (data.settings as any).daysPerWeek || 5;

  // Iterative Greedy Loop
  for (const unit of units) {
    if (processedIds.has(unit.id)) continue;

    // GROUPING: Identify Elective Gangs or Joint Groups
    // A Joint Class is one unit with multiple ClassIDs.
    // An Elective Block is a "Gang" of multiple units.
    const isGang = !!unit.electiveBlockId;
    const gangUnits = isGang
      ? units.filter((u) => u.electiveBlockId === unit.electiveBlockId)
      : [unit];

    gangUnits.forEach((u) => processedIds.add(u.id));

    let bestSlot: {
      d: number;
      p: number;
      p2: number;
      rooms: Record<string, string>;
    } | null = null;
    let bestScore = -Infinity;

    // SEARCH SPACE
    for (let d = 0; d < days; d++) {
      // FIX: Loop up to loopMaxPeriods instead of just global periods
      for (let p = 0; p < loopMaxPeriods; p++) {
        let gangValid = true;
        let p2 = -1;

        // Validation for Period Existence
        // We check the specific class structure. If this class only has 8 periods,
        // we shouldn't try to schedule it at period 9 (even if another class goes to 10).
        const firstClassId = gangUnits[0].classIds[0];
        const firstClass = data.classes.find((c) => c.id === firstClassId);
        const classLimit = Math.max(firstClass?.periodCount || 0, globalPeriods);
        
        if (p >= classLimit) continue; // Skip if this period doesn't exist for this class

        const struct = firstClass?.structure || data.settings.dayStructure;
        if (getPeriodType(struct, p) !== "CLASS") continue;

        // Calculate second slot for double periods
        if (gangUnits[0].duration === 2) {
          const next = getNextClassPeriod(p, struct, loopMaxPeriods); // Pass max limit
          if (next === null || next >= classLimit) continue;
          p2 = next;
        }

        const currentRoomAssignments: Record<string, string> = {};
        const takenInThisSearch = new Set<string>();

        // VALIDATE EVERY UNIT IN THE GANG (or the single Joint Unit)
        for (const u of gangUnits) {
          const involvedClasses = u.classIds.map((cid) =>
            data.classes.find((c) => c.id === cid)
          );

          // 1. Constraint Check (Teacher, Class, Load, Global Blocks)
          if (
            !checkHardConstraints(state, data, d, p, p2, u, involvedClasses)
          ) {
            gangValid = false;
            break;
          }

          // 2. Room Determination (Homeroom Logic)
          const rId = determineRoom(
            d,
            p,
            p2,
            u,
            state,
            data,
            takenInThisSearch
          );

          // Fail if room is required but none available
          if (!rId && (u.requiredRoomType || u.preferredRoomIds?.length)) {
            gangValid = false;
            break;
          }
          // Fail if homeroom is busy
          if (!rId && u.defaultRoomId) {
            gangValid = false;
            break;
          }

          if (rId) {
            takenInThisSearch.add(rId);
            currentRoomAssignments[u.id] = rId;
          }
        }

        if (gangValid) {
          const score = calculateScore(d, p, gangUnits[0], data);
          if (score > bestScore) {
            bestScore = score;
            bestSlot = { d, p, p2, rooms: currentRoomAssignments };
          }
        }
      }
    }

    // --- COMMIT BEST SLOT TO STATE ---
    if (bestSlot) {
      const { d, p, p2, rooms } = bestSlot;
      const teachersProcessedInSlot = new Set<string>();

      gangUnits.forEach((u) => {
        // A. Apply to Class Schedules (Syncs Joint Classes)
        u.classIds.forEach((cid) => {
          if (!state.schedule[cid][d]) state.schedule[cid][d] = {};
          const roomId = rooms[u.id];

          state.schedule[cid][d][p] = {
            subjectId: u.subjectId,
            teacherId: u.teacherIds[0],
            classId: cid,
            roomId,
            electiveBlockId: u.electiveBlockId,
            isFixed: false,
          };
          state.classOccupancy[cid][d][p] = true;
          state.classDailySubjects[cid][d].add(u.subjectId);

          if (u.duration === 2 && p2 !== -1) {
            state.schedule[cid][d][p2] = {
              ...state.schedule[cid][d][p],
              isFixed: true,
            };
            state.classOccupancy[cid][d][p2] = true;
          }
        });

        // B. Update Teacher Availability & Load
        u.teacherIds.forEach((tid) => {
          // IMPORTANT: Only increment load once per slot even if multiple classes (Joint) are involved
          if (!teachersProcessedInSlot.has(tid)) {
            state.teacherOccupancy[tid][d][p] = true;
            state.teacherDailyLoad[tid][d]++;

            if (u.duration === 2 && p2 !== -1) {
              state.teacherOccupancy[tid][d][p2] = true;
              state.teacherDailyLoad[tid][d]++;
            }
            teachersProcessedInSlot.add(tid);
          }
        });

        // C. Update Resource Usage (Single Resource Subjects)
        if (state.singleResourceUsage[u.subjectId]) {
          state.singleResourceUsage[u.subjectId][d][p] = true;
          if (u.duration === 2)
            state.singleResourceUsage[u.subjectId][d][p2] = true;
        }

        // D. Update Room Occupancy
        const rid = rooms[u.id];
        if (rid) {
          state.roomOccupancy[rid][d][p] = true;
          if (u.duration === 2) state.roomOccupancy[rid][d][p2] = true;
        }
      });
    } else {
      // LOG CONFLICT ON FAILURE
      gangUnits.forEach((u) => {
        conflicts.push({
          classId: u.classIds.join(","),
          className: u.classNames.join(","),
          subjectId: u.subjectId,
          subjectName: u.subjectName,
          teacherName: u.teacherNames.join(","),
          day: -1,
          period: -1,
          reason: "No valid slot found (Constraints/Room/Load)",
          severity: "HIGH",
        });
      });
    }
  }

  return { schedule: state.schedule, conflicts };
};
