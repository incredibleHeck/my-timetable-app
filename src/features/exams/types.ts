export type ExamStatus = "DRAFT" | "PUBLISHED" | "COMPLETED";

export interface ExamSession {
  id: string;
  subjectId: string;
  classIds: string[];

  // Scheduling
  date: string;
  startTime: string;
  duration: number;

  // Resources
  roomId?: string;
  invigilatorIds?: string[];

  // Multi-Paper Support
  paperNumber: number;
  paperLabel?: string;

  // State
  status: ExamStatus;
  locked?: boolean;
}

export interface ExamRoster {
  id: string;
  name: string;
  exams: ExamSession[];
  createdAt: string;
}
