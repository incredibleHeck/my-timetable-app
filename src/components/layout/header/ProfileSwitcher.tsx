import React, { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

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
        type="button"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        className="flex h-8 max-w-[12rem] items-center gap-1.5 rounded-md px-2 text-sm text-content
                   transition-colors hover:bg-surface-inset focus-visible:outline-none
                   focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="truncate font-medium">{activeProfile.name}</span>
        <ChevronDown size={14} className="shrink-0 text-content-muted" aria-hidden />
      </button>

      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 top-full z-20 mt-1.5 w-60 rounded-md border border-edge bg-surface p-1 shadow-lg"
          >
            <p className="px-2 py-1.5 text-2xs uppercase tracking-wide text-content-muted">
              Switch profile
            </p>
            <div className="custom-scrollbar max-h-60 overflow-y-auto">
              {profiles.map((p) => {
                const isActive = activeProfile.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSwitchProfile(p.id);
                      setIsMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left
                                text-sm transition-colors focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-accent ${
                                  isActive
                                    ? "font-medium text-content"
                                    : "text-content-secondary hover:bg-surface-muted hover:text-content"
                                }`}
                  >
                    <span className="truncate">{p.name}</span>
                    {isActive && (
                      <Check size={14} className="shrink-0 text-accent-ink" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
