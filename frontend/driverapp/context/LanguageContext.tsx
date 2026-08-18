import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DEFAULT_LANGUAGE,
  LanguageCode,
  translations,
  TranslateFn,
} from "@/locales";

const LANGUAGE_STORAGE_KEY = "driverLanguage";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
  t: TranslateFn;
  isInitialized: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

function getByPath(source: unknown, path: string): string | undefined {
  const value = path
    .split(".")
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined,
      source,
    );
  return typeof value === "string" ? value : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    params[key] !== undefined ? String(params[key]) : match,
  );
}

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)
      .then((saved) => {
        if (saved === "en" || saved === "si" || saved === "ta") {
          setLanguageState(saved);
        }
      })
      .catch((error) => {
        console.warn("Failed to load saved language:", error);
      })
      .finally(() => {
        setIsInitialized(true);
      });
  }, []);

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, next).catch((error) => {
      console.warn("Failed to save language preference:", error);
    });
  }, []);

  const t: TranslateFn = useCallback(
    (key, params) => {
      const raw =
        getByPath(translations[language], key) ??
        getByPath(translations[DEFAULT_LANGUAGE], key) ??
        key;
      return interpolate(raw, params);
    },
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isInitialized }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
