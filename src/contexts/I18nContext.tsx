import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { dictionaries, en, TranslationKey } from "../i18n/dictionaries";

const STORAGE_KEY = "eduscheduler_locale";

interface I18nContextType {
  locale: string;
  availableLocales: string[];
  setLocale: (locale: string) => void;
  /** Translate a key, falling back to English then the key itself. Supports {var} interpolation. */
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const readStoredLocale = (): string => {
  if (typeof localStorage === "undefined") return "en";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && dictionaries[stored] ? stored : "en";
};

const interpolate = (template: string, vars?: Record<string, string | number>): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match,
  );
};

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocaleState] = useState<string>(readStoredLocale);

  const setLocale = useCallback((next: string) => {
    if (!dictionaries[next]) return;
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage may be unavailable; locale still applies for the session */
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = dictionaries[locale] ?? en;
      const value = dict[key] ?? en[key] ?? key;
      return interpolate(value, vars);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, availableLocales: Object.keys(dictionaries), setLocale, t }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextType => {
  const ctx = useContext(I18nContext);
  if (ctx === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
};
