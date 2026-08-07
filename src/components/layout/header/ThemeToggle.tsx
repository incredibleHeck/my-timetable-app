import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../../contexts/ThemeContext";

const TOGGLE_LABEL = "Toggle light / dark theme";

export const ThemeToggle: React.FC = () => {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={TOGGLE_LABEL}
      title={TOGGLE_LABEL}
      className="grid h-8 w-8 place-items-center rounded-md text-content-muted transition-colors
                 hover:bg-surface-inset hover:text-content focus-visible:outline-none
                 focus-visible:ring-2 focus-visible:ring-accent"
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
};
