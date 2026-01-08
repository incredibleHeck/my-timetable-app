import { AppData, ExamSession } from "../../../types";

export interface ExamConflict {
  type: 'STUDENT' | 'ROOM' | 'STAFF' | 'CAPACITY';
  severity: 'CRITICAL' | 'WARNING';
  message: string;
  affectedIds: string[];
}

/**
 * Validates a potential move or an existing exam against remaining constraints.
 * NOTE: Student conflicts have been removed per user request.
 */
export function validateExamMove(
  exam: ExamSession,
  allExams: ExamSession[],
  data: AppData
): ExamConflict[] {
  const conflicts: ExamConflict[] = [];

  // 1. TIME OVERLAP CHECKS
  const overlappingExams = allExams.filter(other => 
    other.id !== exam.id &&
    other.date === exam.date &&
    other.startTime === exam.startTime
  );

  // 2. ROOM CONFLICTS
  if (exam.roomId) {
    const room = data.rooms.find(r => r.id === exam.roomId);
    
    // 2a. Double Booking
    const roomClash = overlappingExams.find(other => other.roomId === exam.roomId);
    if (roomClash) {
      conflicts.push({
        type: 'ROOM',
        severity: 'CRITICAL',
        message: `Room Conflict: ${room?.name || 'Selected room'} is already booked.`,
        affectedIds: [roomClash.id]
      });
    }

    // 2b. Capacity Check
    if (room && room.capacity) {
      const totalStudents = exam.classIds.reduce((sum, cid) => {
        const cls = data.classes.find(c => c.id === cid);
        // Fallback to 0 if studentCount is missing
        return sum + (cls?.studentCount || 0);
      }, 0);

      if (totalStudents > room.capacity) {
        conflicts.push({
          type: 'CAPACITY',
          severity: 'WARNING',
          message: `Capacity Warning: ${totalStudents} students exceed ${room.name} limit (${room.capacity}).`,
          affectedIds: []
        });
      }
    }
  }

  // 3. STAFF CONFLICTS
  if (exam.invigilatorIds && exam.invigilatorIds.length > 0) {
    const staffClash = overlappingExams.find(other => 
      (other.invigilatorIds || []).some(id => exam.invigilatorIds?.includes(id))
    );

    if (staffClash) {
      const staffNames = (staffClash.invigilatorIds || [])
        .filter(id => exam.invigilatorIds?.includes(id))
        .map(id => data.teachers.find(t => t.id === id)?.name)
        .join(', ');

      conflicts.push({
        type: 'STAFF',
        severity: 'CRITICAL',
        message: `Staff Conflict: ${staffNames} is already invigilating elsewhere.`,
        affectedIds: [staffClash.id]
      });
    }
  }

  return conflicts;
}