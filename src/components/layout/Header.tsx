// PASTE INTO: src/components/layout/Header.tsx

import React, { useState } from "react";
import { ChevronDown, PlusCircle, FolderOpen, Save, Globe } from "lucide-react";
import { Profile, ViewState } from "../../types";
import { isTauriEnv } from "../../utils/platform";

interface HeaderProps {
  view: ViewState;
  activeProfile: { id: string; name: string };
  profiles: { id: string; name: string }[];
  autoSaveStatus: "SAVED" | "SAVING";
  onSwitchProfile: (id: string) => void;
  onCreateProfile: () => void;
  onImport: () => void;
  onExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  view,
  activeProfile,
  profiles,
  autoSaveStatus,
  onSwitchProfile,
  onCreateProfile,
  onImport,
  onExport,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isTauri = isTauriEnv();

  // Helper to format view name
  const title = view.charAt(0) + view.slice(1).toLowerCase().replace("_", " ");

  return (
    <header className={`h-16 border-b flex items-center justify-between px-8 shadow-sm z-10 transition-colors ${
      isTauri ? "bg-white border-slate-200" : "bg-slate-50 border-blue-100"
    }`}>
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
            autoSaveStatus === "SAVED"
              ? "text-slate-400"
              : "bg-amber-50 text-amber-600"
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

        {/* Profile Switcher */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <div className="text-right">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Current Profile
              </p>
              <p className="text-sm font-bold text-slate-700">
                {activeProfile.name}
              </p>
            </div>
            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {/* Dropdown */}
          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 p-2 z-20 animate-in fade-in zoom-in-95 duration-200">
                <div className="max-h-60 overflow-y-auto custom-scrollbar mb-2">
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSwitchProfile(p.id);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm rounded-lg mb-1 font-medium transition-colors ${
                        activeProfile.id === p.id
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={() => {
                    onCreateProfile();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 font-bold hover:bg-amber-50 rounded-lg flex items-center hover:text-amber-700"
                >
                  <PlusCircle size={16} className="mr-2" /> Create New Profile
                </button>
                <button
                  onClick={() => {
                    onImport();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 font-bold hover:bg-blue-50 rounded-lg flex items-center hover:text-blue-700"
                >
                  <FolderOpen size={16} className="mr-2" /> Load Profile
                </button>
                <button
                  onClick={() => {
                    onExport();
                    setIsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 font-bold hover:bg-emerald-50 rounded-lg flex items-center hover:text-emerald-700"
                >
                  <Save size={16} className="mr-2" /> Export Profile
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
