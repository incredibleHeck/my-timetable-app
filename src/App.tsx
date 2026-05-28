import React, { useState } from "react";
import { useProfile } from "./contexts/ProfileContext";
import { useActivation } from "./hooks/useActivation";
import { FileService } from "./services/fileSystem";
import { Button } from "./components/ui";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { ProfileWizard } from "./features/configuration/components/ProfileWizard";
import { ActivationScreen } from "./features/activation/components/ActivationScreen";
import { ViewRouter, isFullScreenView } from "./routing/ViewRouter";
import { ViewState } from "./types";

function App() {
  const { isActivated, isLoading: isActivationLoading, activate, error: activationError } = useActivation();
  
  const {
    profiles,
    activeProfile,
    isLoading,
    isSaving,
    isDirty,
    createNewProfile,
    switchProfile,
    updateActiveProfile,
  } = useProfile();

  const [view, setView] = useState<ViewState>("DASHBOARD");
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  if (isActivationLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <span className="animate-spin text-2xl text-amber-500">⟳</span>
          <p>Verifying License...</p>
        </div>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <ActivationScreen 
        onActivate={activate} 
        error={activationError} 
        isLoading={false} 
      />
    );
  }

  const autoSaveStatus = isSaving ? "SAVING" : "SAVED";

  const handleExport = async () => {
    if (!activeProfile) return;
    const result = await FileService.saveProject(activeProfile.data, activeProfile.name);
    if (result.success && result.path) {
      setActiveFilePath(result.path);
    }
  };

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

  if (!activeProfile) {
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
      {!isFullScreenView(view) && (
        <Sidebar
          view={view}
          setView={setView}
          onSave={handleExport}
          hasUnsavedChanges={isDirty}
          activeFilePath={activeFilePath}
          activeProfile={activeProfile}
          profiles={profiles}
          onSwitchProfile={switchProfile}
        />
      )}

      <main id="main-content" role="main" className="flex-1 flex flex-col min-w-0">
        <Header
          view={view}
          activeProfile={activeProfile}
          profiles={profiles}
          autoSaveStatus={autoSaveStatus}
          onSwitchProfile={switchProfile}
        />

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          <div className="min-h-full">
            <ViewRouter
              view={view}
              data={activeProfile.data}
              onUpdate={updateActiveProfile}
              onNavigate={setView}
              profileName={activeProfile.name}
            />
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
