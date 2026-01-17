import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints, isGlobalSlotBlocked } from "./constraints";
import { calculateScore, calculateTeacherGapPenalty, calculatePedagogicalScore } from "./scoring";
import { countPotentialConflicts, findUnitsInSlot } from "./search";

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
  evaluate(state: SchedulerState, data: AppData, move: MoveCoordinates, unit: AllocationUnit): EvaluationResult {
    const involvedClasses = unit.classIds.map(cid => data.classes.find(c => c.id === cid));

    const isLegal = checkHardConstraints(state, data, move.d, move.p, move.p2, unit, involvedClasses);
    const penalty = countPotentialConflicts(unit, state, data, move.d, move.p, move.p2);
    const score = calculateScore(state, data, move.d, move.p, unit);
    
    return { score, penalty, isLegal };
  }

  /**
   * evaluateMove: The primary orchestrator for Phase 2 (Repair).
   * It evaluates "If I place Unit X here, what is the total system cost?"
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

    // 1. Physical Conflicts (The "Victims" to be evicted)
    const victims = findUnitsInSlot(state, unit, d, p, p2);
    totalCost += victims.size * 1000; // Each eviction costs 1000 points
    victims.forEach(v => conflicts.push(v));

    // 2. Soft Penalties (Quality)
    const gapPenalty = calculateTeacherGapPenalty(state, d, p, unit.teacherIds);
    const varietyPenalty = calculatePedagogicalScore(state, data, d, p, unit);
    
    totalCost += Math.abs(gapPenalty);
    totalCost += Math.abs(varietyPenalty);

    // 3. Hard Constraints (Global Blocks)
    const globalP1 = data.settings.fixedOccasions?.[d]?.[p];
    if (isGlobalSlotBlocked(globalP1)) {
      isLegal = false; // Cannot ever be moved here
    }
    
    if (unit.duration === 2 && p2 !== -1) {
        const globalP2 = data.settings.fixedOccasions?.[d]?.[p2];
        if (isGlobalSlotBlocked(globalP2)) {
            isLegal = false;
        }
    }

    return { isLegal, totalCost, conflicts };
  }
}


