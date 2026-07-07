/**
 * Short recognizable melodies for the missing-note completion mechanic.
 * Every melody must be clearly public domain (or original) — no modern
 * copyrighted material — and each entry says why it qualifies.
 *
 * Melodies are authored in a home key (keyId) with spelled notes, so the
 * gap grading and result labels can lean on the same key machinery as the
 * rest of the engine (scale degrees, spellings).
 *
 * ⚠️ CONTENT NEEDS NICOLE'S REVIEW: familiarity for her students,
 * PT titles, and whether hymn-repertoire melodies should be added.
 */
import type { PhraseNote } from "../../../engine/audio/audio-engine.js";
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import { pitchClassOf, spelled } from "../../../engine/theory/pitch.js";
import type { SpelledNote } from "../../../engine/types/schema.js";

export interface MelodyNote {
  note: SpelledNote;
  octave: number;
  beats: number;
}

/** Convert authored melody notes to an AudioEngine phrase. */
export function melodyToPhrase(notes: MelodyNote[], idPrefix: string): PhraseNote[] {
  return notes.map((mn, i) => ({
    token: { id: `${idPrefix}-${i}`, note: mn.note, pitchClass: pitchClassOf(mn.note), octave: mn.octave },
    beats: mn.beats,
  }));
}

export interface Melody {
  id: string;
  title: LocalizedText;
  /** Home key id, e.g. "C-major" — resolvable via getKey(). */
  keyId: string;
  notes: MelodyNote[];
  /** Public-domain justification, developer-facing. */
  publicDomainNote: string;
}

const n = (note: SpelledNote, octave: number, beats = 1): MelodyNote => ({ note, octave, beats });

export const MELODIES: Melody[] = [
  {
    id: "melody-twinkle",
    title: { en: "Twinkle, Twinkle, Little Star", pt: "Brilha, Brilha, Estrelinha" },
    keyId: "C-major",
    notes: [
      n(spelled("C"), 4),
      n(spelled("C"), 4),
      n(spelled("G"), 4),
      n(spelled("G"), 4),
      n(spelled("A"), 4),
      n(spelled("A"), 4),
      n(spelled("G"), 4, 2),
    ],
    publicDomainNote: "French melody, 1761 — public domain.",
  },
  {
    id: "melody-ode-to-joy",
    title: { en: "Ode to Joy", pt: "Hino à Alegria" },
    keyId: "C-major",
    notes: [
      n(spelled("E"), 4),
      n(spelled("E"), 4),
      n(spelled("F"), 4),
      n(spelled("G"), 4),
      n(spelled("G"), 4),
      n(spelled("F"), 4),
      n(spelled("E"), 4),
      n(spelled("D"), 4),
      n(spelled("C"), 4),
      n(spelled("C"), 4),
      n(spelled("D"), 4),
      n(spelled("E"), 4, 2),
    ],
    publicDomainNote: "Beethoven, 1824 — public domain.",
  },
  {
    id: "melody-when-the-saints",
    title: { en: "When the Saints Go Marching In", pt: "Quando os Santos Vêm Marchando" },
    keyId: "C-major",
    notes: [
      n(spelled("C"), 4),
      n(spelled("E"), 4),
      n(spelled("F"), 4),
      n(spelled("G"), 4, 3),
      n(spelled("C"), 4),
      n(spelled("E"), 4),
      n(spelled("F"), 4),
      n(spelled("G"), 4, 3),
    ],
    publicDomainNote: "Traditional gospel, pre-1923 — public domain.",
  },
  {
    id: "melody-amazing-grace",
    title: { en: "Amazing Grace", pt: "Graça Maravilhosa (Amazing Grace)" },
    keyId: "C-major",
    notes: [
      n(spelled("G"), 3),
      n(spelled("C"), 4, 2),
      n(spelled("E"), 4, 0.5),
      n(spelled("C"), 4, 0.5),
      n(spelled("E"), 4, 2),
      n(spelled("D"), 4),
      n(spelled("C"), 4, 2),
      n(spelled("A"), 3),
      n(spelled("G"), 3, 2),
    ],
    publicDomainNote: "Tune NEW BRITAIN, 1829 — public domain.",
  },
];

export function melodyById(id: string): Melody | undefined {
  return MELODIES.find((m) => m.id === id);
}
