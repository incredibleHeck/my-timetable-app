export interface Subject {
  id: string;
  name: string;
  color: string;
  // If true, this subject can only happen once globally per period
  isSingleResource?: boolean;
  isExaminable?: boolean;
  // Room requirements
  preferredRoomIds?: string[];
  requiredRoomType?: string;

  // Exam Configuration Defaults
  examPaperCount?: number;
  examPaperDurations?: number[];
}
