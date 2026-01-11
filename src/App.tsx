import React, { useState } from "react";
import { AppData, ViewState } from "./types";
import { DEFAULT_DATA } from "./utils/constants";
import { FileService } from "./services/fileSystem";
import { useProfile } from "./contexts/ProfileContext";

// Views
import { DashboardView } from "./features/dashboard/DashboardView";
import { GlobalConfigView } from "./features/configuration/GlobalConfigView";
import { SubjectsView } from "./features/subjects/SubjectsView";
import { RoomsView } from "./features/rooms/RoomsView";
import { TeachersView } from "./features/teachers/TeachersView";
import { ClassesView } from "./features/classes/ClassesView";
import { WorkloadView } from "./features/workload/WorkloadView";
import { GeneratorView } from "./features/generator/GeneratorView";
import { ExamsView } from "./features/exams/ExamsView";
import { DutyView } from "./features/duty/DutyView";

// UI
import { Button, Modal, Input } from "./components/ui";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ProfileWizard } from "./features/configuration/components/ProfileWizard";

function App() {
  // --- CONTEXT ---
  const { 
    profiles, 
    activeProfile, 
    isLoading, 
    isSaving,
    createNewProfile, 
    switchProfile, 
    updateActiveProfile 
  } = useProfile();

  // --- LOCAL STATE ---
  const [view, setView] = useState<ViewState>("DASHBOARD");
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // --- DERIVED STATE ---
  const isFullScreen = view === "GENERATOR" || view === "EXAMS" || view === "DUTY";
  const autoSaveStatus = isSaving ? "SAVING" : "SAVED";

  // --- ACTIONS ---
  const updateActiveData = (newData: AppData) => {
    updateActiveProfile(newData);
  };

  // --- FIX: Updated to use new FileService API ---
  const handleExport = async () => {
    if (!activeProfile) return;
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

          // Create new profile with imported data
          await createNewProfile(`Imported ${new Date().toLocaleDateString()}`, json);
        } catch (err) {
          alert("Error reading file: " + err);
        }
      };
      input.click();
    } else {
      // DESKTOP: Native Dialog
      const result = await FileService.loadProjectNative();
      if (result.data) {
        // Create new profile with imported data
        await createNewProfile(`Imported ${new Date().toLocaleDateString()}`, result.data);
        setActiveFilePath(result.path);
      }
    }
  };

  // --- RENDER ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 text-slate-400">
        <div className="flex flex-col items-center gap-2">
            <span className="animate-spin text-2xl">⟳</span>
            <p>Loading Profiles...</p>
        </div>
      </div>
    );
  }

  // If no profile active (and not loading), create one or show empty state?
  // ProfileProvider attempts to load one. If list empty, it stops loading.
  // We should enforce at least one profile or show a "Welcome" screen.
  if (!activeProfile) {
     // Fallback: This shouldn't happen often if we auto-create default, but good for safety
     return (
        <div className="flex items-center justify-center h-screen bg-slate-50">
             <div className="text-center">
                 <h1 className="text-2xl font-bold text-slate-800 mb-4">Welcome to EduScheduler Pro</h1>
                 <Button onClick={() => setIsCreateModalOpen(true)}>Create First Profile</Button>
             </div>
             
             <ProfileWizard 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)} 
                onCreate={createNewProfile} 
             />
        </div>
     );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-600 overflow-hidden">
      {/* LEFT SIDEBAR - Hidden in Generator View for Full Screen */}
      {!isFullScreen && (
        <Sidebar
          view={view}
          setView={setView}
          onSave={handleExport}
          hasUnsavedChanges={isSaving}
          activeFilePath={activeFilePath}
          activeProfile={activeProfile}
          profiles={profiles}
          onSwitchProfile={switchProfile}
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
          onSwitchProfile={switchProfile}
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
            {view === "ROOMS" && (
              <RoomsView
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
            {view === "EXAMS" && (
              <ExamsView
                data={activeProfile.data}
                onUpdate={updateActiveData}
                onNavigate={setView}
              />
            )}
            {view === "DUTY" && (
              <DutyView
                data={activeProfile.data}
                onUpdate={updateActiveData}
                onNavigate={setView}
              />
            )}
          </div>
        </div>
      </main>

      <ProfileWizard 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onCreate={createNewProfile} 
      />
    </div>
  );
}

export default App;