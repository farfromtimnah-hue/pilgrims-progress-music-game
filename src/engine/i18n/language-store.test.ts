import { describe, expect, it } from "vitest";
import { getStoredLanguage, InMemoryLanguageBackend, storeLanguage } from "./language-store.js";

describe("language store — no default", () => {
  it("returns null when no choice has ever been made", () => {
    expect(getStoredLanguage(new InMemoryLanguageBackend())).toBeNull();
  });

  it("round-trips an explicit choice", () => {
    const backend = new InMemoryLanguageBackend();
    storeLanguage(backend, "pt");
    expect(getStoredLanguage(backend)).toBe("pt");
    storeLanguage(backend, "en");
    expect(getStoredLanguage(backend)).toBe("en");
  });

  it("treats a corrupt stored value as no choice, not a default", () => {
    const backend = new InMemoryLanguageBackend();
    backend.write("es");
    expect(getStoredLanguage(backend)).toBeNull();
  });
});
