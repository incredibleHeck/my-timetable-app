import { AllocationUnit, SchedulerState } from "./types";
import { AppData, Subject } from "../../../types";
import { getPrevClassPeriod } from "./utils";

/**
 * CONFIGURATION: Weights for different soft constraints.
 * Higher score is better. Penalties are negative.
 */
const WEIGHTS = {
  TEACHER_GAP: -50,
  CLASS_GAP: -400,          // From load-checks.ts
  TEACHER_CONTINUITY: -600,   // From load-checks.ts
  TEACHER_CLUSTER: 20,
  SUBJECT_DISTRIBUTION: -30,
  ROOM_EFFICIENCY: 10,
  LUNCH_PROTECTION: -100,
  MORNING_BIAS: 5,
  SCARCITY_PENALTY: -500,
  TEACHER_WINDOW: -200,
  ROOM_CHANGE: -50,
  VARIETY_PENALTY: -150,
  FRIDAY_AFTERNOON: -30
};

/**
 * HOMEROOM INTEGRITY CHECK
 * Returns positive penalty points (to be added to 'cost' in Repair Phase)
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
  const victimId = state.roomOccupancy[targetRoomId]?.[d]?.[p];
  if (victimId && victimId !== "BLOCK") {
    penalty += 1000; // High cost for evicting someone
  }

  // 2. WANDERING PENALTY
  if (!unit.requiredRoomType && unit.defaultRoomId && targetRoomId !== unit.defaultRoomId) {
    penalty += 500; // Penalty for not using homeroom
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
  teacherMap: Map<string, any>
): number => {
  let penalty = 0;
  
  for (const tid of teacherIds) {
    const teacher = teacherMap.get(tid); 
    if (!teacher) continue;

    const maxLoad = teacher.maxPeriodsPerDay || data.settings.maxTeacherPeriodsPerDay || 6;
    const currentLoad = state.teacherDailyLoad[tid]?.[d] || 0; 

    if (currentLoad >= maxLoad - 1) {
      penalty += WEIGHTS.SCARCITY_PENALTY;
    } else if (currentLoad >= maxLoad - 2) {
      penalty += WEIGHTS.SCARCITY_PENALTY / 2;
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
  currentClassIds: string[]
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
             penalty += WEIGHTS.TEACHER_GAP;
           }
         }
       }
    }

    // Continuity Reward
    if (prevInstructionalP !== null && dailyGrid[prevInstructionalP]) {
      penalty += WEIGHTS.TEACHER_CLUSTER;
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
  unit: AllocationUnit
): number => {
    let score = 0;
    const classId = unit.classIds[0];
    if (!classId) return 0;

    // A. Friday Afternoon (O(1))
    if (d === 4 && unit.isCore) {
       const totalPeriods = data.settings.periodsPerDay;
       if (p > totalPeriods / 2) score += WEIGHTS.FRIDAY_AFTERNOON;
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
            score += WEIGHTS.VARIETY_PENALTY;
        }
    }
    
    return score;
}

/**
 * MAIN SCORING FUNCTION
 */
export const calculateScore = (
  state: SchedulerState,
  data: AppData,
  d: number,
  p: number,
  unit: AllocationUnit,
  teacherMap: Map<string, any>,
  subjectMap: Map<string, any>
): number => {
  let score = 0;
  const maxPeriods = data.settings.periodsPerDay;
  const classId = unit.classIds[0];

  // 1. SCARCITY
  score += calculateScarcityPenalty(state, d, unit.teacherIds, data, teacherMap);

  // 2. TEACHER WELLBEING & CONTINUITY
  score += calculateTeacherGapPenalty(state, d, p, unit.teacherIds, unit.classIds);
  
  // Local Teacher Continuity Check
  if (p > 0) {
      const prevUnitId = state.teacherOccupancy[unit.teacherIds[0]]?.[d]?.[p-1];
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
              score += WEIGHTS.CLASS_GAP; 
          }
      }
  }

  // 4. STUDENT FATIGUE (Subject Repetition & Continuity)
  if (classId) {
    // A. Immediate Repetition (Avoid stacking same subject)
    const prevSlot = p > 0 ? state.schedule[classId]?.[d]?.[p - 1] : null;
    if (prevSlot && prevSlot.subjectId === unit.subjectId) {
        score += WEIGHTS.SUBJECT_DISTRIBUTION;
    }

    // B. Holistic Continuity Reward (Prefer adjacency if subject already exists today)
    if (state.classDailySubjects[classId]?.[d]?.has(unit.subjectId)) {
        const daySched = state.schedule[classId]?.[d];
        if (daySched) {
            let isAdjacent = false;
            const p2 = (unit.duration === 2) ? p + 1 : p; // Approximation of P2

            // Check if we are touching any existing block of this subject
            if (p > 0 && daySched[p-1]?.subjectId === unit.subjectId) isAdjacent = true;
            if (daySched[p2+1]?.subjectId === unit.subjectId) isAdjacent = true;

            if (isAdjacent) {
                score += 500; // High Reward for adjacency
            } else {
                score -= 1000; // High Penalty for splitting
            }
        }
    }
  }

  // 5. PEDAGOGICAL
  score += calculatePedagogicalScore(state, data, d, p, unit);

  // 6. BIAS & ROOMS
  score += (maxPeriods - p) * (WEIGHTS.MORNING_BIAS / maxPeriods);
  
  if (unit.preferredRoomIds?.length && unit.defaultRoomId) {
     score += WEIGHTS.ROOM_EFFICIENCY;
  }

  return score;
};