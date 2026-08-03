import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "eduscheduler_theme";

interface ThemeContextType {
  /** The user's stored preference. */
  preference: ThemePreference;
  /** The theme actually applied right now ("light" | "dark"). */
  resolved: "light" | "dark";
  setPreference: (pref: ThemePreference) => void;
  /** Convenience toggle between light and dark (drops "system"). */
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const prefersDark = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-color-scheme: dark)").matches === true;

const readStoredPreference = (): ThemePreference => {
  if (typeof localStorage === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
};

const resolve = (pref: ThemePreference): "light" | "dark" =>
  pref === "system" ? (prefersDark() ? "dark" : "light") : pref;

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolve(readStoredPreference()));

  // Apply the resolved theme to <html> and keep it in sync with preference + OS.
  useEffect(() => {
    const apply = () => {
      const next = resolve(preference);
      setResolved(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      document.documentElement.style.colorScheme = next;
    };
    apply();

    if (preference !== "system") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch {
      /* storage may be unavailable; theme still applies for the session */
    }
  }, []);

  const toggle = useCallback(() => {
    setPreference(resolve(readStoredPreference()) === "dark" ? "light" : "dark");
  }, [setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
};
