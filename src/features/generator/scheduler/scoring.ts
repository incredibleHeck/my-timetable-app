import { AllocationUnit, SchedulerState } from "./types";
import { AppData, Teacher } from "../../../types";

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
};

/**
 * HELPER: Detect "Swiss Cheese" schedules (1-period gaps).
 * Returns a negative score if the placement creates an awkward gap.
 */
const calculateTeacherGapPenalty = (
  state: SchedulerState,
  d: number,
  p: number,
  teacherIds: string[]
): number => {
  let penalty = 0;

  for (const tid of teacherIds) {
    const dailyGrid = state.teacherOccupancy[tid]?.[d];
    if (!dailyGrid) continue;

    // Check Previous Gap: [Occupied] [Empty] [Current Assignment]
    // If p-2 is occupied and p-1 is empty, placing at p creates a gap at p-1.
    if (p >= 2 && !dailyGrid[p - 1] && dailyGrid[p - 2]) {
      penalty += WEIGHTS.TEACHER_GAP;
    }

    // Check Next Gap: [Current Assignment] [Empty] [Occupied]
    // (Requires looking ahead at existing assignments - useful for iterative repair)
    if (p + 2 < dailyGrid.length && !dailyGrid[p + 1] && dailyGrid[p + 2]) {
      penalty += WEIGHTS.TEACHER_GAP;
    }

    // REWARD: Continuity (Teaching back-to-back)
    // If p-1 is occupied, this is a good block.
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
 * Calculates how "expensive" it is to use a slot for a teacher.
 * If a teacher only has 2 slots left, using one is VERY expensive.
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

    // LCV LOGIC:
    // If we are 1 slot away from maxing out, Panic!
    if (currentLoad >= maxLoad - 1) {
      penalty += WEIGHTS.SCARCITY_PENALTY;
    }
    // If we are reaching saturation, mild penalty
    else if (currentLoad >= maxLoad - 2) {
      penalty += WEIGHTS.SCARCITY_PENALTY / 2;
    }
  }
  return penalty;
};

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

  // ----------------------------------------------------------
  // 1. LEAST CONSTRAINING VALUE (Resource Scarcity)
  // ----------------------------------------------------------
  score += calculateScarcityPenalty(state, d, unit.teacherIds, data);

  // ----------------------------------------------------------
  // 2. TEACHER WELLBEING (Gaps & Clusters)
  // ----------------------------------------------------------
  score += calculateTeacherGapPenalty(state, d, p, unit.teacherIds);

  // ----------------------------------------------------------
  // 3. STUDENT FATIGUE (Subject Distribution)
  // ----------------------------------------------------------
  // Avoid placing the same subject twice in a row (unless it's a double block)
  // This helps spread the cognitive load.
  const classId = unit.classIds[0];
  if (classId && p > 0) {
    const prevSlot = state.schedule[classId]?.[d]?.[p - 1];
    if (prevSlot) {
      // If previous slot is the same subject (and not part of this double block unit), penalize
      // Note: Heuristics handles the Double Block continuity naturally, this is for separate singles.
      if (prevSlot.subjectId === unit.subjectId) {
        score += WEIGHTS.SUBJECT_DISTRIBUTION;
      }
    }
  }

  // ----------------------------------------------------------
  // 4. PREFERRED TIME SLOTS (Morning Bias)
  // ----------------------------------------------------------
  // Linear decay: Period 0 gets max points, Period 11 gets 0.
  // This gently pushes "harder" subjects (which are sorted first) to the morning.
  score += (maxPeriods - p) * (WEIGHTS.MORNING_BIAS / maxPeriods);

  // ----------------------------------------------------------
  // 5. ROOM EFFICIENCY
  // ----------------------------------------------------------
  // If we found a preferred room, give a small bonus
  if (unit.preferredRoomIds?.length && unit.defaultRoomId) {
    // Logic handled in solver selection, but we can reward here if room is passed in context.
    // (Simplified for now)
  }

  // ----------------------------------------------------------
  // 6. DETERMINISTIC TIE-BREAKER
  // ----------------------------------------------------------
  // Instead of Math.random(), we use a deterministic hash of IDs to break ties consistency.
  // This aids debugging.
  // (Optional: Re-add Math.random() ONLY if you want non-deterministic solving in the worker loop)
  // score += Math.random();

  return score;
};
