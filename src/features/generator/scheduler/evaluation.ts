import { AppData, Conflict } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints, isGlobalSlotBlocked } from "./constraints";
import { calculateScore, calculateTeacherGapPenalty, calculatePedagogicalScore, calculateRoomPenalty } from "./scoring";
import { countPotentialConflicts, findUnitsInSlot } from "./search";
import { forceDetermineRoom } from "./rooms";

export interface EvaluationResult {
  score: number;      // Soft constraints (Higher is better)
  penalty: number;    // Violation count (lower is better)
  isLegal: boolean;   // Hard constraints
}

export interface MoveCoordinates {
  d: number;
  p: number;
  p2: number;
}

export class EvaluationEngine {
  /**
   * evaluate: Used during the Construction Phase.
   * Checks if a move is a "perfect fit" without displacing others.
   */
  evaluate(state: SchedulerState, data: AppData, move: MoveCoordinates, unit: AllocationUnit): EvaluationResult {
    const involvedClasses = unit.classIds.map(cid => data.classes.find(c => c.id === cid));

    const isLegal = checkHardConstraints(state, data, move.d, move.p, move.p2, unit, involvedClasses);
    const penalty = countPotentialConflicts(unit, state, data, move.d, move.p, move.p2);
    const score = calculateScore(state, data, move.d, move.p, unit);
    
    return { score, penalty, isLegal };
  }

  /**
   * evaluateMove: The primary orchestrator for Phase 2 (Repair).
   * It calculates the "System Noise" created by placing a unit in a specific spot.
   */
  evaluateMove(
    state: SchedulerState,
    data: AppData,
    unit: AllocationUnit,
    d: number,
    p: number
  ): { isLegal: boolean; totalCost: number; conflicts: string[] } {
    let totalCost = 0;
    let conflicts: string[] = [];
    let isLegal = true;

    const p2 = unit.duration === 2 ? p + 1 : -1;

    // 1. PHYSICAL CONFLICTS (Evictions)
    // We identify "Victims" that must be kicked out. 
    // High cost (1000) makes the solver prefer empty slots.
    const victims = findUnitsInSlot(state, unit, d, p, p2);
    totalCost += victims.size * 1000;
    victims.forEach(v => conflicts.push(v));

    // 2. QUALITY PENALTIES (Soft Constraints)
    // Absorb scores from scoring.ts. We convert "Bonus Scores" into "Penalty Reductions".
    const gapPenalty = calculateTeacherGapPenalty(state, d, p, unit.teacherIds);
    const varietyPenalty = calculatePedagogicalScore(state, data, d, p, unit);
    
    totalCost += Math.abs(gapPenalty);
    totalCost += Math.abs(varietyPenalty);

    // 3. ROOM PENALTY (Homeroom Displacement)
    const targetRoomId = forceDetermineRoom(d, p, p2, unit, state, data);
    if (targetRoomId) {
        totalCost += calculateRoomPenalty(state, unit, d, p, targetRoomId);
        if (p2 !== -1) {
            totalCost += calculateRoomPenalty(state, unit, d, p2, targetRoomId);
        }
    }

    // 4. HARD WALLS: Global Blocks & Structural Integrity
    // If a period is a LUNCH or a school-wide assembly, the move is ILLEGAL.
    const globalP1 = data.settings.fixedOccasions?.[d]?.[p];
    if (isGlobalSlotBlocked(globalP1)) isLegal = false;
    
    if (unit.duration === 2 && p2 !== -1) {
        const globalP2 = data.settings.fixedOccasions?.[d]?.[p2];
        if (isGlobalSlotBlocked(globalP2)) isLegal = false;
    }

    // Ensure we aren't moving into a period index that doesn't exist for this class
    const maxP = data.settings.periodsPerDay;
    if (p >= maxP || (unit.duration === 2 && p2 >= maxP)) isLegal = false;

    return { isLegal, totalCost, conflicts };
  }
}
