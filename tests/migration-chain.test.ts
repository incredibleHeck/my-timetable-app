import { describe, it, expect } from "vitest";
import { runProfileMigrations, ProfileSchemaTooNewError } from "../src/services/profile/migrations";
import { CURRENT_SCHEMA_VERSION } from "../src/types/profile";
import { DEFAULT_DATA } from "../src/utils/constants";
import { parseProfile } from "../src/schemas/profile";

describe("Profile Schema Migration Chain", () => {
  it("migrates un-versioned legacy v0 profile to CURRENT_SCHEMA_VERSION (v1)", () => {
    const legacyProfile = {
      id: "legacy-1",
      name: "Legacy School",
      created: 1700000000000,
      lastModified: 1700000005000,
      data: DEFAULT_DATA,
      meta: {},
    };

    const migrated = runProfileMigrations(legacyProfile) as any;

    expect(migrated).toBeDefined();
    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.id).toBe("legacy-1");
    expect(migrated.name).toBe("Legacy School");

    const parsed = parseProfile(migrated);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("passes an already up-to-date profile through unchanged", () => {
    const currentProfile = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      id: "current-1",
      name: "Current School",
      created: 1700000000000,
      lastModified: 1700000005000,
      data: DEFAULT_DATA,
      meta: {},
    };

    const migrated = runProfileMigrations(currentProfile) as any;

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrated.id).toBe("current-1");
  });

  it("does not let parseProfile alone stamp a legacy profile as current", () => {
    // Regression guard. parseProfile defaulting to CURRENT_SCHEMA_VERSION would
    // mark un-migrated v0 data as up to date, so the chain would skip it forever
    // on every later read. Parsing must never be mistaken for migrating.
    const legacyProfile = {
      id: "legacy-2",
      name: "Unmigrated School",
      created: 1700000000000,
      lastModified: 1700000005000,
      data: DEFAULT_DATA,
      meta: {},
    };

    const parsedWithoutMigrating = parseProfile(legacyProfile);
    expect(parsedWithoutMigrating.schemaVersion).toBe(0);

    // Running the chain is what actually brings it up to date.
    const parsedAfterMigrating = parseProfile(runProfileMigrations(legacyProfile));
    expect(parsedAfterMigrating.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("throws a typed error so callers can tell 'too new' from 'not found'", () => {
    const futureProfile = {
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      id: "future-2",
      name: "Future School",
      created: 1700000000000,
      lastModified: 1700000005000,
      data: DEFAULT_DATA,
      meta: {},
    };

    expect(() => runProfileMigrations(futureProfile)).toThrow(ProfileSchemaTooNewError);
  });

  it("throws a clear user-facing error when attempting to load a future schema version", () => {
    const futureProfile = {
      schemaVersion: 999,
      id: "future-1",
      name: "Future School",
      created: 1700000000000,
      lastModified: 1700000005000,
      data: DEFAULT_DATA,
      meta: {},
    };

    // The message is shown to the user verbatim in a toast, so assert it names
    // both versions and says what to do — not just that it threw.
    expect(() => runProfileMigrations(futureProfile)).toThrowError(
      /saved by a newer version of EduScheduler Pro/i,
    );
    expect(() => runProfileMigrations(futureProfile)).toThrowError(/v999/);
    expect(() => runProfileMigrations(futureProfile)).toThrowError(/update the app/i);
  });
});
