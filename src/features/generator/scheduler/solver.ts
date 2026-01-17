import { AppData, Conflict } from "../../../types";
import { AllocationUnit } from "./types";
import { initializeState } from "./state";
import { checkHardConstraints } from "./constraints";
import { getPeriodType, getNextClassPeriod } from "./utils";

// --- SCORING HELPER ---
const calculateScore = (
  d: number,
  p: number,
  unit: AllocationUnit,
  data: AppData
): number => {
  let score = 0;
  // Morning Bias
  const maxPeriods = data.settings.periodsPerDay;
  if (p < maxPeriods / 2) score += 10;

  // Random noise to prevent "striped" patterns
  score += Math.random() * 2;
  return score;
};

// --- FIND ROOM HELPER ---
const findRoom = (
  d: number,
  p: number,
  p2: number,
  unit: AllocationUnit,
  state: any,
  data: AppData,
  taken: Set<string>
): string | undefined => {
  if (!data.rooms || data.rooms.length === 0) return undefined;

  // Filter rooms by type/preference
  const validRooms = data.rooms.filter((r) => {
    if (taken.has(r.id)) return false;
    if (unit.requiredRoomType && r.type !== unit.requiredRoomType) return false;
    if (unit.preferredRoomIds?.length && !unit.preferredRoomIds.includes(r.id))
      return false;
    // Check Occupancy
    if (state.roomOccupancy[r.id][d][p]) return false;
    if (unit.duration === 2 && state.roomOccupancy[r.id][d][p2]) return false;
    // Capacity
    const maxStudents = Math.max(
      ...unit.classIds.map(
        (cid) => data.classes.find((c) => c.id === cid)?.studentCount || 0
      )
    );
    if (maxStudents > r.capacity) return false;
    return true;
  });

  // Heuristic: Pick smallest room that fits (save big rooms)
  validRooms.sort((a, b) => a.capacity - b.capacity);
  return validRooms[0]?.id;
};

// --- MAIN FUNCTION ---
export const solveSmart = (units: AllocationUnit[], data: AppData) => {
  const state = initializeState(data);
  const conflicts: Conflict[] = [];

  // Process "Gangs" (Elective Blocks / Joints) together
  const processedIds = new Set<string>();

  for (const unit of units) {
    if (processedIds.has(unit.id)) continue;

    const isGang = !!unit.electiveBlockId || unit.classIds.length > 1; // Treat Joint as Gang
    const gangUnits = isGang
      ? units.filter(
          (u) =>
            (u.electiveBlockId && u.electiveBlockId === unit.electiveBlockId) ||
            u.id === unit.id
        )
      : [unit];

    gangUnits.forEach((u) => processedIds.add(u.id));

    // --- FIND SLOT ---
    let bestSlot: {
      d: number;
      p: number;
      p2: number;
      rooms: Record<string, string>;
    } | null = null;
    let bestScore = -Infinity;

    const days = (data.settings as any).daysPerWeek || 5;
    const periods = data.settings.periodsPerDay;

    // Try every day/period
    for (let d = 0; d < days; d++) {
      for (let p = 0; p < periods; p++) {
        // 1. Structure Check for Gang
        let gangValid = true;
        let p2 = -1;

        // Calculate P2 based on first unit (assuming alignment)
        const firstClass = data.classes.find(
          (c) => c.id === gangUnits[0].classIds[0]
        );
        const struct = firstClass?.structure || data.settings.dayStructure;
        if (getPeriodType(struct, p) !== "CLASS") continue;

        if (gangUnits[0].duration === 2) {
          const next = getNextClassPeriod(p, struct, periods);
          if (next === null) continue;
          p2 = next;
        }

        // 2. Constraints & Rooms
        const currentRooms: Record<string, string> = {};
        const takenRooms = new Set<string>();

        for (const u of gangUnits) {
          const classes = u.classIds.map((cid) =>
            data.classes.find((c) => c.id === cid)
          );

          // Check Hard Constraints
          if (!checkHardConstraints(state, data, d, p, p2, u, classes)) {
            gangValid = false;
            break;
          }

          // Check Room
          const rId = findRoom(d, p, p2, u, state, data, takenRooms);
          if (!rId && (u.requiredRoomType || u.preferredRoomIds?.length)) {
            gangValid = false;
            break;
          }
          if (rId) {
            takenRooms.add(rId);
            currentRooms[u.id] = rId;
          }
        }

        if (gangValid) {
          const score = calculateScore(d, p, gangUnits[0], data);
          if (score > bestScore) {
            bestScore = score;
            bestSlot = { d, p, p2, rooms: currentRooms };
          }
        }
      }
    }

    // --- COMMIT OR FAIL ---
    if (bestSlot) {
      const { d, p, p2, rooms } = bestSlot;

      gangUnits.forEach((u) => {
        u.classIds.forEach((cid) => {
          // Update Schedule
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

        // Update Resources
        u.teacherIds.forEach((tid) => {
          state.teacherOccupancy[tid][d][p] = true;
          state.teacherDailyLoad[tid][d]++;
          if (u.duration === 2 && p2 !== -1) {
            state.teacherOccupancy[tid][d][p2] = true;
            state.teacherDailyLoad[tid][d]++;
          }
        });

        if (state.singleResourceUsage[u.subjectId]) {
          state.singleResourceUsage[u.subjectId][d][p] = true;
          if (u.duration === 2)
            state.singleResourceUsage[u.subjectId][d][p2] = true;
        }

        const rid = rooms[u.id];
        if (rid) {
          state.roomOccupancy[rid][d][p] = true;
          if (u.duration === 2) state.roomOccupancy[rid][d][p2] = true;
        }
      });
    } else {
      // Log Conflict
      gangUnits.forEach((u) => {
        conflicts.push({
          classId: u.classIds.join(","),
          className: u.classNames.join(","),
          subjectId: u.subjectId,
          subjectName: u.subjectName,
          teacherName: u.teacherNames.join(","),
          day: -1,
          period: -1,
          reason: "No valid slot found",
          severity: "HIGH",
        });
      });
    }
  }

  return { schedule: state.schedule, conflicts };
};
