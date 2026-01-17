import { AppData } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints } from "./constraints";
import { calculateScore } from "./scoring";

export interface EvaluationResult {
  score: number;      // Soft constraints (0 to -Infinity)
  penalty: number;    // Violation count (for Iterative Repair)
  isLegal: boolean;   // Hard constraints
}

export interface Move {
  d: number;
  p: number;
  p2: number;
}

export class EvaluationEngine {
  // Merges logic from scoring.ts and constraints.ts
  evaluate(state: SchedulerState, data: AppData, move: Move, unit: AllocationUnit): EvaluationResult {
    // 1. Hard Check (Predicate)
    // We need to resolve the class objects for the constraint checker
    const involvedClasses = unit.classIds.map(cid => data.classes.find(c => c.id === cid));

    if (!checkHardConstraints(state, data, move.d, move.p, move.p2, unit, involvedClasses)) {
      return { score: -Infinity, penalty: 1, isLegal: false };
    }

    // 2. Soft Check (Cost Function)
    const score = calculateScore(state, data, move.d, move.p, unit);
    
    return { score, penalty: 0, isLegal: true };
  }
}
