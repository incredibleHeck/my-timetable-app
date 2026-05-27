import { AppData, Subject, Teacher, ClassGroup, Room } from "../../../../types";
import { AllocationUnit, SchedulerState } from "../core/types";
import { checkHardConstraints, checkImmutableConstraints, buildEvictionIgnoredSlots, computeTeacherLoadAdjustment } from "./constraints";
import { calculateScore, calculateTeacherGapPenalty, calculateRoomPenalty } from "./scoring";
import { countPotentialConflicts, findUnitsInSlot } from "../solver/slot-conflicts";
import { forceDetermineRoom } from "./rooms";
import { checkSubjectContinuity } from "../validation/load-checks";
import { getNextClassPeriod } from "../utils/utils";
import {
  EVICTION_COST_NORMAL,
  EVICTION_COST_SKELETON,
  EVICTION_COST_PART_TIMER,
  EVICTION_COST_SPECIALIST_DOUBLE,
  EVICTION_COST_SPECIALIST_SINGLE,
  REPAIR_CONTINUITY_COST,
  REPAIR_NO_ROOM_COST,
} from "../constants";

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
        teacherMap, subjectMap, classMap, roomMap
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

    if (!checkImmutableConstraints(d, p, p2, unit, data, teacherMap, classMap)) {
      return {
        isLegal: false,
        totalCost: Infinity,
        conflicts: ["Rank 1: Immutable constraint violation"],
      };
    }

    const victims = findUnitsInSlot(state, unit, d, p, p2, subjectMap, classMap, roomMap);
    const ignoredOccupants = new Set(victims);
    ignoredOccupants.add(unit.id);

    const teacherLoadAdjustment = computeTeacherLoadAdjustment(
      state,
      d,
      p,
      p2,
      victims,
      unitMap,
    );
    const ignoredSlots = buildEvictionIgnoredSlots(state, d, victims);

    const isLegal = checkHardConstraints(
      state,
      data,
      d,
      p,
      p2,
      unit,
      teacherMap,
      classMap,
      subjectMap,
      roomMap,
      {
        ignoredOccupants,
        teacherLoadAdjustment,
        ignoredSlots,
      },
    );

    if (!isLegal) {
      return {
        isLegal: false,
        totalCost: Infinity,
        conflicts: ["Rank 1: Invariant Violation (Triple Lock/Shape/Welfare)"],
      };
    }

    if (victims.size > 0) {
        victims.forEach(vId => {
            const vUnit = unitMap.get(vId); 
            let evictionCost = EVICTION_COST_NORMAL;
            
            if (vUnit) {
                const vSubject = subjectMap.get(vUnit.subjectId);
                const isVSpecialist = vSubject?.requiredRoomId || vUnit.requiredRoomType;
                const isVComplex = vUnit.classIds.length > 1 || vUnit.jointClassId || vUnit.electiveBlockId;

                if (isVComplex) {
                    evictionCost = EVICTION_COST_SKELETON;
                } else {
                    for (const tid of vUnit.teacherIds) {
                        const teacher = teacherMap.get(tid);
                        if (teacher?.constraints) {
                            let availableSlots = 0;
                            teacher.constraints.forEach(row => row.forEach(isBlocked => { if (!isBlocked) availableSlots++; }));
                            if (availableSlots < 45) {
                                evictionCost = Math.max(evictionCost, EVICTION_COST_PART_TIMER);
                            }
                        }
                    }
                    
                    if (isVSpecialist) {
                        evictionCost = Math.max(
                          evictionCost,
                          vUnit.duration === 2
                            ? EVICTION_COST_SPECIALIST_DOUBLE
                            : EVICTION_COST_SPECIALIST_SINGLE,
                        );
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
    const continuityError = checkSubjectContinuity(ctx, proposedSet, ignoredSlots, state);
    if (continuityError) totalCost += REPAIR_CONTINUITY_COST; 

    const gapPenalty = calculateTeacherGapPenalty(state, d, p, unit.teacherIds, unit.classIds);
    totalCost += Math.abs(gapPenalty); 

    const targetRoomId = forceDetermineRoom(d, p, p2, unit, state, data, subjectMap, classMap, roomMap);
    if (targetRoomId) {
        totalCost += calculateRoomPenalty(state, unit, d, p, targetRoomId);
        if (p2 !== -1) totalCost += calculateRoomPenalty(state, unit, d, p2, targetRoomId);
    } else {
        totalCost += REPAIR_NO_ROOM_COST; 
        conflicts.push("No valid room found");
    }

    return { isLegal: true, totalCost, conflicts };
  }
}