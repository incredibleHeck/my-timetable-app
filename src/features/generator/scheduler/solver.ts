import { AppData, Conflict } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { initializeState } from "./state";
import { checkHardConstraints } from "./constraints"; // Your optimized version
import { calculateScore } from "./scoring"; // Your LCV version
import { getNextClassPeriod, getPeriodType } from "./utils"; // Helper I assume you have

export const solveSmart = (units: AllocationUnit[], data: AppData) => {
  const state = initializeState(data);
  const conflicts: Conflict[] = [];

  // Track processed IDs to handle Gangs/Joint Classes
  const processedIds = new Set<string>();

  const globalPeriods = data.settings.periodsPerDay;
  const days = (data.settings as any).daysPerWeek || 5;

  // The Loop
  for (const unit of units) {
    if (processedIds.has(unit.id)) continue;

    // A. Identify "Gang" (Electives or Joint Classes)
    const isGang = !!unit.electiveBlockId || !!unit.jointClassId;
    let gangUnits = [unit];

    if (isGang) {
      if (unit.electiveBlockId) {
        gangUnits = units.filter(
          (u) => u.electiveBlockId === unit.electiveBlockId
        );
      } else if (unit.jointClassId) {
        gangUnits = units.filter((u) => u.jointClassId === unit.jointClassId);
      }
    }

    // Mark all as processed so we don't schedule them again individually
    gangUnits.forEach((u) => processedIds.add(u.id));

    // B. Find Valid Moves
    let validMoves: Array<{
      d: number;
      p: number;
      p2: number;
      score: number;
      rooms: Record<string, string>;
    }> = [];

    for (let d = 0; d < days; d++) {
      for (let p = 0; p < globalPeriods; p++) {
        // 1. Structure Check
        const struct = data.settings.dayStructure; // Simplified
        if (getPeriodType(struct, p) !== "CLASS") continue;

        // 2. Duration Check
        let p2 = -1;
        if (unit.duration === 2) {
          const next = getNextClassPeriod(p, struct, globalPeriods);
          if (next === null) continue; // Ends of day
          p2 = next;
        }

        // 3. Gang Feasibility Check (Hard Constraints)
        let gangValid = true;
        const currentRooms: Record<string, string> = {};

        // We must find a valid slot for EVERY member of the gang at this specific (d, p)
        for (const u of gangUnits) {
          // Fetch class object for structure checks
          const involvedClasses = u.classIds.map((cid) =>
            data.classes.find((c) => c.id === cid)
          );

          // HARD CONSTRAINT CHECK
          if (
            !checkHardConstraints(state, data, d, p, p2, u, involvedClasses)
          ) {
            gangValid = false;
            break;
          }

          // ROOM ASSIGNMENT
          // Logic: If requiredRoomType, find one. If Homeroom, check occupancy.
          const rId = determineRoom(d, p, p2, u, state, data);
          if (!rId) {
            gangValid = false;
            break;
          }
          currentRooms[u.id] = rId;
        }

        if (gangValid) {
          // 4. Scoring (Soft Constraints)
          // Score based on the primary unit (or average of gang)
          const score = calculateScore(state, data, d, p, unit);
          validMoves.push({ d, p, p2, score, rooms: currentRooms });
        }
      }
    }

    // C. Pick Best Move
    if (validMoves.length > 0) {
      // Sort High to Low
      validMoves.sort((a, b) => b.score - a.score);

      // Pick top (Greedy Best-First)
      const best = validMoves[0];

      // Apply to State
      applyGangToState(state, gangUnits, best);
    } else {
      // RECORD CONFLICT
      conflicts.push({
        classId: unit.classIds.join(", "),
        className: unit.classNames.join(", "),
        subjectId: unit.subjectId,
        subjectName: unit.subjectName,
        teacherName: unit.teacherNames.join(", "),
        day: -1,
        period: -1,
        reason: "No valid slot found (Constraint Lock)",
        severity: "HIGH",
      });
    }
  }

  return { schedule: state.schedule, conflicts };
};

/**
 * DETERMINES THE ROOM FOR AN ALLOCATION UNIT
 * Hierarchy: 
 * 1. Subject.requiredRoomId (Shared Lab/Studio)
 * 2. ClassGroup.defaultRoomId (Home Classroom)
 */
function determineRoom(
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: SchedulerState,
  data: AppData
): string | undefined {
  const subject = data.subjects.find((s) => s.id === unit.subjectId);
  // Get the first class in the gang (usually only 1 for standard lessons)
  const classGroup = data.classes.find((c) => c.id === unit.classIds[0]);

  if (!subject || !classGroup) return undefined;

  // --- STEP 1: PRIORITIZE SUBJECT-SPECIFIC ROOMS ---
  // Scenario B: ICT is assigned to 'Computer Lab'
  const subjectRequiredRoomId = subject.requiredRoomId;

  if (subjectRequiredRoomId) {
    // Check if the lab is already occupied at this time
    const isOccupied = state.roomOccupancy[subjectRequiredRoomId]?.[d]?.[p] ||
                      (unit.duration === 2 && state.roomOccupancy[subjectRequiredRoomId]?.[d]?.[p2]);

    if (isOccupied) return undefined; // Lab is busy; solver must try another time slot
    return subjectRequiredRoomId;
  }

  // --- STEP 2: FALLBACK TO HOME CLASSROOM ---
  // Scenario A: Math has no room; fall back to 'Room 1A' or 'Room 1B'
  const homeRoomId = classGroup.defaultRoomId;

  if (homeRoomId) {
    const isOccupied = state.roomOccupancy[homeRoomId]?.[d]?.[p] ||
                      (unit.duration === 2 && state.roomOccupancy[homeRoomId]?.[d]?.[p2]);

    if (isOccupied) return undefined; // Home room is busy
    return homeRoomId;
  }

  return undefined;
}

function applyGangToState(
  state: SchedulerState,
  gang: AllocationUnit[],
  move: { d: number; p: number; p2: number; rooms: Record<string, string> }
) {
  const { d, p, p2, rooms } = move;

  gang.forEach((u) => {
    const roomId = rooms[u.id];

    // 1. Update Class Schedule & Occupancy
    u.classIds.forEach((cid) => {
      // Init if missing
      if (!state.schedule[cid][d]) state.schedule[cid][d] = {};

      const entry = {
        subjectId: u.subjectId,
        teacherId: u.teacherIds[0], // Simplified
        classId: cid,
        roomId: roomId,
        electiveBlockId: u.electiveBlockId,
        isFixed: false,
      };

      state.schedule[cid][d][p] = entry;
      state.classOccupancy[cid][d][p] = true;
      state.classDailySubjects[cid][d].add(u.subjectId);

      if (u.duration === 2) {
        state.schedule[cid][d][p2] = { ...entry, isFixed: true }; // Tail
        state.classOccupancy[cid][d][p2] = true;
      }
    });

    // 2. Update Teacher Occupancy & Load
    u.teacherIds.forEach((tid) => {
      state.teacherOccupancy[tid][d][p] = true;
      state.teacherDailyLoad[tid][d]++;
      if (u.duration === 2) {
        state.teacherOccupancy[tid][d][p2] = true;
        state.teacherDailyLoad[tid][d]++;
      }
    });

    // 3. Update Room Occupancy
    if (roomId) {
      state.roomOccupancy[roomId][d][p] = true;
      if (u.duration === 2) state.roomOccupancy[roomId][d][p2] = true;
    }

    // 4. Update Single Resource Usage
    // (Used to prevent 2 Science classes at once even if rooms differ, if strict)
    if (state.singleResourceUsage[u.subjectId]) {
      state.singleResourceUsage[u.subjectId][d][p] = true;
      if (u.duration === 2)
        state.singleResourceUsage[u.subjectId][d][p2] = true;
    }
  });
}
