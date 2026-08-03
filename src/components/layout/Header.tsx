import React from "react";
import { Save, Globe } from "lucide-react";
import { ViewState } from "../../types";
import { isTauriEnv } from "../../utils/platform";
import { useI18n } from "../../contexts/I18nContext";
import { TranslationKey } from "../../i18n/dictionaries";
import { UndoRedoControls } from "./UndoRedoControls";
import { ProfileSwitcher } from "./header/ProfileSwitcher";
import { ThemeToggle } from "./header/ThemeToggle";

const VIEW_TITLE_KEYS: Record<ViewState, TranslationKey> = {
  DASHBOARD: "nav.dashboard",
  CONFIG: "nav.configuration",
  SUBJECTS: "nav.subjects",
  TEACHERS: "nav.teachers",
  ROOMS: "nav.rooms",
  CLASSES: "nav.classes",
  WORKLOAD: "nav.workload",
  GENERATOR: "nav.generator",
  EXAMS: "nav.exams",
  DUTY: "nav.duty",
  SUBSTITUTES: "nav.substitutes",
};

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
  const { t } = useI18n();

  const title = t(VIEW_TITLE_KEYS[view] ?? "nav.dashboard");

  return (
    <header
      className={`h-16 border-b flex items-center justify-between px-8 shadow-sm z-10 transition-colors dark:bg-slate-800 dark:border-slate-700 ${
        isTauri ? "bg-white border-slate-200" : "bg-slate-50 border-blue-100"
      }`}
    >
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>

        {!isTauri && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-2xs font-bold uppercase tracking-wider border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800">
            <Globe size={12} />
            {t("common.webMode")}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Auto-Save Indicator */}
        <div
          className={`text-xs font-bold transition-all duration-300 flex items-center gap-2 px-3 py-1.5 rounded-full ${
            autoSaveStatus === "SAVED"
              ? "text-content-muted"
              : "bg-amber-50 text-accent-ink dark:bg-amber-900/30 dark:text-amber-400"
          }`}
        >
          {autoSaveStatus === "SAVING" ? (
            <span className="animate-spin">⟳</span>
          ) : (
            <Save size={12} />
          )}
          {autoSaveStatus === "SAVED" ? t("common.saved") : t("common.saving")}
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

        <ThemeToggle />

        <UndoRedoControls />

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2"></div>

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
