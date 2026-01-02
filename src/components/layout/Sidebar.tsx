import React from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Zap,
  HardDrive,
  GraduationCap,
  Library,
  Sliders,
  BarChart3,
  Building2,
  FileText,
  Shield,
} from "lucide-react";
import { ViewState } from "../../types";
import { FileService } from "../../services/fileSystem";

interface SidebarProps {
  view: ViewState;
  setView: (view: ViewState) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  activeFilePath: string | null;
}

const NavItem = ({
  id,
  icon,
  label,
  currentView,
  onClick,
}: {
  id: ViewState;
  icon: React.ReactNode;
  label: string;
  currentView: ViewState;
  onClick: (v: ViewState) => void;
}) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center px-6 py-3 transition-colors border-l-4 text-sm font-medium group ${
      currentView === id
        ? "bg-slate-800 text-white border-amber-400"
        : "text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50"
    }`}
  >
    <span
      className={`mr-3 transition-transform ${
        currentView === id
          ? "scale-110 text-amber-400"
          : "group-hover:scale-110"
      }`}
    >
      {icon}
    </span>
    {label}
  </button>
);

export const Sidebar: React.FC<SidebarProps> = ({
  view,
  setView,
  onSave,
  hasUnsavedChanges,
  activeFilePath,
}) => {
  return (
    <aside className="w-64 bg-slate-900 flex flex-col h-screen text-slate-300 shadow-2xl shrink-0 z-20">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center text-slate-900 shadow-lg shadow-amber-500/20">
          <GraduationCap size={24} />
        </div>
        <div>
          <h1 className="font-bold text-white leading-none text-lg">
            Edu <span className="text-amber-400">Scheduler</span>
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">
            Pro
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto custom-scrollbar py-4">
        <div className="px-6 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
          Main
        </div>
        <NavItem
          id="DASHBOARD"
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          currentView={view}
          onClick={setView}
        />

        <div className="px-6 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">
          Configurations
        </div>
        <NavItem
          id="CONFIG"
          icon={<Sliders size={18} />}
          label="Global Config"
          currentView={view}
          onClick={setView}
        />

        <NavItem
          id="ROOMS"
          icon={<Building2 size={18} />}
          label="Rooms"
          currentView={view}
          onClick={setView}
        />

        <NavItem
          id="SUBJECTS"
          icon={<Library size={18} />}
          label="Subjects"
          currentView={view}
          onClick={setView}
        />

        <div className="px-6 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">
          Management
        </div>
        <NavItem
          id="TEACHERS"
          icon={<Users size={18} />}
          label="Teachers"
          currentView={view}
          onClick={setView}
        />
        <NavItem
          id="CLASSES"
          icon={<BookOpen size={18} />}
          label="Classes"
          currentView={view}
          onClick={setView}
        />

        <div className="px-6 py-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-4">
          Operations
        </div>
        <NavItem
          id="WORKLOAD"
          icon={<BarChart3 size={18} />}
          label="Workload Analysis"
          currentView={view}
          onClick={setView}
        />
        <NavItem
          id="GENERATOR"
          icon={<Zap size={18} />}
          label="Auto-Generator"
          currentView={view}
          onClick={setView}
        />
        <NavItem
          id="EXAMS"
          icon={<FileText size={18} />}
          label="Exam Timetable"
          currentView={view}
          onClick={setView}
        />
        <NavItem
          id="DUTY"
          icon={<Shield size={18} />}
          label="Duty Roster"
          currentView={view}
          onClick={setView}
        />
      </nav>

      {/* Save Button */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={onSave}
          className="w-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-amber-400 py-3 rounded-xl transition-all shadow-lg text-sm font-bold active:scale-95 group"
        >
          <HardDrive size={18} className="mr-2 group-hover:animate-bounce" />
          {FileService.isTauri
            ? activeFilePath
              ? "Save"
              : "Save As..."
            : "Save to Device"}
        </button>
        {hasUnsavedChanges && (
          <p className="text-center text-[10px] text-amber-500 mt-2 font-bold animate-pulse">
            ● Unsaved Changes
          </p>
        )}
      </div>
    </aside>
  );
};
