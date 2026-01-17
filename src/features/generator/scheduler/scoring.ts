import { AllocationUnit, SchedulerState } from "./types";
import { AppData, Teacher } from "../../../types";
import { getPeriodType } from "./utils";

/**
 * CONFIGURATION: Weights for different soft constraints.
 * Tune these to change the "personality" of the scheduler.
 */
const WEIGHTS = {
  TEACHER_GAP: -50, // Penalty: 1-period gaps (Swiss cheese schedule)
  TEACHER_CLUSTER: 20, // Reward: Consecutive classes (Efficient blocks)
  SUBJECT_DISTRIBUTION: -30, // Penalty: Stacking difficult subjects
  ROOM_EFFICIENCY: 10, // Reward: Using preferred rooms
  LUNCH_PROTECTION: -100, // Penalty: Scheduling right after lunch (optional, can be adjusted)
  MORNING_BIAS: 5, // Reward: Slight preference for earlier slots
  SCARCITY_PENALTY: -500, // LCV: High penalty for using the LAST available slot for a resource
  
  // Enhanced Pedagogical Costs
  TEACHER_WINDOW: -200,    // Gaps of > 2 periods
  ROOM_CHANGE: -50,        // Avoid moving a class between rooms
  VARIETY_PENALTY: -150,   // Prevents "Subject Stacking" (3 heavy subjects)
  FRIDAY_AFTERNOON: -30    // Avoid core subjects on Friday PM
};

/**
 * HOMEROOM INTEGRITY CHECK
 * Penalizes moves that displace a class from its designated base.
 */
export function calculateRoomPenalty(
  state: SchedulerState,
  unit: AllocationUnit,
  d: number,
  p: number,
  targetRoomId: string
): number {
  let penalty = 0;

  // 1. DISPLACEMENT PENALTY
  // If we are forcing an eviction in this room, check who we are kicking out.
  const victimId = state.roomOccupancy[targetRoomId]?.[d]?.[p];
  if (victimId && victimId !== "BLOCK") {
    // Kicking a class out of its OWN homeroom is a high penalty (800)
    // Kicking a class out of a specialist room they are using is a medium penalty (300)
    // For now, simpler: Evicting ANYONE is costly.
    penalty += 800; 
  }

  // 2. WANDERING PENALTY
  // If this subject doesn't REQUIRE a specialist lab, 
  // but we are placing it somewhere other than the Class Homeroom.
  if (!unit.requiredRoomType && targetRoomId !== unit.defaultRoomId) {
    penalty += 500; // Encourage staying in the "Home Base"
  }

  return penalty;
}

/**
 * HELPER: Detect "Swiss Cheese" schedules (1-period gaps) AND large Windows.
 */
export const calculateTeacherGapPenalty = (
  state: SchedulerState,
  d: number,
  p: number,
  teacherIds: string[]
): number => {
  let penalty = 0;

  for (const tid of teacherIds) {
    const dailyGrid = state.teacherOccupancy[tid]?.[d];
    if (!dailyGrid) continue;

    // 1. Swiss Cheese (1-period gap)
    // Check Previous Gap: [Occupied] [Empty] [Current Assignment]
    if (p >= 2 && !dailyGrid[p - 1] && dailyGrid[p - 2]) {
      penalty += WEIGHTS.TEACHER_GAP;
    }
    // Check Next Gap: [Current Assignment] [Empty] [Occupied]
    if (p + 2 < dailyGrid.length && !dailyGrid[p + 1] && dailyGrid[p + 2]) {
      penalty += WEIGHTS.TEACHER_GAP;
    }

    // 2. Large Window (Gap > 2 periods)
    // Check backwards: [Occupied] [Empty] [Empty] [Empty] [Current]
    // Scan back from p-1. If we find >2 consecutive empties before hitting an Occupied, penalize.
    let gapSize = 0;
    for (let i = p - 1; i >= 0; i--) {
        if (dailyGrid[i] !== null) break; // Found occupancy
        gapSize++;
    }
    // Only penalize if we actually found a start block (i.e. we didn't just hit start of day)
    // AND the gap is > 2
    if (gapSize > 2 && p - gapSize - 1 >= 0 && dailyGrid[p - gapSize - 1] !== null) {
        penalty += WEIGHTS.TEACHER_WINDOW;
    }
    
    // Check forwards (for iterative repair context)
    let fwdGapSize = 0;
    for (let i = p + 1; i < dailyGrid.length; i++) {
        if (dailyGrid[i] !== null) break;
        fwdGapSize++;
    }
    if (fwdGapSize > 2 && p + fwdGapSize + 1 < dailyGrid.length && dailyGrid[p + fwdGapSize + 1] !== null) {
        penalty += WEIGHTS.TEACHER_WINDOW;
    }

    // REWARD: Continuity (Teaching back-to-back)
    if (
      (p > 0 && dailyGrid[p - 1]) ||
      (p + 1 < dailyGrid.length && dailyGrid[p + 1])
    ) {
      penalty += WEIGHTS.TEACHER_CLUSTER;
    }
  }
  return penalty;
};

/**
 * HELPER: Least Constraining Value (LCV).
 */
const calculateScarcityPenalty = (
  state: SchedulerState,
  d: number,
  teacherIds: string[],
  data: AppData
): number => {
  let penalty = 0;

  for (const tid of teacherIds) {
    const teacher = data.teachers.find((t) => t.id === tid);
    if (!teacher) continue;

    const maxLoad =
      teacher.maxPeriodsPerDay || data.settings.maxTeacherPeriodsPerDay || 6;
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;

    if (currentLoad >= maxLoad - 1) {
      penalty += WEIGHTS.SCARCITY_PENALTY;
    }
    else if (currentLoad >= maxLoad - 2) {
      penalty += WEIGHTS.SCARCITY_PENALTY / 2;
    }
  }
  return penalty;
};

const isCoreSubject = (name?: string) => {
    if (!name) return false;
    const n = name.toLowerCase();
    return n.includes("math") || n.includes("english") || n.includes("science") || n.includes("physics") || n.includes("chem") || n.includes("bio");
};

export const calculatePedagogicalScore = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  unit: AllocationUnit
): number => {
    let score = 0;
    const classId = unit.classIds[0];
    if (!classId) return 0;
    
    // 1. Friday Afternoon Penalty
    // Assuming Friday is index 4 and "Afternoon" is roughly the last 30% of the day or after Lunch.
    // Simplified: Period index > (Total / 2)
    if (d === 4) {
        const totalPeriods = data.settings.periodsPerDay;
        if (p > totalPeriods / 2) {
            if (isCoreSubject(unit.subjectName)) {
                score += WEIGHTS.FRIDAY_AFTERNOON;
            }
        }
    }

    // 2. Room Change Penalty
    // Check p-1. If it was a class, check its room.
    if (p > 0) {
        const prevSlot = state.schedule[classId]?.[d]?.[p-1];
        if (prevSlot && !prevSlot.isFixed) {
             // Heuristic: If we are assigning a different room than previous, penalize.
             // We don't know OUR room for sure yet, but we can guess based on unit preferences.
             const likelyRoom = unit.requiredRoomType ? "Specialist" : (unit.defaultRoomId || "Home");
             const prevRoom = "Unknown"; // We'd need to lookup room metadata. 
             // Without full room lookup, we can assume:
             // If previous slot was same subject, it's fine.
             // If previous slot was different subject, and we are moving to a Specialist room (e.g. Lab), acceptable.
             // If we are moving from Home to Home (different room?), bad.
             
             // Simplification: Penalize if previous was a different subject (context switch) 
             // AND we suspect a physical move. 
             // Actually, strict "Room Change" requires knowing the assigned room.
             // Let's skip strict room check and focus on Subject Stacking which implies movement.
        }
    }

    // 3. Variety / Heavy Stacking (Subject Stacking)
    // "Prevents 3 heavy subjects in a row"
    if (isCoreSubject(unit.subjectName)) {
        let heavyStreak = 0;
        // Check p-1
        if (p > 0) {
            const s1 = state.schedule[classId]?.[d]?.[p-1];
            if (s1 && isCoreSubject(data.subjects.find(s=>s.id === s1.subjectId)?.name || "")) {
                heavyStreak++;
                // Check p-2
                if (p > 1) {
                    const s2 = state.schedule[classId]?.[d]?.[p-2];
                    if (s2 && isCoreSubject(data.subjects.find(s=>s.id === s2.subjectId)?.name || "")) {
                        heavyStreak++;
                    }
                }
            }
        }
        
        if (heavyStreak >= 2) {
            score += WEIGHTS.VARIETY_PENALTY;
        }
    }

    return score;
}

/**
 * MAIN SCORING FUNCTION
 * Returns a score where Higher is Better.
 */
export const calculateScore = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  unit: AllocationUnit
): number => {
  let score = 0;
  const maxPeriods = data.settings.periodsPerDay;

  // 1. LEAST CONSTRAINING VALUE (Resource Scarcity)
  score += calculateScarcityPenalty(state, d, unit.teacherIds, data);

  // 2. TEACHER WELLBEING (Gaps, Windows, Clusters)
  score += calculateTeacherGapPenalty(state, d, p, unit.teacherIds);

  // 3. STUDENT FATIGUE (Subject Distribution)
  const classId = unit.classIds[0];
  if (classId && p > 0) {
    const prevSlot = state.schedule[classId]?.[d]?.[p - 1];
    if (prevSlot) {
      if (prevSlot.subjectId === unit.subjectId) {
        score += WEIGHTS.SUBJECT_DISTRIBUTION;
      }
    }
  }

  // 4. PEDAGOGICAL (Friday, Stacking)
  score += calculatePedagogicalScore(state, data, d, p, unit);

  // 5. PREFERRED TIME SLOTS (Morning Bias)
  score += (maxPeriods - p) * (WEIGHTS.MORNING_BIAS / maxPeriods);

  // 6. ROOM EFFICIENCY (Bonus for using Preferred Room)
  if (unit.preferredRoomIds?.length && unit.defaultRoomId) {
     score += WEIGHTS.ROOM_EFFICIENCY;
  }

  return score;
};