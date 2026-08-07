import React from "react";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Zap,
  HardDrive,
  Library,
  Sliders,
  BarChart3,
  Building2,
  FileText,
  Shield,
  UserX,
  Plus,
} from "lucide-react";
import { AppData, ViewState } from "../../types";
import { FileService } from "../../services/fileSystem";
import { SidebarSection } from "./sidebar/SidebarSection";
import { NavItem } from "./sidebar/NavItem";

interface SidebarProps {
  view: ViewState;
  setView: (view: ViewState) => void;
  onSave: () => void;
  hasUnsavedChanges: boolean;
  activeFilePath: string | null;
  activeProfile?: { id: string; name: string } | null;
  profiles: { id: string; name: string }[];
  onSwitchProfile: (id: string) => void;
  onCreateProfile?: () => void;
  data?: AppData;
}

export const Sidebar: React.FC<SidebarProps> = ({
  view,
  setView,
  onSave,
  hasUnsavedChanges,
  activeFilePath,
  activeProfile,
  profiles,
  onSwitchProfile,
  onCreateProfile,
  data,
}) => {
  const teacherCount = data?.teachers.length ?? 0;
  const classCount = data?.classes.length ?? 0;
  const subjectCount = data?.subjects.length ?? 0;
  const roomCount = data?.rooms.length ?? 0;
  const examCount = data?.exams.length ?? 0;
  const conflictCount = data?.conflicts.length ?? 0;

  return (
    <aside
      className="w-64 bg-slate-900 flex flex-col h-screen text-slate-300 shadow-2xl shrink-0 z-20"
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800/60">
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 shadow-lg shadow-amber-500/10">
          <img src="/icon.png" alt="EduScheduler Pro" className="w-full h-full object-cover" />
        </div>
        <div>
          <h1 className="font-bold text-white leading-none text-lg">
            Edu <span className="text-amber-400">Scheduler</span>
          </h1>
          <p className="text-2xs uppercase tracking-widest text-slate-400 font-bold mt-0.5">Pro</p>
        </div>
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto custom-scrollbar py-4"
        aria-label="Application sections"
      >
        <SidebarSection label="General" isFirst />
        <NavItem
          id="DASHBOARD"
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          currentView={view}
          onClick={setView}
        />

        <SidebarSection label="System" />
        <NavItem
          id="CONFIG"
          icon={<Sliders size={18} />}
          label="Configuration"
          currentView={view}
          onClick={setView}
        />

        <SidebarSection label="Academic Data" />
        <NavItem
          id="TEACHERS"
          icon={<Users size={18} />}
          label="Teachers"
          currentView={view}
          onClick={setView}
          badge={teacherCount || undefined}
        />
        <NavItem
          id="ROOMS"
          icon={<Building2 size={18} />}
          label="Rooms"
          currentView={view}
          onClick={setView}
          badge={roomCount || undefined}
        />
        <NavItem
          id="SUBJECTS"
          icon={<Library size={18} />}
          label="Subjects"
          currentView={view}
          onClick={setView}
          badge={subjectCount || undefined}
        />
        <NavItem
          id="CLASSES"
          icon={<BookOpen size={18} />}
          label="Classes"
          currentView={view}
          onClick={setView}
          badge={classCount || undefined}
        />

        <SidebarSection label="Scheduling" />
        <NavItem
          id="GENERATOR"
          icon={<Zap size={18} />}
          label="Auto-Generator"
          currentView={view}
          onClick={setView}
          badge={conflictCount || undefined}
          badgeVariant={conflictCount > 0 ? "danger" : "default"}
        />
        <NavItem
          id="WORKLOAD"
          icon={<BarChart3 size={18} />}
          label="Workload Analysis"
          currentView={view}
          onClick={setView}
        />

        <SidebarSection label="Operations" />
        <NavItem
          id="EXAMS"
          icon={<FileText size={18} />}
          label="Exam Timetable"
          currentView={view}
          onClick={setView}
          badge={examCount || undefined}
        />
        <NavItem
          id="DUTY"
          icon={<Shield size={18} />}
          label="Duty Roster"
          currentView={view}
          onClick={setView}
        />
        <NavItem
          id="SUBSTITUTES"
          icon={<UserX size={18} />}
          label="Cover Planner"
          currentView={view}
          onClick={setView}
        />

        {/* Profiles Section */}
        <SidebarSection label="Profiles" />
        <div className="px-4 mb-2 space-y-1">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => onSwitchProfile(p.id)}
              className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-all flex items-center gap-2 ${
                activeProfile?.id === p.id
                  ? "bg-amber-500 text-slate-900 font-bold shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              {activeProfile?.id === p.id && (
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900 shrink-0" />
              )}
              <span className="truncate">{p.name}</span>
              {activeProfile?.id === p.id && (
                <span className="ml-auto text-2xs font-black uppercase tracking-widest opacity-70">
                  Active
                </span>
              )}
            </button>
          ))}
          {onCreateProfile && (
            <button
              onClick={onCreateProfile}
              className="w-full text-left px-3 py-2 text-xs rounded-lg transition-all text-slate-400 hover:text-amber-400 hover:bg-slate-800 flex items-center gap-2"
            >
              <Plus size={12} />
              New Profile
            </button>
          )}
        </div>
      </nav>

      {/* Save Button */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <button
          onClick={onSave}
          className="w-full flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-amber-400 py-3 rounded-xl transition-all shadow-lg text-sm font-bold active:scale-95 group"
        >
          <HardDrive size={18} className="mr-2 group-hover:animate-bounce" />
          {FileService.isTauri ? (activeFilePath ? "Save" : "Save As...") : "Save to Device"}
        </button>
        {hasUnsavedChanges && (
          <p className="text-center text-2xs text-amber-500 mt-2 font-bold animate-pulse">
            ● Unsaved Changes
          </p>
        )}
      </div>
    </aside>
  );
};
