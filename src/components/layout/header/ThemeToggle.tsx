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
      onClick={toggle}
      aria-label={t("theme.toggle")}
      title={t("theme.toggle")}
      className="p-2 rounded-lg text-content-muted hover:text-accent-ink hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
};
