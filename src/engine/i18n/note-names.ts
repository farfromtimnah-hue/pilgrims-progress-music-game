/**
 * Localized note naming for user-facing text. English uses letter names
 * (E♭, B♯); Brazilian Portuguese music education uses fixed-do solfège
 * syllables (Mi♭, Si♯) — accidental symbols are the same in both. This is
 * display-only: ids, schema, and pitch math stay on letter names everywhere.
 *
 * NEEDS NATIVE-SPEAKER / TEACHER CONFIRMATION: whether Nicole's students
 * read solfège syllables or letter names (Brazilian cifra chord notation
 * uses letters) — see PROGRESS.md.
 */
import { noteName } from "../theory/pitch.js";
import type { Accidental, LetterName, SpelledNote } from "../types/schema.js";
import type { LocalizedText } from "./localized-text.js";

const SOLFEGE: Record<LetterName, string> = {
  C: "Dó",
  D: "Ré",
  E: "Mi",
  F: "Fá",
  G: "Sol",
  A: "Lá",
  B: "Si",
};

const ACCIDENTAL_SYMBOL: Record<Accidental, string> = {
  bb: "𝄫",
  b: "♭",
  natural: "",
  "#": "♯",
  "##": "𝄪",
};

/** Brazilian Portuguese note name, e.g. "Mi♭", "Si♯". */
export function noteNamePt(note: SpelledNote): string {
  return `${SOLFEGE[note.letter]}${ACCIDENTAL_SYMBOL[note.accidental]}`;
}

/** Both display names for one spelled note, e.g. { en: "E♭", pt: "Mi♭" }. */
export function localizedNoteName(note: SpelledNote): LocalizedText {
  return { en: noteName(note), pt: noteNamePt(note) };
}
