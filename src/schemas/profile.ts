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
    data: normalizeAppData(parsed.data),
    meta: parsed.meta as ProfileMetadata,
  };
};
