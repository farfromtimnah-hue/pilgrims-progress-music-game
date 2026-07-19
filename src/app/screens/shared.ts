/** Small helpers shared across play screens — no state, no engine calls. */
import { noteNamePt } from "../../engine/i18n/note-names.js";
import { noteName } from "../../engine/theory/pitch.js";
import type { SpelledNote } from "../../engine/types/schema.js";
import type { Language } from "../../engine/i18n/localized-text.js";

export function noteDisplayName(note: SpelledNote, language: Language): string {
  return language === "en" ? noteName(note) : noteNamePt(note);
}

export function hashSeed(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  return h;
}
