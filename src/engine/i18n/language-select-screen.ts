/**
 * The one deliberate UI exception in this otherwise engine-only project:
 * the app must force an explicit EN/PT choice before any quiz content
 * loads, so this renders the minimum functional choice screen — two
 * labelled buttons, no styling. The returned promise resolves only once a
 * language is chosen and persisted; callers await it before loading any
 * game content.
 *
 * Each button is labelled in its own language ("English" / "Português")
 * because this screen is the one place shown before a language exists.
 */
import { getStoredLanguage, storeLanguage, type LanguageStorageBackend } from "./language-store.js";
import { LANGUAGES, type Language } from "./localized-text.js";

const BUTTON_LABELS: Record<Language, string> = { en: "English", pt: "Português" };

/**
 * Gate on a language choice: resolves immediately with a previously
 * persisted choice, otherwise renders the choice screen into `root` and
 * resolves (persisting the choice) when the player picks one.
 */
export function ensureLanguageSelected(
  backend: LanguageStorageBackend,
  root: HTMLElement,
): Promise<Language> {
  const stored = getStoredLanguage(backend);
  if (stored !== null) return Promise.resolve(stored);

  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.dataset["screen"] = "language-select";
    for (const lang of LANGUAGES) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = BUTTON_LABELS[lang];
      button.dataset["language"] = lang;
      button.addEventListener("click", () => {
        storeLanguage(backend, lang);
        container.remove();
        resolve(lang);
      });
      container.appendChild(button);
    }
    root.appendChild(container);
  });
}
