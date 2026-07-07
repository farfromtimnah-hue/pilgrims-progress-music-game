/**
 * Language-choice persistence. There is deliberately NO default language:
 * getStoredLanguage returns null until the player has made an explicit
 * EN/PT choice, and no quiz content may load before then (see
 * language-select-screen.ts for the gate).
 *
 * Storage follows the same backend pattern as audio (AudioBackend /
 * ToneBackend): a narrow interface, a real browser implementation, and an
 * in-memory fake for tests. Nothing else in the project persists state yet
 * (engine/progress is an empty stub), so this is the first persisted value;
 * player progress can adopt the same pattern later.
 */
import { isLanguage, type Language } from "./localized-text.js";

export const LANGUAGE_STORAGE_KEY = "ppmg.language";

export interface LanguageStorageBackend {
  read(): string | null;
  write(value: string): void;
}

/** Browser persistence via window.localStorage. */
export class LocalStorageLanguageBackend implements LanguageStorageBackend {
  read(): string | null {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY);
  }
  write(value: string): void {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
  }
}

/** Test/fake persistence, mirroring the silent AudioBackend approach. */
export class InMemoryLanguageBackend implements LanguageStorageBackend {
  private value: string | null = null;
  read(): string | null {
    return this.value;
  }
  write(value: string): void {
    this.value = value;
  }
}

/** The persisted choice, or null when none has been made (or it is corrupt). */
export function getStoredLanguage(backend: LanguageStorageBackend): Language | null {
  const raw = backend.read();
  return isLanguage(raw) ? raw : null;
}

export function storeLanguage(backend: LanguageStorageBackend, lang: Language): void {
  backend.write(lang);
}
