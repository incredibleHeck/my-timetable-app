import { Profile } from "../../types/profile";
import { STORAGE_KEY } from "../../utils/constants";
import { init, saveProfile } from "./profileStorage";

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
      const newP: Profile = {
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
      await saveProfile(newP);
    }

    localStorage.setItem(`${STORAGE_KEY}_MIGRATED`, saved);
    localStorage.removeItem(STORAGE_KEY);

    return true;
  } catch (e) {
    console.error("Migration failed", e);
    return false;
  }
};
