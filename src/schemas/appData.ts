import { z } from "zod";
import { AppData, FixedOccasion } from "../types";

const passthroughRecord = z.record(z.string(), z.unknown());

const periodConfigSchema = z
  .object({
    type: z.enum(["CLASS", "BREAK", "LUNCH", "ASSEMBLY"]),
    label: z.string(),
  })
  .passthrough();

const settingsSchema = z
  .object({
    periodsPerDay: z.number(),
    dayStructure: z.array(periodConfigSchema),
    fixedOccasions: z.array(z.array(z.unknown())).optional(),
    timeSlots: z.array(z.object({ start: z.string(), end: z.string() }).passthrough()).optional(),
    maxConsecutivePeriods: z.number(),
  })
  .passthrough();

const appDataInputSchema = z
  .object({
    settings: settingsSchema,
    subjects: z.array(passthroughRecord).optional(),
    teachers: z.array(passthroughRecord).optional(),
    rooms: z.array(passthroughRecord).optional(),
    classes: z.array(passthroughRecord).optional(),
    jointClasses: z.array(passthroughRecord).optional(),
    electives: z.array(passthroughRecord).optional(),
    exams: z.array(passthroughRecord).optional(),
    examRosters: z.array(passthroughRecord).optional(),
    dutyLocations: z.array(passthroughRecord).optional(),
    dutyAssignments: z.array(passthroughRecord).optional(),
    dutyRosters: z.array(passthroughRecord).optional(),
    schedule: z.record(z.unknown()).optional(),
    conflicts: z.array(passthroughRecord).optional(),
    recentActivity: z.array(passthroughRecord).optional(),
    lastGenerated: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough();

type RawAppDataInput = z.infer<typeof appDataInputSchema> & Record<string, unknown>;

const normalizeOccasion = (val: unknown): string | null => {
  if (!val) return null;
  if (val === true) return "Reserved";
  if (typeof val === "string") return val;
  if (typeof val === "object" && val !== null && "name" in val) {
    return (val as { name: string }).name;
  }
  return null;
};

const normalizeOccasions = (grid: FixedOccasion[][] | undefined): FixedOccasion[][] => {
  if (!Array.isArray(grid)) return [];
  return grid.map((row) => (Array.isArray(row) ? row.map(normalizeOccasion) : []));
};

const formatZodError = (error: z.ZodError): string => {
  const issues = error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${path}: ${issue.message}`;
  });
  return `Invalid project data:\n${issues.join("\n")}`;
};

/** Normalize validated raw JSON into a fully populated AppData object. */
export const normalizeAppData = (raw: RawAppDataInput): AppData => {
  const settings = {
    ...raw.settings,
    timeSlots: raw.settings.timeSlots ?? [],
    fixedOccasions: normalizeOccasions(
      raw.settings.fixedOccasions as FixedOccasion[][] | undefined,
    ),
  };

  const classes = Array.isArray(raw.classes)
    ? raw.classes.map((c) => {
        const cls = c as Record<string, unknown>;
        return {
          ...cls,
          ...(cls.fixedSessions
            ? { fixedSessions: normalizeOccasions(cls.fixedSessions as FixedOccasion[][]) }
            : {}),
        };
      })
    : [];

  return {
    settings,
    subjects: Array.isArray(raw.subjects) ? (raw.subjects as unknown as AppData["subjects"]) : [],
    teachers: Array.isArray(raw.teachers) ? (raw.teachers as unknown as AppData["teachers"]) : [],
    rooms: Array.isArray(raw.rooms) ? (raw.rooms as unknown as AppData["rooms"]) : [],
    classes: classes as AppData["classes"],
    jointClasses: Array.isArray(raw.jointClasses)
      ? (raw.jointClasses as unknown as AppData["jointClasses"])
      : [],
    electives: Array.isArray(raw.electives)
      ? (raw.electives as unknown as AppData["electives"])
      : [],
    examRosters: Array.isArray(raw.examRosters)
      ? (raw.examRosters as unknown as AppData["examRosters"])
      : [],
    exams:
      Array.isArray(raw.examRosters) && raw.examRosters.length > 0
        ? []
        : Array.isArray(raw.exams)
          ? (raw.exams as unknown as AppData["exams"])
          : [],
    dutyLocations: Array.isArray(raw.dutyLocations)
      ? (raw.dutyLocations as unknown as AppData["dutyLocations"])
      : [],
    dutyAssignments: Array.isArray(raw.dutyAssignments)
      ? (raw.dutyAssignments as unknown as AppData["dutyAssignments"])
      : [],
    dutyRosters: Array.isArray(raw.dutyRosters)
      ? (raw.dutyRosters as unknown as AppData["dutyRosters"])
      : [],
    schedule:
      typeof raw.schedule === "object" && raw.schedule ? (raw.schedule as AppData["schedule"]) : {},
    conflicts: Array.isArray(raw.conflicts)
      ? (raw.conflicts as unknown as AppData["conflicts"])
      : [],
    recentActivity: Array.isArray(raw.recentActivity)
      ? (raw.recentActivity as unknown as AppData["recentActivity"])
      : [],
    lastGenerated: raw.lastGenerated ?? null,
  };
};

/** Validate and normalize unknown JSON into AppData. */
export const parseAppData = (raw: unknown): AppData => {
  const result = appDataInputSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(formatZodError(result.error));
  }
  return normalizeAppData(result.data);
};

export { appDataInputSchema };
