import { AppData, ExamSession } from "../../../types";
import { examsOverlap } from "./examUtils";

export interface ExamConflict {
  type: "STUDENT" | "ROOM" | "STAFF" | "CAPACITY";
  severity: "CRITICAL" | "WARNING";
  message: string;
  affectedIds: string[];
}

/**
 * Validates a potential move or an existing exam against remaining constraints.
 */
export function validateExamMove(
  exam: ExamSession,
  allExams: ExamSession[],
  data: AppData
): ExamConflict[] {
  const conflicts: ExamConflict[] = [];

  const overlappingExams = allExams.filter(
    (other) => other.id !== exam.id && examsOverlap(exam, other)
  );

  // STUDENT: shared class with overlapping time
  for (const other of overlappingExams) {
    const sharedClass = exam.classIds.find((cid) => other.classIds.includes(cid));
    if (sharedClass) {
      const cls = data.classes.find((c) => c.id === sharedClass);
      conflicts.push({
        type: "STUDENT",
        severity: "CRITICAL",
        message: `Class Conflict: ${cls?.name || "Class"} has overlapping exams on this day.`,
        affectedIds: [other.id],
      });
      break;
    }
  }

  // ROOM CONFLICTS
  if (exam.roomId) {
    const room = data.rooms.find((r) => r.id === exam.roomId);

    const roomClash = overlappingExams.find(
      (other) => other.roomId === exam.roomId
    );
    if (roomClash) {
      conflicts.push({
        type: "ROOM",
        severity: "CRITICAL",
        message: `Room Conflict: ${room?.name || "Selected room"} is already booked.`,
        affectedIds: [roomClash.id],
      });
    }

    if (room && room.capacity) {
      const totalStudents = exam.classIds.reduce((sum, cid) => {
        const cls = data.classes.find((c) => c.id === cid);
        return sum + (cls?.studentCount || 0);
      }, 0);

      if (totalStudents > room.capacity) {
        conflicts.push({
          type: "CAPACITY",
          severity: "WARNING",
          message: `Capacity Warning: ${totalStudents} students exceed ${room.name} limit (${room.capacity}).`,
          affectedIds: [],
        });
      }
    }
  }

  // STAFF CONFLICTS
  if (exam.invigilatorIds && exam.invigilatorIds.length > 0) {
    const staffClash = overlappingExams.find((other) =>
      (other.invigilatorIds || []).some((id) =>
        exam.invigilatorIds?.includes(id)
      )
    );

    if (staffClash) {
      const staffNames = (staffClash.invigilatorIds || [])
        .filter((id) => exam.invigilatorIds?.includes(id))
        .map((id) => data.teachers.find((t) => t.id === id)?.name)
        .join(", ");

      conflicts.push({
        type: "STAFF",
        severity: "CRITICAL",
        message: `Staff Conflict: ${staffNames} is already invigilating elsewhere.`,
        affectedIds: [staffClash.id],
      });
    }
  }

  return conflicts;
}
