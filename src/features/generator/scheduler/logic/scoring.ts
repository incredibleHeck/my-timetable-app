import { AllocationUnit, SchedulerState } from "../core/types";
import { AppData, Subject, Teacher } from "../../../../types";
import { getPrevClassPeriod, getDaysPerWeek } from "../utils/utils";
import {
  SCORING_WEIGHTS,
  ScoringWeightKey,
  ROOM_PENALTY_DISPLACEMENT,
  ROOM_PENALTY_WANDERING,
} from "../constants";

type ScoringWeights = Record<ScoringWeightKey, number>;

function resolveWeights(data: AppData): ScoringWeights {
  return { ...SCORING_WEIGHTS, ...data.settings.scoringWeightOverrides };
}

/**
 * RANK 10: WEEKLY BALANCE (The Final Polish)
 * Ensures that core subjects are distributed evenly across the week.
 * If Monday already has 3 core subjects, we prefer placing the 4th on Tuesday.
 */
export function calculateWeeklyBalance(
  state: SchedulerState,
  classId: string,
  d: number,
  isCore?: boolean,
  weights: ScoringWeights = SCORING_WEIGHTS,
): number {
  if (!isCore) return 0;

  let dayCoreCount = 0;
  const daySched = state.schedule[classId]?.[d];
  if (daySched) {
    Object.values(daySched).forEach((slot) => {
      if (slot.isCore) dayCoreCount++;
    });
  }

  // Heuristic: If day already has > 3 core periods, penalize slightly to nudge towards other days.
  if (dayCoreCount >= 3) {
    return weights.WEEKLY_UNBALANCE * (dayCoreCount - 2);
  }

  return 0;
}

/**
 * TEACHER LOAD BALANCE
 * Ensures teachers don't have too many lessons on one day if they could be spread out.
 */
export function calculateTeacherLoadBalance(
  state: SchedulerState,
  teacherId: string,
  d: number,
  weights: ScoringWeights = SCORING_WEIGHTS,
): number {
  const dailyLoad = state.teacherDailyLoad[teacherId]?.[d] || 0;
  if (dailyLoad >= 2) {
    return weights.TEACHER_LOAD_EXPONENT * Math.pow(2, dailyLoad - 2);
  }
  return 0;
}

/** Penalize uneven teacher load across the week (variance of daily period counts). */
export function calculateTeacherWeeklyVariance(
  state: SchedulerState,
  teacherId: string,
  targetDay: number,
  daysPerWeek: number,
  weights: ScoringWeights = SCORING_WEIGHTS,
): number {
  const loads: number[] = [];
  for (let d = 0; d < daysPerWeek; d++) {
    const load = (state.teacherDailyLoad[teacherId]?.[d] || 0) + (d === targetDay ? 1 : 0);
    loads.push(load);
  }

  const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
  const variance = loads.reduce((sum, value) => sum + (value - mean) ** 2, 0) / loads.length;

  if (variance <= 1) return 0;
  return weights.TEACHER_WEEKLY_VARIANCE * variance;
}

/**
 * HOMEROOM INTEGRITY CHECK
 * Returns positive penalty points (to be added to 'cost' in Repair Phase)
 */
export function calculateRoomPenalty(
  state: SchedulerState,
  unit: AllocationUnit,
  d: number,
  p: number,
  targetRoomId: string,
): number {
  let penalty = 0;

  // 1. DISPLACEMENT PENALTY
  const victimId = state.roomOccupancy[targetRoomId]?.[d]?.[p];
  if (victimId && victimId !== "BLOCK") {
    penalty += ROOM_PENALTY_DISPLACEMENT;
  }

  if (!unit.requiredRoomType && unit.defaultRoomId && targetRoomId !== unit.defaultRoomId) {
    penalty += ROOM_PENALTY_WANDERING;
  }

  return penalty;
}

/**
 * 1. SCARCITY (Optimized)
 */
const calculateScarcityPenalty = (
  state: SchedulerState,
  d: number,
  teacherIds: string[],
  data: AppData,
  teacherMap: Map<string, Teacher>,
  weights: ScoringWeights,
): number => {
  let penalty = 0;

  for (const tid of teacherIds) {
    const teacher = teacherMap.get(tid);
    if (!teacher) continue;

    const maxLoad = teacher.maxPeriodsPerDay ?? (data.settings.maxTeacherPeriodsPerDay || 6);
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0;

    if (currentLoad >= maxLoad - 1) {
      penalty += weights.SCARCITY_PENALTY;
    } else if (currentLoad >= maxLoad - 2) {
      penalty += weights.SCARCITY_PENALTY / 2;
    }
  }
  return penalty;
};

/**
 * 2. TEACHER GAPS (Optimized)
 */
export const calculateTeacherGapPenalty = (
  state: SchedulerState,
  d: number,
  p: number,
  teacherIds: string[],
  currentClassIds: string[],
  weights: ScoringWeights = SCORING_WEIGHTS,
): number => {
  let penalty = 0;
  const structure = state.settings?.dayStructure || [];

  for (const tid of teacherIds) {
    const dailyGrid = state.teacherOccupancy[tid]?.[d];
    if (!dailyGrid) continue;

    const prevInstructionalP = getPrevClassPeriod(p, structure);

    // Gap Detection
    if (prevInstructionalP !== null && !dailyGrid[prevInstructionalP]) {
      const sourceP = getPrevClassPeriod(prevInstructionalP, structure);
      if (sourceP !== null) {
        const prevUnitId = dailyGrid[sourceP];
        if (prevUnitId && prevUnitId !== "BLOCK") {
          // Heuristic: Only penalize if the gap fragments the same class group
          const cid = currentClassIds[0];
          if (cid && state.classOccupancy[cid]?.[d]?.[sourceP] === prevUnitId) {
            penalty += weights.TEACHER_GAP;
          }
        }
      }
    }

    // Clustering Penalty (Discourage long consecutive blocks)
    if (prevInstructionalP !== null && dailyGrid[prevInstructionalP]) {
      let runBefore = 0;
      let i = prevInstructionalP;
      while (i >= 0 && dailyGrid[i]) {
        runBefore++;
        i = getPrevClassPeriod(i, structure) ?? -1;
      }
      // Exponential penalty: 2, 4, 8, 16, 32...
      penalty += weights.TEACHER_CONSECUTIVE * Math.pow(2, runBefore - 1);
    }
  }
  return penalty;
};

/**
 * 3. PEDAGOGICAL (Optimized)
 */
export const calculatePedagogicalScore = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  unit: AllocationUnit,
  weights: ScoringWeights = SCORING_WEIGHTS,
): number => {
  let score = 0;
  const classId = unit.classIds[0];
  if (!classId) return 0;

  // --- RANK 4: HCD PRIME LOADING ---
  if (unit.isCore) {
    const totalPeriods = data.settings.periodsPerDay;
    if (p < totalPeriods / 2) {
      score += weights.HCD_PRIME_BIAS;
    }
  }

  // A. Friday Afternoon (O(1))
  if (d === 4 && unit.isCore) {
    const totalPeriods = data.settings.periodsPerDay;
    if (p > totalPeriods / 2) score += weights.FRIDAY_AFTERNOON;
  }

  // B. Variety / Stacking (O(1))
  if (unit.isCore) {
    let heavyStreak = 0;
    const daySched = state.schedule[classId]?.[d];
    if (daySched) {
      const s1 = daySched[p - 1];
      if (s1 && s1.isCore) {
        heavyStreak++;
        const s2 = daySched[p - 2];
        if (s2 && s2.isCore) {
          heavyStreak++;
        }
      }
    }

    if (heavyStreak >= 2) {
      score += weights.VARIETY_PENALTY;
    }
  }

  return score;
};

/**
 * MAIN SCORING FUNCTION
 */
export const calculateScore = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  unit: AllocationUnit,
  teacherMap: Map<string, Teacher>,
  subjectMap: Map<string, Subject>,
): number => {
  let score = 0;
  const weights = resolveWeights(data);
  const maxPeriods = data.settings.periodsPerDay;
  const classId = unit.classIds[0];
  const daysPerWeek = getDaysPerWeek(data.settings);

  score += calculateScarcityPenalty(state, d, unit.teacherIds, data, teacherMap, weights);
  score += calculateTeacherGapPenalty(state, d, p, unit.teacherIds, unit.classIds, weights);

  // Local Teacher Continuity Check
  if (p > 0) {
    const prevUnitId = state.teacherOccupancy[unit.teacherIds[0]]?.[d]?.[p - 1];
    if (prevUnitId && prevUnitId !== "BLOCK" && prevUnitId !== unit.id) {
      // If previous period was a DIFFERENT unit, check if it was for a DIFFERENT class
      // (Simplified continuity logic for scoring)
      const prevUnit = state.unitPlacements.has(prevUnitId);
      if (prevUnit) {
        // We could add WEIGHTS.TEACHER_CONTINUITY here if we had full unit data,
        // but for now we rely on the Gap check which is more critical.
      }
    }
  }

  // 3. CLASS GAP DETECTION (Student Wellbeing)
  // Logic: If p-2 is occupied by this class, and p-1 is empty, placing at p is a Gap.
  if (classId && p > 1) {
    const structure = state.settings?.dayStructure || [];
    const prevP = getPrevClassPeriod(p, structure);
    if (prevP !== null && !state.classOccupancy[classId]?.[d]?.[prevP]) {
      const sourceP = getPrevClassPeriod(prevP, structure);
      if (sourceP !== null && state.classOccupancy[classId]?.[d]?.[sourceP]) {
        score += weights.CLASS_GAP;
      }
    }
  }

  // 4. STUDENT FATIGUE (Subject Repetition & Continuity)
  if (classId) {
    // A. Immediate Repetition (Avoid stacking same subject)
    const prevSlot = p > 0 ? state.schedule[classId]?.[d]?.[p - 1] : null;
    if (prevSlot && prevSlot.subjectId === unit.subjectId) {
      score += weights.SUBJECT_DISTRIBUTION;
    }

    // --- RANK 5: THE CONNECTORS (Anti-Sandwich Rule) ---
    // Holistic Continuity: Prefer adjacency if subject already exists today.
    if (state.classDailySubjects[classId]?.[d]?.has(unit.subjectId)) {
      const daySched = state.schedule[classId]?.[d];
      if (daySched) {
        let isAdjacent = false;
        const p2 = unit.duration === 2 ? p + 1 : p;

        // Check if we are touching any existing block of this subject
        if (p > 0 && daySched[p - 1]?.subjectId === unit.subjectId) isAdjacent = true;
        if (daySched[p2 + 1]?.subjectId === unit.subjectId) isAdjacent = true;

        if (isAdjacent) {
          score += weights.SUBJECT_ADJACENCY_REWARD;
        } else {
          score += weights.SUBJECT_SPLIT_PENALTY;
        }
      }
    }
  }

  score += calculatePedagogicalScore(state, data, d, p, unit, weights);

  if (classId) {
    score += calculateWeeklyBalance(state, classId, d, unit.isCore, weights);
  }

  unit.teacherIds.forEach((tid) => {
    score += calculateTeacherLoadBalance(state, tid, d, weights);
    score += calculateTeacherWeeklyVariance(state, tid, d, daysPerWeek, weights);
  });

  score += (maxPeriods - p) * (weights.MORNING_BIAS / maxPeriods);

  if (unit.preferredRoomIds?.length && unit.defaultRoomId) {
    score += weights.ROOM_EFFICIENCY;
  }

  return score;
};
