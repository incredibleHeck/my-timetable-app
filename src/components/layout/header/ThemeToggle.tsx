import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";
import { useI18n } from "../../../contexts/I18nContext";

export const ThemeToggle: React.FC = () => {
  const { resolved, toggle } = useTheme();
  const { t } = useI18n();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("theme.toggle")}
      title={t("theme.toggle")}
      className="grid h-8 w-8 place-items-center rounded-md text-content-muted transition-colors
                 hover:bg-surface-inset hover:text-content focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-accent"
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
};
