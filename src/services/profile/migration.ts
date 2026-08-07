import { Profile } from "../../types/profile";
import { STORAGE_KEY } from "../../utils/constants";
import { init, saveProfile } from "./profileStorage";
import { runProfileMigrations } from "./migrations";
import { parseProfile } from "../../schemas/profile";

interface LegacyStoredProfile {
  id: string;
  name: string;
  data: Profile["data"];
  created?: number;
}

export const migrateFromLocalStorage = async (): Promise<boolean> => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;

  try {
    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      return false;
    }

    const profilesToMigrate = parsed.filter(
      (entry): entry is LegacyStoredProfile =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as LegacyStoredProfile).id === "string" &&
        typeof (entry as LegacyStoredProfile).name === "string",
    );

    if (profilesToMigrate.length === 0) {
      return false;
    }

    await init();

    for (const oldP of profilesToMigrate) {
      // Deliberately built WITHOUT schemaVersion. This payload predates
      // versioning, so it is v0 by definition and the chain decides what it
      // becomes. Hardcoding the current version here would stamp un-migrated
      // data as up to date, and every later read would then skip it.
      const legacyShaped = {
        id: oldP.id,
        name: oldP.name,
        data: oldP.data,
        created: oldP.created ?? Date.now(),
        lastModified: Date.now(),
        meta: {
          description: "Migrated from LocalStorage",
          academicYear: oldP.data?.settings?.academicYear,
        },
      };

      try {
        await saveProfile(parseProfile(runProfileMigrations(legacyShaped)));
      } catch (err) {
        // One malformed profile must not abort the rest of the migration.
        console.error(`Skipped migrating profile ${oldP.id}:`, err);
      }
    }

    localStorage.setItem(`${STORAGE_KEY}_MIGRATED`, saved);
    localStorage.removeItem(STORAGE_KEY);

    return true;
  } catch (e) {
    console.error("Migration failed", e);
    return false;
  }
};
