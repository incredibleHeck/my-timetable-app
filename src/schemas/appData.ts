import { z } from "zod";
import { AppData, FixedOccasion, Subject, Teacher, Room, ClassGroup, JointClass, ElectiveBlock } from "../types";

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

const subjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    isSingleResource: z.boolean().optional(),
    isExaminable: z.boolean().optional(),
    requiredRoomId: z.string().nullable().optional(),
    preferredRoomIds: z.array(z.string()).optional(),
    requiredRoomType: z.string().optional(),
    isCore: z.boolean().optional(),
    examPaperCount: z.number().optional(),
    examPaperDurations: z.array(z.number()).optional(),
  })
  .passthrough();

const teacherSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    specialtyIds: z.array(z.string()),
    constraints: z.array(z.array(z.boolean())),
    targetLoad: z.number().optional(),
    maxPeriodsPerDay: z.number().optional(),
  })
  .passthrough();

const roomSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    capacity: z.number(),
    type: z.string(),
    isHomeRoom: z.boolean().optional(),
  })
  .passthrough();

const curriculumItemSchema = z
  .object({
    id: z.string(),
    subjectId: z.string(),
    periodsPerWeek: z.number(),
    singles: z.number(),
    doubles: z.number(),
    assignedTeacherId: z.string().nullish().transform(v => v ?? undefined),
    isWorkloadExempt: z.boolean().optional(),
  })
  .passthrough();

const classGroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    level: z.string().optional(),
    classroomId: z.string().nullish().transform(v => v ?? undefined),
    defaultRoomId: z.string(),
    studentCount: z.number().optional(),
    curriculum: z.array(curriculumItemSchema),
    periodCount: z.number().optional(),
    structure: z.array(z.union([z.string(), periodConfigSchema])).optional(),
    duration: z.number().optional(),
    breakDuration: z.number().optional(),
    lunchDuration: z.number().optional(),
    fixedSessions: z.array(z.array(z.unknown())).optional(),
  })
  .passthrough();

const jointClassSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    subjectId: z.string(),
    classIds: z.array(z.string()),
    teacherId: z.string().nullish().transform(v => v ?? undefined),
  })
  .passthrough();

const electiveBlockSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    classIds: z.array(z.string()),
    subjectIds: z.array(z.string()),
    allowedPeriods: z.array(z.object({ day: z.number(), period: z.number() })).optional(),
  })
  .passthrough();

const appDataInputSchema = z
  .object({
    settings: settingsSchema,
    subjects: z.array(subjectSchema).optional(),
    teachers: z.array(teacherSchema).optional(),
    rooms: z.array(roomSchema).optional(),
    classes: z.array(classGroupSchema).optional(),
    jointClasses: z.array(jointClassSchema).optional(),
    electives: z.array(electiveBlockSchema).optional(),
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
    subjects: (raw.subjects ?? []) as Subject[],
    teachers: (raw.teachers ?? []) as Teacher[],
    rooms: (raw.rooms ?? []) as Room[],
    classes: classes as ClassGroup[],
    jointClasses: (raw.jointClasses ?? []) as JointClass[],
    electives: (raw.electives ?? []) as ElectiveBlock[],
    examRosters: (raw.examRosters ?? []) as unknown as AppData["examRosters"],
    exams:
      Array.isArray(raw.examRosters) && raw.examRosters.length > 0
        ? []
        : ((raw.exams ?? []) as unknown as AppData["exams"]),
    dutyLocations: (raw.dutyLocations ?? []) as unknown as AppData["dutyLocations"],
    dutyAssignments: (raw.dutyAssignments ?? []) as unknown as AppData["dutyAssignments"],
    dutyRosters: (raw.dutyRosters ?? []) as unknown as AppData["dutyRosters"],
    schedule:
      typeof raw.schedule === "object" && raw.schedule ? (raw.schedule as AppData["schedule"]) : {},
    conflicts: (raw.conflicts ?? []) as unknown as AppData["conflicts"],
    recentActivity: (raw.recentActivity ?? []) as unknown as AppData["recentActivity"],
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
