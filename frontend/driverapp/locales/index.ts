import { en } from "./en";
import { si } from "./si";
import { ta } from "./ta";
import type { TranslationKey, Translations } from "./types";

export type { TranslationKey, Translations };

export type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

export type LanguageCode = "en" | "si" | "ta";

export const DEFAULT_LANGUAGE: LanguageCode = "en";

export const translations: Record<LanguageCode, Translations> = {
  en,
  si,
  ta,
};

/** Each language's own name for itself, shown in the picker regardless of the active language. */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
};

export const LANGUAGE_CODES: LanguageCode[] = ["en", "si", "ta"];
