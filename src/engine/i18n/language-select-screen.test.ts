// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { ensureLanguageSelected } from "./language-select-screen.js";
import { getStoredLanguage, InMemoryLanguageBackend, storeLanguage } from "./language-store.js";

function buttons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll("button"));
}

describe("ensureLanguageSelected — forced explicit choice", () => {
  it("renders the choice screen when nothing is stored — content must wait", async () => {
    const root = document.createElement("div");
    const backend = new InMemoryLanguageBackend();
    let resolved: string | null = null;

    const gate = ensureLanguageSelected(backend, root).then((lang) => (resolved = lang));
    expect(buttons(root).map((b) => b.textContent)).toEqual(["English", "Português"]);
    expect(resolved).toBeNull(); // the gate has not resolved without a click

    buttons(root).find((b) => b.dataset["language"] === "pt")!.click();
    await gate;
    expect(resolved).toBe("pt");
  });

  it("persists the choice and removes the screen", async () => {
    const root = document.createElement("div");
    const backend = new InMemoryLanguageBackend();
    const gate = ensureLanguageSelected(backend, root);

    buttons(root).find((b) => b.dataset["language"] === "en")!.click();
    await expect(gate).resolves.toBe("en");
    expect(getStoredLanguage(backend)).toBe("en");
    expect(buttons(root)).toEqual([]);
  });

  it("skips the screen entirely when a choice is already persisted", async () => {
    const root = document.createElement("div");
    const backend = new InMemoryLanguageBackend();
    storeLanguage(backend, "pt");

    await expect(ensureLanguageSelected(backend, root)).resolves.toBe("pt");
    expect(buttons(root)).toEqual([]);
  });
});
