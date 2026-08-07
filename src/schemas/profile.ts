import { z } from "zod";
import { Profile, ProfileMetadata } from "../types/profile";
import { appDataInputSchema, normalizeAppData } from "./appData";

export const profileMetadataSchema = z
  .object({
    description: z.string().optional(),
    academicYear: z.string().optional(),
  })
  .passthrough();

export const profileSchema = z.object({
  schemaVersion: z.number().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  created: z.number(),
  lastModified: z.number(),
  data: appDataInputSchema,
  meta: profileMetadataSchema,
});

export const validateProfile = (data: unknown): data is Profile => {
  return profileSchema.safeParse(data).success;
};

export const parseProfile = (raw: unknown): Profile => {
  const result = profileSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid profile: ${issues}`);
  }
  const parsed = result.data;
  return {
    ...parsed,
    // Default to 0 (legacy), never to CURRENT: parsing is not migrating. A
    // profile that reaches here without runProfileMigrations must stay visibly
    // un-migrated rather than be falsely stamped as up to date.
    schemaVersion: parsed.schemaVersion ?? 0,
    data: normalizeAppData(parsed.data),
    meta: parsed.meta as ProfileMetadata,
  };
};
