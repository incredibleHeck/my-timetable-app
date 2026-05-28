export interface Subject {
  id: string;
  name: string;
  color: string;
  // If true, this subject can only happen once globally per period
  isSingleResource?: boolean;
  isExaminable?: boolean;
  // Room requirements
  requiredRoomId?: string | null;
  preferredRoomIds?: string[];
  requiredRoomType?: string;
  /** When set, drives core-subject scheduling heuristics instead of name matching */
  isCore?: boolean;

  // Exam Configuration Defaults
  examPaperCount?: number;
  examPaperDurations?: number[];
}
