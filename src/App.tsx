import React, { useState, useEffect, useRef } from "react";
import { AppData, Profile, ViewState } from "./types";
import { DEFAULT_DATA, DEFAULT_PROFILE, STORAGE_KEY } from "./utils/constants";
import { generateId } from "./utils/utils";
import { FileService } from "./services/fileSystem";

// Views
import { DashboardView } from "./features/dashboard/DashboardView";
import { GlobalConfigView } from "./features/configuration/GlobalConfigView";
import { SubjectsView } from "./features/subjects/SubjectsView";
import { TeachersView } from "./features/teachers/TeachersView";
import { ClassesView } from "./features/classes/ClassesView";
import { WorkloadView } from "./features/workload/WorkloadView";
import { GeneratorView } from "./features/generator/GeneratorView";

// UI
import { Button, Modal, Input } from "./components/ui";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";

const loadState = (): Profile[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // Explicitly check for "undefined" string to avoid SyntaxError
    if (!saved || saved === "undefined") return [DEFAULT_PROFILE];
    return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load state", e);
    return [DEFAULT_PROFILE];
  }
};

const saveState = (profiles: Profile[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    return true;
  } catch (e) {
    return false;
  }
};

function App() {
  // --- STATE ---
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>("");
  const [view, setView] = useState<ViewState>("DASHBOARD");

  // Persistence & File System
  const [autoSaveStatus, setAutoSaveStatus] = useState<"SAVED" | "SAVING">(
    "SAVED"
  );
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  // --- INIT ---
  useEffect(() => {
    const loaded = loadState();
    setProfiles(loaded);
    if (loaded.length > 0) setActiveProfileId(loaded[0].id);
  }, []);

  // --- DERIVED STATE ---
  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ||
    profiles[0] ||
    DEFAULT_PROFILE;
  const isFullScreen = view === "GENERATOR";

  // --- ACTIONS ---
  const updateActiveData = (newData: AppData) => {
    setAutoSaveStatus("SAVING");

    setProfiles((prev) => {
      const updated = prev.map((p) =>
        p.id === activeProfileId ? { ...p, data: newData } : p
      );

      // Debounce Save to LocalStorage
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveState(updated);
        setAutoSaveStatus("SAVED");
      }, 1000) as unknown as number;

      return updated;
    });
  };

  const handleCreateProfile = () => {
    if (!newProfileName.trim()) return;
    const newProfile: Profile = {
      id: generateId(),
      name: newProfileName,
      // Safeguard deep clone against undefined
      data: JSON.parse(JSON.stringify(DEFAULT_DATA || {})),
    };
    const updated = [...profiles, newProfile];
    setProfiles(updated);
    saveState(updated);
    setActiveProfileId(newProfile.id);
    setIsCreateModalOpen(false);
    setNewProfileName("");
  };

  // --- FIX: Updated to use new FileService API ---
  const handleExport = async () => {
    // Save the DATA, not the Profile wrapper
    const result = await FileService.saveProject(
      activeProfile.data,
      activeProfile.name
    );
    if (result.success && result.path) {
      setActiveFilePath(result.path);
    }
  };

  // --- FIX: Updated to use new FileService API ---
  const handleImport = async () => {
    if (!FileService.isTauri) {
      // WEB: Create hidden input
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async (e: any) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          // Use helper to parse and validate
          const json = await FileService.parseJsonFile(file);

          // Wrap the imported Data into a new Profile
          const newProfile: Profile = {
            id: generateId(),
            name: `Imported ${new Date().toLocaleDateString()}`,
            data: json,
          };

          const updated = [...profiles, newProfile];
          setProfiles(updated);
          saveState(updated);
          setActiveProfileId(newProfile.id);
        } catch (err) {
          alert("Error reading file: " + err);
        }
      };
      input.click();
    } else {
      // DESKTOP: Native Dialog
      const result = await FileService.loadProjectNative();
      if (result.data) {
        // Wrap the imported Data into a new Profile
        const newProfile: Profile = {
          id: generateId(),
          name: `Imported ${new Date().toLocaleDateString()}`,
          data: result.data,
        };

        const updated = [...profiles, newProfile];
        setProfiles(updated);
        saveState(updated);
        setActiveProfileId(newProfile.id);
        setActiveFilePath(result.path);
      }
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-600 overflow-hidden">
      {/* LEFT SIDEBAR - Hidden in Generator View for Full Screen */}
      {!isFullScreen && (
        <Sidebar
          view={view}
          setView={setView}
          onSave={handleExport}
          hasUnsavedChanges={autoSaveStatus === "SAVING"}
          activeFilePath={activeFilePath}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* TOP HEADER */}
        <Header
          view={view}
          activeProfile={activeProfile}
          profiles={profiles}
          autoSaveStatus={autoSaveStatus}
          onSwitchProfile={setActiveProfileId}
          onCreateProfile={() => setIsCreateModalOpen(true)}
          onImport={handleImport}
          onExport={handleExport}
        />

        {/* SCROLLABLE VIEW AREA */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="min-h-full">
            {view === "DASHBOARD" && (
              <DashboardView
                data={activeProfile.data}
                onUpdate={updateActiveData}
                profileName={activeProfile.name}
                onNavigate={setView}
              />
            )}
            {view === "CONFIG" && (
              <GlobalConfigView
                data={activeProfile.data}
                onUpdate={updateActiveData}
              />
            )}
            {view === "SUBJECTS" && (
              <SubjectsView
                data={activeProfile.data}
                onUpdate={updateActiveData}
              />
            )}
            {view === "TEACHERS" && (
              <TeachersView
                data={activeProfile.data}
                onUpdate={updateActiveData}
              />
            )}
            {view === "CLASSES" && (
              <ClassesView
                data={activeProfile.data}
                onUpdate={updateActiveData}
              />
            )}
            {view === "WORKLOAD" && (
              <WorkloadView
                data={activeProfile.data}
                onUpdate={updateActiveData}
              />
            )}
            {view === "GENERATOR" && (
              <GeneratorView
                data={activeProfile.data}
                onUpdate={updateActiveData}
                onNavigate={setView}
              />
            )}
          </div>
        </div>
      </main>

      {/* GLOBAL MODALS */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Profile"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateProfile}>Create Profile</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Create a clean slate for a new semester or academic year.
          </p>
          <Input
            label="Profile Name"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="e.g. 2nd Semester 2025"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleCreateProfile()}
          />
        </div>
      </Modal>
    </div>
  );
}

export default App;
