/**
 * Key construction: scale spellings, key-signature accidental sets, and
 * scale-degree maps, generated from the tonic + mode rather than hand-typed
 * tables. Generation guarantees each scale uses seven consecutive letter
 * names, which is exactly why B#, E#, Cb, and Fb appear as *correct*
 * spellings in the keys that call for them.
 */
import type {
  Accidental,
  Key,
  KeyMode,
  KeySignatureAccidentals,
  LetterName,
  ScaleDegreeMap,
  SpelledNote,
} from "../types/schema.js";
import { noteNamePt } from "../i18n/note-names.js";
import { noteName, pitchClassOf } from "./pitch.js";

const LETTERS: LetterName[] = ["C", "D", "E", "F", "G", "A", "B"];
const LETTER_PC: Record<LetterName, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const MODE_INTERVALS: Record<KeyMode, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor
};

const OFFSET_TO_ACCIDENTAL: Record<number, Accidental> = {
  [-2]: "bb",
  [-1]: "b",
  0: "natural",
  1: "#",
  2: "##",
};

/** Canonical accidental orders for key signatures. */
export const SHARP_ORDER: LetterName[] = ["F", "C", "G", "D", "A", "E", "B"];
export const FLAT_ORDER: LetterName[] = ["B", "E", "A", "D", "G", "C", "F"];

/**
 * Spell the seven scale notes for a tonic + mode. Each scale degree uses the
 * next letter name; the accidental is whatever makes that letter sound the
 * required interval above the tonic.
 */
export function scaleSpellings(tonic: SpelledNote, mode: KeyMode): SpelledNote[] {
  const startIdx = LETTERS.indexOf(tonic.letter);
  const tonicPc = pitchClassOf(tonic);
  return MODE_INTERVALS[mode].map((interval, i) => {
    const letter = LETTERS[(startIdx + i) % 7]!;
    const targetPc = (tonicPc + interval) % 12;
    let offset = (targetPc - LETTER_PC[letter]) % 12;
    if (offset > 6) offset -= 12;
    if (offset < -6) offset += 12;
    const accidental = OFFSET_TO_ACCIDENTAL[offset];
    if (accidental === undefined) {
      throw new Error(`No valid spelling for degree ${i + 1} of ${noteName(tonic)} ${mode}`);
    }
    return { letter, accidental };
  });
}

export interface BuiltKey {
  key: Key;
  scale: SpelledNote[];
  scaleDegreeMap: ScaleDegreeMap;
  keySignature: KeySignatureAccidentals;
}

/** Build the full key record (Key + scale + degree map + signature) from tonic and mode. */
export function buildKey(tonic: SpelledNote, mode: KeyMode): BuiltKey {
  const scale = scaleSpellings(tonic, mode);
  const sharps = scale.filter((n) => n.accidental === "#" || n.accidental === "##");
  const flats = scale.filter((n) => n.accidental === "b" || n.accidental === "bb");
  if (sharps.length > 0 && flats.length > 0) {
    throw new Error(`${noteName(tonic)} ${mode} mixes sharps and flats — not a valid key signature`);
  }

  const accidentalType: "#" | "b" | "none" = sharps.length > 0 ? "#" : flats.length > 0 ? "b" : "none";
  const order = accidentalType === "#" ? SHARP_ORDER : FLAT_ORDER;
  const signatureNotes: SpelledNote[] =
    accidentalType === "none"
      ? []
      : order
          .map((letter) => scale.find((n) => n.letter === letter))
          .filter((n): n is SpelledNote => n !== undefined && n.accidental !== "natural");

  const id = `${tonic.letter}${tonic.accidental === "natural" ? "" : tonic.accidental}-${mode}`;
  const key: Key = {
    id,
    tonic,
    mode,
    displayName: {
      en: `${noteName(tonic)} ${mode}`,
      pt: `${noteNamePt(tonic)} ${mode === "major" ? "maior" : "menor"}`,
    },
    circleSide: accidentalType === "#" ? "sharp" : accidentalType === "b" ? "flat" : "none",
    accidentalCount: signatureNotes.length,
  };

  return {
    key,
    scale,
    scaleDegreeMap: { keyId: id, degrees: scale },
    keySignature: { keyId: id, accidentalType, accidentals: signatureNotes },
  };
}

const MAJOR_TONICS: SpelledNote[] = [
  { letter: "C", accidental: "natural" },
  { letter: "G", accidental: "natural" },
  { letter: "D", accidental: "natural" },
  { letter: "A", accidental: "natural" },
  { letter: "E", accidental: "natural" },
  { letter: "B", accidental: "natural" },
  { letter: "F", accidental: "#" },
  { letter: "C", accidental: "#" },
  { letter: "F", accidental: "natural" },
  { letter: "B", accidental: "b" },
  { letter: "E", accidental: "b" },
  { letter: "A", accidental: "b" },
  { letter: "D", accidental: "b" },
  { letter: "G", accidental: "b" },
  { letter: "C", accidental: "b" },
];

/** All 15 standard major keys (7 sharp, 7 flat, C). */
export function allMajorKeys(): BuiltKey[] {
  return MAJOR_TONICS.map((t) => buildKey(t, "major"));
}

/** Look up one built key by id, e.g. "Eb-major". */
export function getKey(keyId: string): BuiltKey {
  const found = allMajorKeys().find((k) => k.key.id === keyId);
  if (!found) throw new Error(`Unknown key id: ${keyId}`);
  return found;
}
