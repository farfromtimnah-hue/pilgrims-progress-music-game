/**
 * Two-voice motion analysis — the counterpoint vocabulary behind both the
 * "Walking Beside the Melody" side quest and the harmony-line naturalness
 * judgment.
 *
 *   contrary — the voices move in opposite directions
 *   oblique  — one voice holds while the other moves
 *   similar  — both voices move in the same direction
 *   static   — neither voice moves
 *
 * "Parallel" (similar motion keeping the exact same interval) is detected
 * separately, because parallel motion is precisely the block-harmony sound
 * the Singer track teaches away from.
 */
import { midiOf } from "../../../engine/theory/pitch.js";
import type { MelodyNote } from "../missing-note/melodies.js";

export type MotionKind = "contrary" | "oblique" | "similar" | "static";

const midi = (n: MelodyNote) => midiOf(n.note, n.octave);

/** Motion between two consecutive two-voice moments. */
export function motionBetween(
  from: { a: MelodyNote; b: MelodyNote },
  to: { a: MelodyNote; b: MelodyNote },
): MotionKind {
  const dirA = Math.sign(midi(to.a) - midi(from.a));
  const dirB = Math.sign(midi(to.b) - midi(from.b));
  if (dirA === 0 && dirB === 0) return "static";
  if (dirA === 0 || dirB === 0) return "oblique";
  return dirA === dirB ? "similar" : "contrary";
}

const LETTER_INDEX: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** Absolute diatonic position — letter steps from C0, ignoring accidentals. */
const diatonicPos = (n: MelodyNote) => n.octave * 7 + LETTER_INDEX[n.note.letter]!;

/**
 * True when a step is similar motion that keeps the same GENERIC (letter)
 * interval — parallel 3rds stay parallel even where the key makes one third
 * major and the next minor. This diatonic definition is what makes parallel
 * motion the signature of block harmony.
 */
export function isParallel(
  from: { a: MelodyNote; b: MelodyNote },
  to: { a: MelodyNote; b: MelodyNote },
): boolean {
  return (
    motionBetween(from, to) === "similar" &&
    diatonicPos(from.a) - diatonicPos(from.b) === diatonicPos(to.a) - diatonicPos(to.b)
  );
}

export interface MotionProfile {
  counts: Record<MotionKind, number>;
  parallelCount: number;
  /** The most frequent non-static motion, ties broken contrary > oblique > similar. */
  dominant: MotionKind;
}

/** Analyze two equal-length voices note-by-note. */
export function analyzeMotion(a: MelodyNote[], b: MelodyNote[]): MotionProfile {
  if (a.length !== b.length || a.length < 2) {
    throw new Error("analyzeMotion needs two voices of equal length ≥ 2");
  }
  const counts: Record<MotionKind, number> = { contrary: 0, oblique: 0, similar: 0, static: 0 };
  let parallelCount = 0;
  for (let i = 1; i < a.length; i++) {
    const from = { a: a[i - 1]!, b: b[i - 1]! };
    const to = { a: a[i]!, b: b[i]! };
    counts[motionBetween(from, to)]++;
    if (isParallel(from, to)) parallelCount++;
  }
  const order: MotionKind[] = ["contrary", "oblique", "similar", "static"];
  const dominant = order.reduce((best, kind) => (counts[kind] > counts[best] ? kind : best));
  return { counts, parallelCount, dominant };
}
