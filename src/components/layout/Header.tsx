import React from "react";
import { Save, Globe } from "lucide-react";
import { ViewState } from "../../types";
import { isTauriEnv } from "../../utils/platform";

const VIEW_TITLES: Record<ViewState, string> = {
  DASHBOARD: "Dashboard",
  CONFIG: "Configuration",
  SUBJECTS: "Subjects",
  TEACHERS: "Teachers",
  ROOMS: "Rooms",
  CLASSES: "Classes",
  WORKLOAD: "Workload Analysis",
  GENERATOR: "Auto-Generator",
  EXAMS: "Exam Timetable",
  DUTY: "Duty Roster",
};
import { UndoRedoControls } from "./UndoRedoControls";
import { ProfileSwitcher } from "./header/ProfileSwitcher";

interface HeaderProps {
  view: ViewState;
  activeProfile: { id: string; name: string };
  profiles: { id: string; name: string }[];
  autoSaveStatus: "SAVED" | "SAVING";
  onSwitchProfile: (id: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  view,
  activeProfile,
  profiles,
  autoSaveStatus,
  onSwitchProfile,
}) => {
  const isTauri = isTauriEnv();

  const title = VIEW_TITLES[view] ?? view;

  return (
    <header
      className={`h-16 border-b flex items-center justify-between px-8 shadow-sm z-10 transition-colors ${
        isTauri ? "bg-white border-slate-200" : "bg-slate-50 border-blue-100"
      }`}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>

        {!isTauri && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-200">
            <Globe size={12} />
            Web Mode
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Auto-Save Indicator */}
        <div
          className={`text-xs font-bold transition-all duration-300 flex items-center gap-2 px-3 py-1.5 rounded-full ${
            autoSaveStatus === "SAVED" ? "text-slate-400" : "bg-amber-50 text-amber-600"
          }`}
        >
          {autoSaveStatus === "SAVING" ? (
            <span className="animate-spin">⟳</span>
          ) : (
            <Save size={12} />
          )}
          {autoSaveStatus === "SAVED" ? "Saved" : "Saving..."}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        <UndoRedoControls />

        <div className="h-6 w-px bg-slate-200 mx-2"></div>

        {/* Profile Switcher */}
        <ProfileSwitcher
          activeProfile={activeProfile}
          profiles={profiles}
          onSwitchProfile={onSwitchProfile}
        />
      </div>
    </header>
  );
};
