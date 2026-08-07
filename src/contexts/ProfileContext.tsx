import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { Profile, ProfileManifest, CURRENT_SCHEMA_VERSION } from "../types/profile";
import { AppData, Activity, ActivityType } from "../types";
import * as ProfileStorage from "../services/profile/profileStorage";
import * as Migration from "../services/profile/migration";
import { ProfileSchemaTooNewError } from "../services/profile/migrations";
import { generateId, deepClone, mergeWithDefaults } from "../utils/utils";
import { DEFAULT_DATA } from "../utils/constants";
import { notify } from "../components/ui/Toast";
import { calculateClassSchedule } from "../utils/timeUtils";
import { TimeSlot } from "../types";
import { auditFinalSchedule } from "../features/generator/scheduler/validation";
import { syncHomeRooms } from "../features/classes/utils";
import { useProfileHistory } from "./useProfileHistory";
import { HistoryProvider } from "./HistoryContext";
import { isTauriEnv } from "../utils/platform";

interface ProfileContextType {
  profiles: ProfileManifest["profiles"];
  activeProfile: Profile | null;
  isLoading: boolean;
  isSaving: boolean;
  isDirty: boolean;
  createNewProfile: (name: string, templateData?: AppData) => Promise<void>;
  switchProfile: (id: string) => Promise<void>;
  updateActiveProfile: (data: AppData) => void;
  addActivity: (type: ActivityType, message: string, dataToUpdate?: AppData) => void;
  reloadProfiles: () => Promise<void>;
  getClassSchedule: (classId: string) => TimeSlot[];
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profiles, setProfiles] = useState<ProfileManifest["profiles"]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeProfileRef = useRef<Profile | null>(null);

  useEffect(() => {
    activeProfileRef.current = activeProfile;
  }, [activeProfile]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        // Web: IndexedDB writes can't complete synchronously on unload, so drop
        // a synchronous localStorage snapshot that init() reconciles next load.
        if (!isTauriEnv() && activeProfileRef.current) {
          ProfileStorage.flushProfileEmergency(activeProfileRef.current);
        }

        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    let isCancelled = false;
    let tauriUnlisten: (() => void) | undefined;

    if (isTauriEnv()) {
      import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
        if (isCancelled) return;
        const appWindow = getCurrentWindow();
        appWindow
          .onCloseRequested(async (event) => {
            if (isDirty && activeProfileRef.current) {
              event.preventDefault();
              try {
                setIsSaving(true);
                await ProfileStorage.saveProfile(activeProfileRef.current);
                setIsDirty(false);
              } catch (err) {
                console.error("Failed to flush tauri save on window close:", err);
              }
              appWindow.close();
            }
          })
          .then((unlistenFn) => {
            if (isCancelled) {
              unlistenFn();
            } else {
              tauriUnlisten = unlistenFn;
            }
          });
      });
    }

    return () => {
      isCancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (tauriUnlisten) {
        tauriUnlisten();
      }
    };
  }, [isDirty]);

  const triggerSave = useCallback((updatedProfile: Profile) => {
    setIsDirty(true);
    setIsSaving(true);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await ProfileStorage.saveProfile(updatedProfile);
        setIsDirty(false);
      } catch (error) {
        console.error("Failed to auto-save profile:", error);
        const errMsg = error instanceof Error ? error.message : String(error);
        if (errMsg.includes("QuotaExceededError")) {
          notify(
            "Local storage is full! Please export your data and delete old profiles.",
            "error",
          );
        } else {
          notify("Failed to save changes automatically. Check disk space or permissions.", "error");
        }
      } finally {
        setIsSaving(false);
      }
    }, 1000);
  }, []);

  const applyState = useCallback(
    (data: AppData) => {
      const profile = activeProfileRef.current;
      if (!profile) return;

      const working = deepClone(data);
      const { updatedClasses, updatedRooms } = syncHomeRooms(working.classes, working.rooms);
      working.classes = updatedClasses;
      working.rooms = updatedRooms;

      const auditMode = working.lastGenerated ? "generated" : "full";
      const auditInput: AppData = { ...working, conflicts: [] };
      const conflicts = auditFinalSchedule(auditInput, { mode: auditMode });
      const validatedData: AppData = { ...auditInput, conflicts };

      const updated = {
        ...profile,
        data: validatedData,
        lastModified: Date.now(),
      };
      setActiveProfile(updated);
      activeProfileRef.current = updated;
      triggerSave(updated);
    },
    [triggerSave],
  );

  const getCurrentData = useCallback(() => activeProfileRef.current?.data ?? null, []);

  const { pushToHistory, undo, redo, canUndo, canRedo, resetHistory } = useProfileHistory({
    getCurrentData,
    applyData: applyState,
  });

  const reloadProfiles = async () => {
    const list = await ProfileStorage.listProfiles();
    setProfiles(list);
  };

  const loadActiveProfile = async (id: string) => {
    setIsLoading(true);
    let profile: Profile | null;
    try {
      profile = await ProfileStorage.loadProfile(id);
    } catch (error) {
      if (error instanceof ProfileSchemaTooNewError) {
        notify(error.message, "error");
        setIsLoading(false);
        return;
      }
      throw error;
    }
    if (profile) {
      profile.data = mergeWithDefaults(profile.data, DEFAULT_DATA);

      const { updatedClasses, updatedRooms } = syncHomeRooms(
        profile.data.classes,
        profile.data.rooms,
      );
      profile.data.classes = updatedClasses;
      profile.data.rooms = updatedRooms;

      setActiveProfile(profile);
      activeProfileRef.current = profile;
      await ProfileStorage.setActiveProfile(id);
      resetHistory();
    }
    setIsLoading(false);
  };

  const init = async () => {
    setIsLoading(true);
    try {
      await Migration.migrateFromLocalStorage();
      await ProfileStorage.init();

      const list = await ProfileStorage.listProfiles();
      setProfiles(list);

      const activeId = await ProfileStorage.getActiveProfileId();
      if (activeId) {
        await loadActiveProfile(activeId);
      } else if (list.length > 0) {
        await loadActiveProfile(list[0].id);
      } else {
        setIsLoading(false);
      }
    } catch (e) {
      console.error("Profile Init Failed", e);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNewProfile = async (name: string, templateData?: AppData) => {
    try {
      const newProfile: Profile = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        id: generateId(),
        name,
        created: Date.now(),
        lastModified: Date.now(),
        data: templateData ? deepClone(templateData) : deepClone(DEFAULT_DATA),
        meta: {},
      };

      await ProfileStorage.saveProfile(newProfile);
      await reloadProfiles();
      await switchProfile(newProfile.id);
    } catch (error) {
      console.error("Failed to create new profile:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.includes("QuotaExceededError")) {
        notify(
          "Failed to create new profile. Local storage is full! Please export and delete old profiles.",
          "error",
        );
      } else {
        notify("Failed to create new profile.", "error");
      }
    }
  };

  const switchProfile = async (id: string) => {
    if (saveTimeoutRef.current || isDirty) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (activeProfileRef.current) {
        try {
          await ProfileStorage.saveProfile(activeProfileRef.current);
          setIsDirty(false);
        } catch (error) {
          console.error("Failed to save profile on switch:", error);
          const errMsg = error instanceof Error ? error.message : String(error);
          if (errMsg.includes("QuotaExceededError")) {
            notify("Failed to save changes before switching. Local storage is full!", "error");
          } else {
            notify("Failed to save changes before switching profiles.", "error");
          }
        }
      }
    }
    resetHistory();
    await loadActiveProfile(id);
  };

  const updateActiveProfile = (data: AppData) => {
    if (!activeProfileRef.current) return;
    applyState(data);
  };

  const addActivity = (type: ActivityType, message: string, dataToUpdate?: AppData) => {
    if (!activeProfileRef.current) return;

    const newActivity: Activity = {
      id: generateId(),
      type,
      message,
      timestamp: new Date().toISOString(),
    };

    const currentData = dataToUpdate || activeProfileRef.current.data;

    const updatedData = {
      ...currentData,
      recentActivity: [newActivity, ...(currentData.recentActivity || [])].slice(0, 50),
    };

    updateActiveProfile(updatedData);
  };

  const getClassSchedule = (classId: string): TimeSlot[] => {
    const profile = activeProfileRef.current;
    if (!profile) return [];

    const classGroup = profile.data.classes.find((c) => c.id === classId);
    if (!classGroup) return [];

    return calculateClassSchedule(
      classGroup,
      profile.data.settings,
      profile.data.settings.dayStructure,
    );
  };

  return (
    <ProfileContext.Provider
      value={{
        profiles,
        activeProfile,
        isLoading,
        isSaving,
        isDirty,
        createNewProfile,
        switchProfile,
        updateActiveProfile,
        addActivity,
        reloadProfiles,
        getClassSchedule,
      }}
    >
      <HistoryProvider value={{ pushToHistory, undo, redo, canUndo, canRedo }}>
        {children}
      </HistoryProvider>
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
};
