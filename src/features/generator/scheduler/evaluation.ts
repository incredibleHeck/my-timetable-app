import { AppData, Subject, Teacher, ClassGroup } from "../../../types";
import { AllocationUnit, SchedulerState } from "./types";
import { checkHardConstraints, checkImmutableConstraints } from "./constraints";
import { calculateScore, calculateTeacherGapPenalty, calculateRoomPenalty } from "./scoring";
import { countPotentialConflicts, findUnitsInSlot } from "./search";
import { forceDetermineRoom } from "./rooms";

// ARCHITECT: Removed dependency on legacy 'validation.ts'. 
// We now rely on the unified O(1) Constraint Engine.

export interface EvaluationResult {
  score: number;      // Higher is better
  penalty: number;    // Lower is better
  isLegal: boolean;   // Must be true to attempt
}

export interface MoveCoordinates {
  d: number;
  p: number;
  p2: number;
}

export class EvaluationEngine {
  
  /**
   * evaluate: Phase 1 (Greedy Construction)
   * Strict: Must be empty and valid.
   */
  evaluate(
    state: SchedulerState, 
    data: AppData, 
    move: MoveCoordinates, 
    unit: AllocationUnit, 
    teacherMap: Map<string, Teacher>, 
    subjectMap: Map<string, Subject>,
    classMap: Map<string, ClassGroup>,
    roomMap: Map<string, any>
  ): EvaluationResult {
    
    // 1. HARD Constraints (O(1))
    // Checks Bounds, Occupancy, Teacher Load, Curriculum Limits, Capacity, Sandwiching
    const isLegal = checkHardConstraints(
        state, data, move.d, move.p, move.p2, unit, 
        teacherMap, classMap, subjectMap, roomMap
    );
    
    // 2. SOFT Score (O(1))
    // Calculates Preference, Gaps, Distribution
    const score = calculateScore(
        state, data, move.d, move.p, unit, 
        teacherMap, subjectMap
    );

    // 3. Penalty (Conflicts)
    const penalty = countPotentialConflicts(
        unit, state, data, move.d, move.p, move.p2, 
        teacherMap, subjectMap
    );
    
    return { score, penalty, isLegal };
  }

  /**
   * evaluateMove: Phase 2 (Repair / Local Search)
   * Flexible: Allows evictions but penalizes them.
   */
  evaluateMove(
    state: SchedulerState,
    data: AppData,
    unit: AllocationUnit,
    d: number,
    p: number,
    teacherMap: Map<string, Teacher>,
    subjectMap: Map<string, Subject>,
    classMap: Map<string, ClassGroup>,
    roomMap: Map<string, any>
  ): { isLegal: boolean; totalCost: number; conflicts: string[] } {
    
    let totalCost = 0;
    const conflicts: string[] = [];
    const p2 = unit.duration === 2 ? p + 1 : -1;

    // 1. IMMUTABLE CHECKS (The "Hard Walls")
    const possible = checkImmutableConstraints(
        d, p, p2, unit, data, 
        teacherMap, classMap
    );

    if (!possible) {
        return { isLegal: false, totalCost: Infinity, conflicts: ["Immutable Constraint Violation"] };
    }

    // 2. PHYSICAL CONFLICTS (Evictions)
    const victims = findUnitsInSlot(state, unit, d, p, p2);
    if (victims.size > 0) {
        totalCost += victims.size * 1000; // Base eviction cost
        victims.forEach(v => conflicts.push(`Evicting ${v}`));
    }

    // 3. LOGICAL CONFLICTS (Teacher Load, etc.)
    const logicPenalty = countPotentialConflicts(
        unit, state, data, d, p, p2, 
        teacherMap, subjectMap
    );
    totalCost += logicPenalty * 100; // Weighting logic violations

    // 4. QUALITY PENALTIES (Soft Constraints)
    const gapPenalty = calculateTeacherGapPenalty(state, d, p, unit.teacherIds, unit.classIds);
    totalCost += Math.abs(gapPenalty); 

    // 5. ROOM PENALTY (Homeroom Displacement)
    const targetRoomId = forceDetermineRoom(d, p, p2, unit, state, data, subjectMap, classMap);
    if (targetRoomId) {
        totalCost += calculateRoomPenalty(state, unit, d, p, targetRoomId);
        if (p2 !== -1) totalCost += calculateRoomPenalty(state, unit, d, p2, targetRoomId);
    } else {
        totalCost += 5000; 
        conflicts.push("No valid room found");
    }

    return { isLegal: true, totalCost, conflicts };
  }
}