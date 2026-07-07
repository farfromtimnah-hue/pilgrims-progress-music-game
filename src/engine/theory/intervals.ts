/**
 * Interval math and naming, shared theory. Built for the Singer track's
 * ear-training first, so the model is the SOUNDING distance: an interval id
 * names a semitone count (m3 = 3 semitones), not a spelling relationship.
 * Singers grade what they hear; spelling-aware interval quality (A4 vs d5,
 * A2 vs m3) can layer on later for notation chapters without changing this.
 *
 * Transposition still produces properly SPELLED notes (letter-step rule, same
 * two-axis model as everywhere else), so played intervals stay consistent
 * with the key spellings the instrumentalist side teaches.
 */
import type { LocalizedText } from "../i18n/localized-text.js";
import type { Accidental, LetterName, SpelledNote } from "../types/schema.js";
import { midiOf } from "./pitch.js";

/** Simple intervals, unison through octave. TT = tritone (sounding name). */
export type IntervalId =
  | "P1"
  | "m2"
  | "M2"
  | "m3"
  | "M3"
  | "P4"
  | "TT"
  | "P5"
  | "m6"
  | "M6"
  | "m7"
  | "M7"
  | "P8";

export type IntervalDirection = "ascending" | "descending";

export interface IntervalDef {
  id: IntervalId;
  semitones: number;
  /** Letter steps for spelling a transposition (P5 = 4 letters up). */
  letterSteps: number;
  name: LocalizedText;
}

export const INTERVALS: Record<IntervalId, IntervalDef> = {
  P1: { id: "P1", semitones: 0, letterSteps: 0, name: { en: "unison", pt: "uníssono" } },
  m2: { id: "m2", semitones: 1, letterSteps: 1, name: { en: "minor 2nd", pt: "segunda menor" } },
  M2: { id: "M2", semitones: 2, letterSteps: 1, name: { en: "major 2nd", pt: "segunda maior" } },
  m3: { id: "m3", semitones: 3, letterSteps: 2, name: { en: "minor 3rd", pt: "terça menor" } },
  M3: { id: "M3", semitones: 4, letterSteps: 2, name: { en: "major 3rd", pt: "terça maior" } },
  P4: { id: "P4", semitones: 5, letterSteps: 3, name: { en: "perfect 4th", pt: "quarta justa" } },
  TT: { id: "TT", semitones: 6, letterSteps: 3, name: { en: "tritone", pt: "trítono" } },
  P5: { id: "P5", semitones: 7, letterSteps: 4, name: { en: "perfect 5th", pt: "quinta justa" } },
  m6: { id: "m6", semitones: 8, letterSteps: 5, name: { en: "minor 6th", pt: "sexta menor" } },
  M6: { id: "M6", semitones: 9, letterSteps: 5, name: { en: "major 6th", pt: "sexta maior" } },
  m7: { id: "m7", semitones: 10, letterSteps: 6, name: { en: "minor 7th", pt: "sétima menor" } },
  M7: { id: "M7", semitones: 11, letterSteps: 6, name: { en: "major 7th", pt: "sétima maior" } },
  P8: { id: "P8", semitones: 12, letterSteps: 7, name: { en: "octave", pt: "oitava" } },
};

export const ALL_INTERVAL_IDS = Object.keys(INTERVALS) as IntervalId[];

/** Sounding distance in semitones between two placed notes (positive = b above a). */
export function semitonesBetween(
  a: { note: SpelledNote; octave: number },
  b: { note: SpelledNote; octave: number },
): number {
  return midiOf(b.note, b.octave) - midiOf(a.note, a.octave);
}

/** The interval id for a sounding distance (absolute, ≤ 12 semitones), else null. */
export function intervalFromSemitones(semitones: number): IntervalId | null {
  const abs = Math.abs(semitones);
  return ALL_INTERVAL_IDS.find((id) => INTERVALS[id].semitones === abs) ?? null;
}

const LETTERS: LetterName[] = ["C", "D", "E", "F", "G", "A", "B"];

const OFFSET_TO_ACCIDENTAL: Record<number, Accidental> = {
  [-2]: "bb",
  [-1]: "b",
  0: "natural",
  1: "#",
  2: "##",
};

export interface PlacedNote {
  note: SpelledNote;
  octave: number;
}

/**
 * Transpose a placed note by a simple interval, keeping proper spelling:
 * the letter moves by the interval's letter steps, the accidental is whatever
 * makes that letter sound the right distance. Octaves follow the letter
 * (scientific pitch), matching pitch.ts.
 */
export function transposeByInterval(
  start: PlacedNote,
  interval: IntervalId,
  direction: IntervalDirection,
): PlacedNote {
  const def = INTERVALS[interval];
  const sign = direction === "ascending" ? 1 : -1;
  const rawIdx = LETTERS.indexOf(start.note.letter) + sign * def.letterSteps;
  const letter = LETTERS[((rawIdx % 7) + 7) % 7]!;
  const octave = start.octave + Math.floor(rawIdx / 7);
  const targetMidi = midiOf(start.note, start.octave) + sign * def.semitones;
  const offset = targetMidi - midiOf({ letter, accidental: "natural" }, octave);
  const accidental = OFFSET_TO_ACCIDENTAL[offset];
  if (accidental === undefined) {
    throw new Error(`No simple spelling for ${interval} ${direction} from ${start.note.letter}${start.note.accidental}`);
  }
  return { note: { letter, accidental }, octave };
}
