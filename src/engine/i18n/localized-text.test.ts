import { describe, expect, it } from "vitest";
import { display, isLanguage, type LocalizedText } from "./localized-text.js";

const GREETING: LocalizedText = { en: "Welcome, pilgrim!", pt: "Bem-vindo, peregrino!" };

describe("display — resolves at read time", () => {
  it("returns the English text for 'en'", () => {
    expect(display(GREETING, "en")).toBe("Welcome, pilgrim!");
  });

  it("returns the Portuguese text for 'pt'", () => {
    expect(display(GREETING, "pt")).toBe("Bem-vindo, peregrino!");
  });
});

describe("isLanguage", () => {
  it("accepts exactly 'en' and 'pt'", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("pt")).toBe(true);
  });

  it("rejects anything else — no silent default language", () => {
    expect(isLanguage(null)).toBe(false);
    expect(isLanguage("")).toBe(false);
    expect(isLanguage("es")).toBe(false);
    expect(isLanguage("pt-BR")).toBe(false);
  });
});
