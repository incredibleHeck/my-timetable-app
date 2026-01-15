import { AppData, ScheduleSlot, Conflict } from "../../../types";
import { calculateClassSchedule, doTimeRangesOverlap } from "../../../utils/timeUtils";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  isSwap?: boolean;
  severity?: "HIGH" | "MEDIUM" | "LOW";
};

export const checkSlotValidity = (
  data: AppData,
  targetDay: number,
  targetPeriod: number,
  teacherId: string,
  classId: string,
  subjectId: string,
  ignoreSlot?: { day: number; period: number },
  roomId?: string,
  duration: number = 1,
  ignoreTargetSlot?: { day: number; period: number; duration: number },
  isAuto: boolean = false
): ValidationResult => {
  const { schedule, settings, classes, teachers, subjects, rooms } = data;
  
  // Pre-calculate all class schedules once
  const allClassSchedules = new Map<string, any[]>();
  classes.forEach(c => {
    allClassSchedules.set(c.id, calculateClassSchedule(c, settings, c.structure || settings.dayStructure));
  });

  const targetClassSchedule = allClassSchedules.get(classId) || [];

  // LOOP for Duration (Check current period + next period(s) if double)
  // MODIFIED: Use a while loop to skip non-CLASS periods (e.g. Breaks)
  let periodsConsumed = 0;
  let currentOffset = 0;

  while (periodsConsumed < duration) {
    const p = targetPeriod + currentOffset;
    
    // Boundary Check
    const cls = classes.find((c) => c.id === classId);
    const maxPeriods = Math.max(
        cls?.periodCount || settings.periodsPerDay, 
        cls?.structure?.length || 0
    );
    if (p >= maxPeriods) return { valid: false, message: "Exceeds daily limit", severity: "HIGH" };

    // Check Structure
    const structure = cls?.structure || settings.dayStructure;
    const structItem = structure?.[p];
    const structureType = typeof structItem === "string" ? structItem : structItem?.type;

    // If it's not a CLASS period, skip validation for this slot and continue to the next one
    // effectively "spanning" the break.
    if (structureType && structureType !== "CLASS") {
      currentOffset++;
      continue;
    }

    // 1. GLOBAL CHECKS
    const globalFixed = settings.fixedOccasions?.[targetDay]?.[p];
    if (globalFixed) {
      const label =
        typeof globalFixed === "object" && "name" in globalFixed
          ? globalFixed.name
          : "School Event";
      return { valid: false, message: `Global: ${label}`, severity: "HIGH" };
    }

    // 2. CLASS CHECKS
    if (cls?.fixedSessions?.[targetDay]?.[p]) {
      const fixedLabel = cls.fixedSessions[targetDay][p];
      return { valid: false, message: `Class Busy: ${fixedLabel}`, severity: "HIGH" };
    }

    // 3. RESOURCE CHECKS
    const subject = subjects.find(s => s.id === subjectId);
    
    // A. Single Resource Subject
    if (subject?.isSingleResource) {
        for (const otherCId of Object.keys(schedule)) {
            if (otherCId === classId) continue;
            const otherSlot = schedule[otherCId]?.[targetDay]?.[p];
            if (otherSlot && otherSlot.subjectId === subjectId) {
                return { valid: false, message: `${subject.name} is already being taught elsewhere`, severity: "HIGH" };
            }
        }
    }

    // 4. TEACHER CHECKS
    // A. Constraints (Availability)
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher?.constraints?.[targetDay]?.[p]) {
        return { valid: false, message: `${teacher.name} not available`, severity: "HIGH" };
    }

    // B. Overlaps
    const targetTimeRange = targetClassSchedule[p];

    for (const cId of Object.keys(schedule)) {
      if (cId === classId) continue;

      const otherClassSchedule = allClassSchedules.get(cId);
      if (!otherClassSchedule) continue;

      // Check all slots in the other class for absolute time overlap
      const otherDaySlots = schedule[cId]?.[targetDay] || {};
      for (const otherPStr in otherDaySlots) {
        const otherP = parseInt(otherPStr);
        const slot = otherDaySlots[otherP];
        
        if (slot && slot.teacherId === teacherId) {
          const otherTimeRange = otherClassSchedule[otherP];
          
          if (targetTimeRange && otherTimeRange && doTimeRangesOverlap(targetTimeRange, otherTimeRange)) {
             let isIgnored = false;
             
             if (ignoreSlot && targetDay === ignoreSlot.day && p === ignoreSlot.period) {
                 isIgnored = true;
             }
             
             if (ignoreTargetSlot && targetDay === ignoreTargetSlot.day && 
                 p >= ignoreTargetSlot.period && p < ignoreTargetSlot.period + ignoreTargetSlot.duration) {
                 isIgnored = true;
             }

             if (!isIgnored) {
                // Check if this is a Joint Class or Elective Block overlap (Allowed)
                const isJointOverlap = data.jointClasses?.some(jc => 
                  jc.subjectId === subjectId && 
                  jc.classIds.includes(classId) && 
                  jc.classIds.includes(cId)
                );

                const isElectiveOverlap = data.electives?.some(e => 
                  e.classIds.includes(classId) && 
                  e.classIds.includes(cId)
                );

                if (!isJointOverlap && !isElectiveOverlap) {
                  const otherCls = classes.find(c => c.id === cId);
                  const className = otherCls?.name || "another class";
                  return { valid: false, message: `Teacher is busy in ${className}`, severity: "HIGH" };
                }
             }
          }
        }

        // Room Busy
        if (roomId) {
            const slot = otherDaySlots[otherP];
            if (slot && slot.roomId === roomId) {
                const otherTimeRange = otherClassSchedule[otherP];
                if (targetTimeRange && otherTimeRange && doTimeRangesOverlap(targetTimeRange, otherTimeRange)) {
                    const otherCls = classes.find(c => c.id === cId);
                    const className = otherCls?.name || "another class";
                    return { valid: false, message: `Room occupied by ${className}`, severity: "HIGH" };
                }
            }
        }
      }
    }

    // Room Capacity Check
    if (roomId) {
      const room = rooms.find((r) => r.id === roomId);
      const cls = classes.find((c) => c.id === classId);
      if (room && cls && (cls.studentCount || 0) > room.capacity) {
        return {
          valid: false,
          message: `Room capacity (${room.capacity}) exceeded by ${cls.name} (${cls.studentCount} students)`,
          severity: "MEDIUM",
        };
      }
    }

    // C. Teacher Fatigue (Consecutive Periods)
    const maxConsecutive = settings.maxConsecutivePeriods || 4;
    let consecutiveCount = 0;
    const busyPeriods = new Set<number>();
    const maxDailyLoad = settings.maxTeacherPeriodsPerDay || 6;

    // Check whole day for this teacher, including the proposed slot
    for (let checkP = 0; checkP < maxPeriods; checkP++) {
        let isBusy = false;
        
        // 1. Proposed Slot Check
        if (checkP === p) {
             isBusy = true;
        } else {
             // 2. Existing Schedule Check
             for (const cId of Object.keys(schedule)) {
                const s = schedule[cId]?.[targetDay]?.[checkP];
                if (s && s.teacherId === teacherId) {
                    // Ignore the old position of the dragged slot (Full Duration)
                    if (ignoreSlot && targetDay === ignoreSlot.day && 
                        checkP >= ignoreSlot.period && checkP < ignoreSlot.period + duration) {
                        continue; // Ignored (Moving Source)
                    }

                    // Ignore Target (Displaced)
                    if (ignoreTargetSlot && targetDay === ignoreTargetSlot.day && 
                        checkP >= ignoreTargetSlot.period && checkP < ignoreTargetSlot.period + ignoreTargetSlot.duration) {
                        continue; // Ignored (Displaced Target)
                    }

                    isBusy = true;
                    break;
                }
            }
        }

        if (isBusy) {
            busyPeriods.add(checkP);
            consecutiveCount++;
            if (consecutiveCount > maxConsecutive) {
                return { valid: false, message: `${teacher?.name} would exceed consecutive period limit (${maxConsecutive})`, severity: "MEDIUM" };
            }
        } else {
            consecutiveCount = 0;
        }
    }

    // D. Teacher Daily Load Check (Unique periods only)
    if (busyPeriods.size > maxDailyLoad) {
         return { valid: false, message: `${teacher?.name} exceeds daily limit of ${maxDailyLoad} classes`, severity: "MEDIUM" };
    }
    
    // Increment consumed duration only if we actually processed a CLASS period
    periodsConsumed++;
    currentOffset++;
  }

  // 5. JOINT CLASS INTEGRITY
  // Check if this slot belongs to a Joint Class. If so, manual move breaks sync.
  const isJoint = data.jointClasses?.some(jc => 
      jc.subjectId === subjectId && jc.classIds.includes(classId)
  );
  if (isJoint && !isAuto) {
      return { valid: false, message: "Cannot move Joint Class manually (breaks sync)", severity: "HIGH" };
  }

  // 6. CLASS-LEVEL SUBJECT CONSTRAINTS (Daily Limit & Gaps)
  const daySchedule = schedule[classId]?.[targetDay] || {};
  let existingPeriods = 0;
  let firstP = 999;
  let lastP = -999;

  // Include proposed slots
  existingPeriods += duration;
  firstP = Math.min(firstP, targetPeriod);
  lastP = Math.max(lastP, targetPeriod + duration - 1);

  // Check existing slots for this subject
  for (const pStr in daySchedule) {
      const pIdx = parseInt(pStr);
      // Ignore old position if we are moving (Full Duration)
      if (ignoreSlot && targetDay === ignoreSlot.day && pIdx >= ignoreSlot.period && pIdx < ignoreSlot.period + duration) continue;
      
      // FIX: Also ignore the TARGET position if it currently contains the same subject,
      // as it will be displaced by this move.
      if (pIdx >= targetPeriod && pIdx < targetPeriod + duration) continue;

      const s = daySchedule[pStr];
      if (s.subjectId === subjectId) {
          existingPeriods++;
          firstP = Math.min(firstP, pIdx);
          lastP = Math.max(lastP, pIdx);
      }
  }

  // A. Daily Limit
  const maxSubjPeriods = settings.maxSubjectPeriodsPerDay || 2;
  if (existingPeriods > maxSubjPeriods) {
      const subject = subjects.find(s => s.id === subjectId);
      return { valid: false, message: `Max ${maxSubjPeriods} periods of ${subject?.name} per day`, severity: "MEDIUM" };
  }

  // B. Gap Detection (Sandwich Rule)
  if (existingPeriods > 1) {
      const cls = classes.find(c => c.id === classId);
      const structure = cls?.structure || settings.dayStructure;
      
      for (let gapP = firstP + 1; gapP < lastP; gapP++) {
          // Check if gap is a CLASS period
          const structItem = structure?.[gapP];
          const type = typeof structItem === "string" ? structItem : structItem?.type;
          if (!type || type === "CLASS") {
              // Check if this gap is occupied by the subject
              const isOccupiedByProposed = (gapP >= targetPeriod && gapP < targetPeriod + duration);
              const isOccupiedByExisting = daySchedule[gapP]?.subjectId === subjectId;
              
              if (!isOccupiedByProposed && !isOccupiedByExisting) {
                  return { valid: false, message: `Gap detected in ${subjects.find(s => s.id === subjectId)?.name} sessions`, severity: "MEDIUM" };
              }
          }
      }
  }

  // 6. TARGET OCCUPANCY (Swap Check)
  // Only check the START period for occupancy to trigger swap mode.
  const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
    if ((targetSlot as any).locked) {
      return { valid: false, message: "Target slot is Locked", severity: "HIGH" };
    }
    if (targetSlot.electiveBlockId) {
        return { valid: false, message: "Cannot move Elective Block manually", severity: "HIGH" };
    }
    return { valid: true, isSwap: true, message: "Swap with existing lesson" };
  }
  
  // If Source is Double, check the next CLASS period for occupancy too
  if (duration === 2) {
      const cls = classes.find((c) => c.id === classId);
      const structure = cls?.structure || settings.dayStructure;
      const maxPeriods = Math.max(
        cls?.periodCount || settings.periodsPerDay, 
        cls?.structure?.length || 0
      );
      
      let nextPeriod = targetPeriod + 1;
      // Skip non-class periods
      while (nextPeriod < maxPeriods) {
          const structItem = structure?.[nextPeriod];
          const structureType = typeof structItem === "string" ? structItem : structItem?.type;
          if (!structureType || structureType === "CLASS") {
              break; // Found the next class period
          }
          nextPeriod++;
      }

      if (nextPeriod < maxPeriods) {
          const p2Slot = schedule[classId]?.[targetDay]?.[nextPeriod];
          if (p2Slot) {
             return { valid: true, isSwap: true, message: "Swap with existing lesson (P2)" };
          }
      }
  }

  return { valid: true, message: "Available" };
};

export const validateFullSchedule = (data: AppData): Conflict[] => {
  const { schedule, classes, subjects, teachers } = data;
  const allConflicts: Conflict[] = [];

  for (const classId of Object.keys(schedule)) {
    const cls = classes.find(c => c.id === classId);
    if (!cls) continue;

    for (const dayStr of Object.keys(schedule[classId])) {
      const day = parseInt(dayStr);
      const daySchedule = schedule[classId][day];

      for (const periodStr of Object.keys(daySchedule)) {
        const period = parseInt(periodStr);
        const slot = daySchedule[period];

        // Skip tails of double periods
        if (slot.isFixed) {
            const prevP = period > 0 ? daySchedule[period - 1] : null;
            if (prevP && prevP.subjectId === slot.subjectId) continue;
        }

        // Determine duration
        const nextP = period + 1; // Simplified, checkSlotValidity handles gaps
        const hasNext = daySchedule[nextP] && daySchedule[nextP].isFixed && daySchedule[nextP].subjectId === slot.subjectId;
        const duration = hasNext ? 2 : 1;

        const result = checkSlotValidity(
          data,
          day,
          period,
          slot.teacherId,
          classId,
          slot.subjectId,
          { day, period }, // ignore itself
          slot.roomId,
          duration,
          undefined,
          true
        );

        if (!result.valid) {
          const subject = subjects.find(s => s.id === slot.subjectId);
          const teacher = teachers.find(t => t.id === slot.teacherId);
          
          allConflicts.push({
            classId,
            className: cls.name,
            subjectId: slot.subjectId,
            subjectName: subject?.name || "Unknown",
            teacherName: teacher?.name || "Unknown",
            day,
            period,
            reason: result.message || "Invalid placement",
            severity: result.severity || "HIGH"
          });
        }
      }
    }
  }

  return allConflicts;
};
