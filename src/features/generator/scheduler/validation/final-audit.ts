import { AppData, Conflict, ClassGroup, Subject, Teacher, Room } from "../../../../types";
import { getPeriodType } from "../utils/utils";

export const generateFinalReport = (data: AppData): Conflict[] => {
  const conflicts: Conflict[] = [];
  const { schedule, settings } = data;
  const { dayStructure } = settings;

  // Trackers: [resourceId][day][period] -> classId[]
  const teacherOccupancy: Record<string, Record<number, Record<number, string[]>>> = {};
  const roomOccupancy: Record<string, Record<number, Record<number, string[]>>> = {};

  // 1. Audit Per Class (Gaps & Continuity) + Build Occupancy Maps
  for (const classId of Object.keys(schedule)) {
    const classSchedule = schedule[classId];
    if (!classSchedule) continue;

    const cls = data.classes.find((c: ClassGroup) => c.id === classId);
    const structure = cls?.structure || dayStructure; 

    for (const dayStr of Object.keys(classSchedule)) {
      const day = parseInt(dayStr);
      const daySchedule = classSchedule[day];
      
      const occupiedPeriods = new Set<number>();
      const subjectPlacements: Record<number, string> = {}; // p -> subjectId

      for (const periodStr of Object.keys(daySchedule)) {
        const period = parseInt(periodStr);
        const slot = daySchedule[period];

        occupiedPeriods.add(period);
        if (slot.subjectId) {
            subjectPlacements[period] = slot.subjectId;
        }

        // --- OCCUPANCY BUILDER ---
        // We capture ALL slots (Heads + Tails) to ensure complete overlap detection.
        // Even if 'isFixed' is true (tail), the teacher is still busy.
        if (slot.teacherId) {
          if (!teacherOccupancy[slot.teacherId]) teacherOccupancy[slot.teacherId] = {};
          if (!teacherOccupancy[slot.teacherId][day]) teacherOccupancy[slot.teacherId][day] = {};
          if (!teacherOccupancy[slot.teacherId][day][period]) teacherOccupancy[slot.teacherId][day][period] = [];
          
          teacherOccupancy[slot.teacherId][day][period].push(classId);
        }

        if (slot.roomId) {
          if (!roomOccupancy[slot.roomId]) roomOccupancy[slot.roomId] = {};
          if (!roomOccupancy[slot.roomId][day]) roomOccupancy[slot.roomId][day] = {};
          if (!roomOccupancy[slot.roomId][day][period]) roomOccupancy[slot.roomId][day][period] = [];
          
          roomOccupancy[slot.roomId][day][period].push(classId);
        }
      }

      // --- CHECK: CLASS GAPS ---
      const sortedOccupied = Array.from(occupiedPeriods).sort((a, b) => a - b);
      if (sortedOccupied.length > 1) {
          const first = sortedOccupied[0];
          const last = sortedOccupied[sortedOccupied.length - 1];
          
          for (let p = first + 1; p < last; p++) {
              if (!occupiedPeriods.has(p)) {
                  // It's empty. Is it a CLASS period?
                  if (getPeriodType(structure, p) === "CLASS") {
                      conflicts.push({
                          classId,
                          className: cls?.name || classId,
                          day,
                          period: p,
                          reason: `Class Gap: Free period between lessons`,
                          severity: "MEDIUM"
                      });
                  }
              }
          }
      }

      // --- CHECK: SUBJECT CONTINUITY ---
      const subjectsInDay = new Set(Object.values(subjectPlacements));
      for (const subjectId of subjectsInDay) {
          const sPeriods = Object.entries(subjectPlacements)
              .filter(([p, sId]) => sId === subjectId)
              .map(([p]) => parseInt(p))
              .sort((a, b) => a - b);
          
          if (sPeriods.length > 1) {
              const start = sPeriods[0];
              const end = sPeriods[sPeriods.length - 1];

              for (let p = start + 1; p < end; p++) {
                  const type = getPeriodType(structure, p);
                  if (type === "CLASS") {
                      const currentSubject = subjectPlacements[p];
                      if (currentSubject !== subjectId) {
                          const reason = currentSubject 
                              ? `sandwiched by another subject` 
                              : `split by empty period`;
                          
                          conflicts.push({
                              classId,
                              className: cls?.name || classId,
                              subjectId,
                              subjectName: data.subjects.find((s: Subject) => s.id === subjectId)?.name,
                              day,
                              period: p,
                              reason: `Subject Continuity: ${reason}`,
                              severity: "HIGH"
                          });
                          break; // Report once per subject per day
                      }
                  }
              }
          }
      }
    }
  }

  // 2. Audit Teachers (Double Bookings)
  for (const teacherId of Object.keys(teacherOccupancy)) {
    for (const dayStr of Object.keys(teacherOccupancy[teacherId])) {
      const day = parseInt(dayStr);
      for (const periodStr of Object.keys(teacherOccupancy[teacherId][day])) {
        const period = parseInt(periodStr);
        const classes = teacherOccupancy[teacherId][day][period];

        if (classes.length > 1) {
           classes.forEach(classId => {
             const cls = data.classes.find((c: ClassGroup) => c.id === classId);
             const teacher = data.teachers.find((t: Teacher) => t.id === teacherId);
             
             conflicts.push({
               classId,
               className: cls?.name || classId,
               teacherId,
               teacherName: teacher?.name,
               day,
               period,
               reason: `Double Booking: Teacher ${teacher?.name || teacherId} is assigned to multiple classes (${classes.join(", ")})`,
               severity: "HIGH"
             });
          });
        }
      }
    }
  }

  // 3. Audit Rooms (Double Bookings)
  for (const roomId of Object.keys(roomOccupancy)) {
    for (const dayStr of Object.keys(roomOccupancy[roomId])) {
      const day = parseInt(dayStr);
      for (const periodStr of Object.keys(roomOccupancy[roomId][day])) {
        const period = parseInt(periodStr);
        const classes = roomOccupancy[roomId][day][period];

        if (classes.length > 1) {
          classes.forEach(classId => {
             const cls = data.classes.find((c: ClassGroup) => c.id === classId);
             const room = data.rooms.find((r: Room) => r.id === roomId);

             conflicts.push({
               classId,
               className: cls?.name || classId,
               day,
               period,
               reason: `Double Booking: Room ${room?.name || roomId} is booked for multiple classes (${classes.join(", ")})`,
               severity: "HIGH"
             });
          });
        }
      }
    }
  }

  return conflicts;
};
