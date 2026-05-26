import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { checkHardConstraints, checkImmutableConstraints } from "./constraints";
import { calculateScore, calculateTeacherGapPenalty, calculateRoomPenalty } from "./scoring";
import { countPotentialConflicts, findUnitsInSlot } from "../solver/search";
import { forceDetermineRoom } from "./rooms";
import { checkSubjectContinuity } from "../validation/load-checks";
import { getNextClassPeriod } from "../utils/utils";

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
    roomMap: Map<string, Room>
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
    roomMap: Map<string, Room>,
    unitMap: Map<string, AllocationUnit>
  ): { isLegal: boolean; totalCost: number; conflicts: string[] } {
    
    let totalCost = 0;
    const conflicts: string[] = [];
    const repClass = classMap.get(unit.classIds[0]);
    const struct = repClass?.structure || data.settings.dayStructure;
    const classLimit = repClass?.periodCount ?? data.settings.periodsPerDay;
    const p2 =
      unit.duration === 2
        ? (getNextClassPeriod(p, struct, classLimit) ?? -1)
        : -1;

    if (unit.duration === 2 && p2 === -1) {
      return { isLegal: false, totalCost: Infinity, conflicts: ["No valid second period for double"] };
    }

    // --- RANK 1: THE INVARIANTS (The Rules of Engagement) ---
    // Includes Triple Lock, Shape Rules, and Teacher Welfare.
    // If ANY of these fail, the move is physically impossible and must be rejected.
    const isLegal = checkHardConstraints(
        state, data, d, p, p2, unit, 
        teacherMap, classMap, subjectMap, roomMap
    );

    if (!isLegal) {
        return { isLegal: false, totalCost: Infinity, conflicts: ["Rank 1: Invariant Violation (Triple Lock/Shape/Welfare)"] };
    }

    // Determining victims for evictions (Phase 2 allowing bumping)
    // Note: Since checkHardConstraints above checks occupancy, we only get here if the slot 
    // is physically reachable (e.g. during repair we temporarily ignore occupancy to find victims).
    // WAIT: If Rank 1 is absolute, we shouldn't allow evicting Rank 1 units to satisfy Rank 1.
    // Actually, checkHardConstraints in state.ts allows unit.id overlap.
    
    const victims = findUnitsInSlot(state, unit, d, p, p2);
    if (victims.size > 0) {
        victims.forEach(vId => {
            const vUnit = unitMap.get(vId); 
            let evictionCost = 1000; // Base
            
            if (vUnit) {
                // RANK 3: THE BOTTLENECKS (High displacement cost)
                const vSubject = subjectMap.get(vUnit.subjectId);
                const isVSpecialist = vSubject?.requiredRoomId || vUnit.requiredRoomType;
                const isVComplex = vUnit.classIds.length > 1 || vUnit.jointClassId || vUnit.electiveBlockId;

                if (isVComplex) {
                    evictionCost = 20000; // Most protected (Skeleton)
                } else {
                    // Check for restricted teachers
                    for (const tid of vUnit.teacherIds) {
                        const teacher = teacherMap.get(tid);
                        if (teacher?.constraints) {
                            let availableSlots = 0;
                            teacher.constraints.forEach(row => row.forEach(isBlocked => { if (!isBlocked) availableSlots++; }));
                            if (availableSlots < 45) {
                                evictionCost = Math.max(evictionCost, 18000); // High protection for part-timers
                            }
                        }
                    }
                    
                    if (isVSpecialist) {
                        evictionCost = Math.max(evictionCost, vUnit.duration === 2 ? 15000 : 12000);
                    }
                }
            }
            
            totalCost += evictionCost;
            conflicts.push(`Rank 3: Evicting bottleneck ${vId}`);
        });
    }

    // --- OTHER LOGICAL PENALTIES ---
    const ctx = {
        data,
        classId: unit.classIds[0],
        subjectId: unit.subjectId,
        teacherId: unit.teacherIds[0],
        targetDay: d,
        maxPeriods: 15,
        structure: data.settings.dayStructure
    } as any;

    const proposedSet = new Set([p]);
    if (p2 !== -1) proposedSet.add(p2);

    // --- RANK 5: THE CONNECTORS (Anti-Sandwich) ---
    const continuityError = checkSubjectContinuity(ctx, proposedSet, new Set(), state);
    if (continuityError) totalCost += 5000; 

    // Quality Penalties
    const gapPenalty = calculateTeacherGapPenalty(state, d, p, unit.teacherIds, unit.classIds);
    totalCost += Math.abs(gapPenalty); 

    // Room Penalty
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