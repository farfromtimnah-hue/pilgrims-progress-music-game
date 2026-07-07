/**
 * Bilingual text (English / Brazilian Portuguese), following the Directory
 * app pattern: every user-facing string carries BOTH languages, and the
 * active language is resolved at read time via display() — never picked at
 * data-authoring time. There is no fallback language: a LocalizedText is
 * only valid with both fields filled in.
 */

export type Language = "en" | "pt";

export const LANGUAGES: readonly Language[] = ["en", "pt"];

export interface LocalizedText {
  en: string;
  pt: string;
}

/** Resolve a LocalizedText to the active language. */
export function display(text: LocalizedText, lang: Language): string {
  return text[lang];
}

export function isLanguage(value: unknown): value is Language {
  return value === "en" || value === "pt";
}
