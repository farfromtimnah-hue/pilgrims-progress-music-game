/**
 * Pitch math shared by the audio engine and the grading logic.
 * Converts spelled notes (letter + accidental) to pitch classes, MIDI
 * numbers, and frequencies — preserving spelling everywhere else.
 */
import type { Accidental, LetterName, PitchClass, SpelledNote } from "../types/schema.js";

const LETTER_PITCH_CLASS: Record<LetterName, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const ACCIDENTAL_OFFSET: Record<Accidental, number> = {
  bb: -2,
  b: -1,
  natural: 0,
  "#": 1,
  "##": 2,
};

/** Pitch class 0–11 (C = 0). B# → 0, Cb → 11, etc. */
export function pitchClassOf(note: SpelledNote): PitchClass {
  const pc = (LETTER_PITCH_CLASS[note.letter] + ACCIDENTAL_OFFSET[note.accidental] + 12) % 12;
  return pc as PitchClass;
}

/** True when two spellings denote the same sounding pitch class. */
export function isEnharmonic(a: SpelledNote, b: SpelledNote): boolean {
  return pitchClassOf(a) === pitchClassOf(b);
}

/** True when two spellings are literally identical. */
export function sameSpelling(a: SpelledNote, b: SpelledNote): boolean {
  return a.letter === b.letter && a.accidental === b.accidental;
}

/**
 * MIDI number for a spelled note in an octave (scientific pitch notation,
 * where the octave belongs to the LETTER: B#3 sounds like C4 but is octave 3,
 * Cb4 sounds like B3 but is octave 4).
 */
export function midiOf(note: SpelledNote, octave: number): number {
  return (octave + 1) * 12 + LETTER_PITCH_CLASS[note.letter] + ACCIDENTAL_OFFSET[note.accidental];
}

/** Equal-tempered frequency, A4 = 440 Hz. */
export function frequencyOf(note: SpelledNote, octave: number): number {
  return 440 * Math.pow(2, (midiOf(note, octave) - 69) / 12);
}

const ACCIDENTAL_LABEL: Record<Accidental, string> = {
  bb: "𝄫",
  b: "♭",
  natural: "",
  "#": "♯",
  "##": "𝄪",
};

/** Human-readable name, e.g. "E♭", "B♯". */
export function noteName(note: SpelledNote): string {
  return `${note.letter}${ACCIDENTAL_LABEL[note.accidental]}`;
}

/** Convenience constructor. */
export function spelled(letter: LetterName, accidental: Accidental = "natural"): SpelledNote {
  return { letter, accidental };
}
