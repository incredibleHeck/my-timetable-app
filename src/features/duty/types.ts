export interface DutyLocation {
  id: string;
  name: string;
}

export interface DutyAssignment {
  id: string;
  locationId: string;
  teacherId: string;
  classId?: string;
  day: number;
  period: number;
}

export interface DutyRoster {
  id: string;
  name: string;
  type: "DAILY" | "WEEKLY";
  // Independent Storage
  dailyAssignments: DutyAssignment[];
  weeklyAssignments: DutyAssignment[];
  // Independent Parameters
  dailyParams: { min: number; max: number };
  weeklyParams: { min: number; max: number; weeks: number };
  createdAt: string;
}
