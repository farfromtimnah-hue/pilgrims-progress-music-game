/**
 * Note-token set generation for the note-membership quiz screen — the
 * content-authoring piece PROGRESS.md flagged as future work (level-flow
 * piece 1). Produces the actual tokens the UI displays: roughly half drawn
 * from the key's own scale (correct picks), the rest chromatic neighbours
 * outside the key (wrong picks), deterministic from a seed so a level replay
 * shows a stable set within one session.
 *
 * This does not decide grading — grade.ts still judges every answer against
 * the key's scale spellings. It only decides what gets shown.
 */
import type { BuiltKey } from "../../../engine/theory/keys.js";
import { pitchClassOf } from "../../../engine/theory/pitch.js";
import type { NoteToken, SpelledNote } from "../../../engine/types/schema.js";

const ALL_LETTERS: SpelledNote["letter"][] = ["A", "B", "C", "D", "E", "F", "G"];
const CANDIDATE_ACCIDENTALS: SpelledNote["accidental"][] = ["natural", "#", "b"];
const TOKEN_OCTAVE = 4;

/** Simple deterministic PRNG (mulberry32) so a seed always produces the same set. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Candidate spellings (natural, sharp, flat per letter) whose sounding pitch
 * is NOT in the key — the wrong-answer pool. Natural-letter spellings are
 * tried first so distractors read simply; sharped/flatted forms fill in for
 * keys with few accidentals (e.g. C major, where every natural is in-key).
 */
function outOfKeyCandidates(builtKey: BuiltKey): SpelledNote[] {
  const inKeyPitchClasses = new Set(builtKey.scale.map((n) => pitchClassOf(n)));
  const candidates: SpelledNote[] = [];
  for (const accidental of CANDIDATE_ACCIDENTALS) {
    for (const letter of ALL_LETTERS) {
      const note = { letter, accidental };
      if (!inKeyPitchClasses.has(pitchClassOf(note))) candidates.push(note);
    }
  }
  return candidates;
}

/**
 * Build `count` note tokens for a note-membership question: half (rounded
 * up) drawn from the key's scale, the rest from spellings outside the key
 * (natural letters preferred, sharped/flatted forms as a fallback for keys
 * where naturals alone can't supply enough distractors, e.g. C major).
 */
export function buildNoteTokenSet(builtKey: BuiltKey, count: number, seed: number): NoteToken[] {
  const next = rng(seed);
  const inKeyCount = Math.ceil(count / 2);
  const outKeyCount = count - inKeyCount;

  const inKeyPool = shuffle(builtKey.scale, next);
  const outKeyPool = shuffle(outOfKeyCandidates(builtKey), next);

  const inKeyPicks: SpelledNote[] = [];
  for (let i = 0; i < inKeyCount; i++) inKeyPicks.push(inKeyPool[i % inKeyPool.length]!);

  const outKeyPicks: SpelledNote[] = [];
  for (let i = 0; i < outKeyCount; i++) {
    outKeyPicks.push(
      i < outKeyPool.length ? outKeyPool[i]! : inKeyPool[(inKeyCount + i) % inKeyPool.length]!,
    );
  }

  const notes = shuffle([...inKeyPicks, ...outKeyPicks], next);
  return notes.map((note, i) => ({
    id: `${builtKey.key.id}-token-${i}`,
    note,
    pitchClass: pitchClassOf(note),
    octave: TOKEN_OCTAVE,
  }));
}
