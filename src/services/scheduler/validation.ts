import { AppData, ScheduleSlot } from "../../types";

export type ValidationResult = {
  valid: boolean;
  message?: string;
  isSwap?: boolean;
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
  duration: number = 1
): ValidationResult => {
  const { schedule, settings, classes, teachers, subjects } = data;

  // LOOP for Duration (Check current period + next period if double)
  for (let i = 0; i < duration; i++) {
    const p = targetPeriod + i;
    
    // Boundary Check
    const cls = classes.find((c) => c.id === classId);
    const maxPeriods = Math.max(
        cls?.periodCount || settings.periodsPerDay, 
        cls?.structure?.length || 0
    );
    if (p >= maxPeriods) return { valid: false, message: "Exceeds daily limit" };

    // 1. GLOBAL CHECKS
    const globalFixed = settings.fixedOccasions?.[targetDay]?.[p];
    if (globalFixed) {
      const label =
        typeof globalFixed === "object" && "name" in globalFixed
          ? globalFixed.name
          : "School Event";
      return { valid: false, message: `Global: ${label}` };
    }

    // Check Structure
    const structure = cls?.structure || settings.dayStructure;
    const structItem = structure?.[p];
    const structureType = typeof structItem === "string" ? structItem : structItem?.type;

    if (structureType && structureType !== "CLASS") {
      return { valid: false, message: `Period is ${structureType}` };
    }

    // 2. CLASS CHECKS
    if (cls?.fixedSessions?.[targetDay]?.[p]) {
      const fixedLabel = cls.fixedSessions[targetDay][p];
      return { valid: false, message: `Class Busy: ${fixedLabel}` };
    }

    // 3. RESOURCE CHECKS
    const subject = subjects.find(s => s.id === subjectId);
    
    // A. Single Resource Subject
    if (subject?.isSingleResource) {
        for (const otherCId of Object.keys(schedule)) {
            if (otherCId === classId) continue;
            const otherSlot = schedule[otherCId]?.[targetDay]?.[p];
            if (otherSlot && otherSlot.subjectId === subjectId) {
                return { valid: false, message: `${subject.name} is already being taught elsewhere` };
            }
        }
    }

    // 4. TEACHER CHECKS
    // A. Constraints (Availability)
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher?.constraints?.[targetDay]?.[p]) {
        return { valid: false, message: `${teacher.name} not available` };
    }

    // B. Overlaps
    for (const cId of Object.keys(schedule)) {
      if (cId === classId) continue;

      const slot = schedule[cId]?.[targetDay]?.[p];
      if (slot) {
          // Teacher Busy
          if (slot.teacherId === teacherId) {
             const className = classes.find((c) => c.id === cId)?.name || "another class";
             return { valid: false, message: `Teacher is busy in ${className}` };
          }
          // Room Busy
          if (roomId && slot.roomId === roomId) {
             const className = classes.find((c) => c.id === cId)?.name || "another class";
             return { valid: false, message: `Room occupied by ${className}` };
          }
      }
    }

    // C. Teacher Fatigue (Consecutive Periods)
    const maxConsecutive = settings.maxConsecutivePeriods || 4;
    let consecutiveCount = 0;
    let dailyLoad = 0; // NEW: Track total daily periods
    const maxDailyLoad = 6; // Hard constraint for now, could be setting

    // Check whole day for this teacher, including the proposed slot
    for (let checkP = 0; checkP < maxPeriods; checkP++) {
        let isBusy = false;
        
        // Proposed slot(s)
        if (checkP >= targetPeriod && checkP < targetPeriod + duration) {
            isBusy = true;
        } else {
            // Check existing schedule
            for (const cId of Object.keys(schedule)) {
                const s = schedule[cId]?.[targetDay]?.[checkP];
                if (s && s.teacherId === teacherId) {
                    // Ignore the old position of the dragged slot
                    if (ignoreSlot && targetDay === ignoreSlot.day && checkP === ignoreSlot.period) {
                        // This is the old slot we are moving, so it won't be here
                    } else {
                        isBusy = true;
                        break;
                    }
                }
            }
        }

        if (isBusy) {
            dailyLoad++;
            consecutiveCount++;
            if (consecutiveCount > maxConsecutive) {
                return { valid: false, message: `${teacher?.name} would exceed consecutive period limit (${maxConsecutive})` };
            }
        } else {
            consecutiveCount = 0;
        }
    }

    // D. Teacher Daily Load Check
    if (dailyLoad > maxDailyLoad) {
         return { valid: false, message: `${teacher?.name} exceeds daily limit of ${maxDailyLoad} classes` };
    }
  }

  // 5. JOINT CLASS INTEGRITY
  // Check if this slot belongs to a Joint Class. If so, manual move breaks sync.
  const isJoint = data.jointClasses?.some(jc => 
      jc.subjectId === subjectId && jc.classIds.includes(classId)
  );
  if (isJoint) {
      return { valid: false, message: "Cannot move Joint Class manually (breaks sync)" };
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
      // Ignore old position if we are moving
      if (ignoreSlot && targetDay === ignoreSlot.day && pIdx === ignoreSlot.period) continue;
      
      const s = daySchedule[pStr];
      if (s.subjectId === subjectId) {
          existingPeriods++;
          firstP = Math.min(firstP, pIdx);
          lastP = Math.max(lastP, pIdx);
      }
  }

  // A. Daily Limit (Max 2)
  if (existingPeriods > 2) {
      const subject = subjects.find(s => s.id === subjectId);
      return { valid: false, message: `Max 2 periods of ${subject?.name} per day` };
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
                  return { valid: false, message: `Gap detected in ${subjects.find(s => s.id === subjectId)?.name} sessions` };
              }
          }
      }
  }

  // 6. TARGET OCCUPANCY (Swap Check)
  // Only check the START period for occupancy to trigger swap mode.
  const targetSlot = schedule[classId]?.[targetDay]?.[targetPeriod];
  if (targetSlot) {
    if ((targetSlot as any).locked) {
      return { valid: false, message: "Target slot is Locked" };
    }
    if (targetSlot.electiveBlockId) {
        return { valid: false, message: "Cannot move Elective Block manually" };
    }
    return { valid: true, isSwap: true, message: "Swap with existing lesson" };
  }
  
  // If Source is Double, check P2 for occupancy too
  if (duration === 2) {
      const p2Slot = schedule[classId]?.[targetDay]?.[targetPeriod + 1];
      if (p2Slot) {
         return { valid: true, isSwap: true, message: "Swap with existing lesson (P2)" };
      }
  }

  return { valid: true, message: "Available" };
};
