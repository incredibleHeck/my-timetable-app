import { CURRENT_SCHEMA_VERSION } from "../../../types/profile";
import { migrateV0ToV1 } from "./v0-to-v1";

type MigrationFn = (raw: Record<string, unknown>) => Record<string, unknown>;

/** Sequential migration chain indexed by target version - 1 (v0->v1 is at index 0) */
const MIGRATION_CHAIN: MigrationFn[] = [migrateV0ToV1];

/**
 * Thrown when a profile was written by a newer build than the one running.
 * Typed so callers can tell it apart from "file missing" and surface the
 * message instead of silently dropping the profile.
 */
export class ProfileSchemaTooNewError extends Error {
  readonly foundVersion: number;
  readonly supportedVersion: number;

  constructor(foundVersion: number, supportedVersion: number) {
    super(
      `This profile was saved by a newer version of EduScheduler Pro ` +
        `(format v${foundVersion}; this build supports up to v${supportedVersion}). ` +
        `Update the app to open it.`,
    );
    this.name = "ProfileSchemaTooNewError";
    this.foundVersion = foundVersion;
    this.supportedVersion = supportedVersion;
  }
}

/**
 * Walks a loaded raw profile object from its stamped version up to
 * CURRENT_SCHEMA_VERSION. An absent or non-numeric `schemaVersion` is treated
 * as v0 — that covers every profile written before versioning existed.
 *
 * Every read path must run this before {@link parseProfile}; parsing alone does
 * not migrate, and a profile that skips the chain keeps its old shape.
 */
export function runProfileMigrations(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const rawObj = raw as Record<string, unknown>;
  const version =
    typeof rawObj.schemaVersion === "number" && Number.isFinite(rawObj.schemaVersion)
      ? rawObj.schemaVersion
      : 0;

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new ProfileSchemaTooNewError(version, CURRENT_SCHEMA_VERSION);
  }

  let currentVersion = version;
  let data = { ...rawObj };

  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migrationFn = MIGRATION_CHAIN[currentVersion];
    if (!migrationFn) {
      throw new Error(
        `Missing migration step for profile schema v${currentVersion} -> v${currentVersion + 1}`,
      );
    }
    data = migrationFn(data);
    currentVersion++;
  }

  return data;
}
