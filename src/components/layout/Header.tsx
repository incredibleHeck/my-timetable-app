import React from "react";
import { Loader2 } from "lucide-react";
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

/**
 * The app-shell title bar. Every screen shows it, so it stays quiet: one line of
 * orientation on the left, save state and the session controls on the right, all
 * on the shared tokens. The loud web-mode pill, the pill-shaped save badge with
 * its emoji spinner, and the "CURRENT PROFILE" eyebrow are gone — each screen
 * already carries its own heading beneath this bar.
 */
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-edge bg-surface px-6">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm font-medium text-content">{title}</span>
        {!isTauri && (
          <span className="shrink-0 text-2xs text-content-muted">{t("common.webMode")}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <span
          className="mr-1 flex items-center gap-1.5 text-xs text-content-muted"
          aria-live="polite"
        >
          {autoSaveStatus === "SAVING" ? (
            <>
              <Loader2 size={13} className="animate-spin" aria-hidden />
              {t("common.saving")}
            </>
          ) : (
            t("common.saved")
          )}
        </span>

        <div className="mx-1 h-5 w-px bg-edge" aria-hidden />

        <ThemeToggle />
        <UndoRedoControls />

        <div className="mx-1 h-5 w-px bg-edge" aria-hidden />

        <ProfileSwitcher
          activeProfile={activeProfile}
          profiles={profiles}
          onSwitchProfile={onSwitchProfile}
        />
      </div>
    </header>
  );
};
