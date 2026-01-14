import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ProfileSwitcherProps {
  activeProfile: { id: string; name: string };
  profiles: { id: string; name: string }[];
  onSwitchProfile: (id: string) => void;
}

export const ProfileSwitcher: React.FC<ProfileSwitcherProps> = ({
  activeProfile,
  profiles,
  onSwitchProfile,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
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
          </div>
        </>
      )}
    </div>
  );
};
