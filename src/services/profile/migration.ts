import { Profile } from '../../types/profile';
import { STORAGE_KEY } from '../../utils/constants';
import { saveProfile, init } from './profileStorage';

export const migrateFromLocalStorage = async (): Promise<boolean> => {
    // 1. Check LocalStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    try {
        const parsed = JSON.parse(saved);
        
        let profilesToMigrate: any[] = [];
        if (Array.isArray(parsed)) {
            profilesToMigrate = parsed;
        } else {
            // Assume single AppData or unexpected format, skip or handle differently?
            // For safety, if not array of profiles, we abort or wrap?
            // Existing App.tsx logic suggests it is ALWAYS Profile[] or [DEFAULT_PROFILE].
            // If DEFAULT_PROFILE is there, we migrate it.
             return false;
        }

        // 2. Init Storage
        await init();

        // 3. Migrate each
        for (const oldP of profilesToMigrate) {
             const newP: Profile = {
                 id: oldP.id,
                 name: oldP.name,
                 data: oldP.data,
                 created: oldP.created || Date.now(), // Use existing created if available, else now
                 lastModified: Date.now(),
                 meta: { 
                     description: 'Migrated from LocalStorage',
                     academicYear: oldP.data?.settings?.academicYear
                 }
             };
             await saveProfile(newP);
        }

        // 4. Archive LocalStorage
        localStorage.setItem(STORAGE_KEY + '_MIGRATED', saved);
        localStorage.removeItem(STORAGE_KEY);

        return true;
    } catch (e) {
        console.error("Migration failed", e);
        return false;
    }
};
