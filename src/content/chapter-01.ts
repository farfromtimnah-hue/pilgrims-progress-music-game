/**
 * Chapter 1 (City of Destruction) real content — the proof pattern for
 * authoring future chapters. Instrumentalist content stays data-driven
 * (JSON quiz templates, materialized by materializeInstrumentalistTemplate);
 * Singer content is authored here in code, following the exact pattern the
 * level-flow integration tests already established (song-references.ts /
 * melodies.ts are content data, the question objects that reference them
 * are built per-chapter). A future content session repeats this file's
 * shape for chapters 2–8.
 *
 * Everything here is real: real song references, a real public-domain
 * melody, and — for the two side quests wired end-to-end this session —
 * real phrases in C major, the chapter's one focus key.
 */
import { spelled } from "../engine/theory/pitch.js";
import type { PlacedNote } from "../engine/theory/intervals.js";
import type { DifficultyTierId, QuizTemplate, TrackId } from "../engine/types/schema.js";
import type { Challenge, ChallengeRef } from "../game/challenges.js";
import { materializeInstrumentalistTemplate } from "../game/challenges.js";
import { melodyById } from "../tracks/singer/missing-note/melodies.js";
import { buildMissingNoteQuestion } from "../tracks/singer/missing-note/missing-note-quiz.js";
import { referencesFor } from "../tracks/singer/intervals/song-references.js";
import type { IntervalQuestion } from "../tracks/singer/intervals/interval-quiz.js";
import type { EchoQuestion } from "../tracks/singer/side-quests/echo-the-guide.js";
import type { LanternQuestion } from "../tracks/singer/side-quests/hold-the-lantern.js";
import type { WalkingQuestion } from "../tracks/singer/side-quests/walking-beside-the-melody.js";
import type { FinishQuestion } from "../tracks/singer/side-quests/finish-the-phrase.js";
import type { HiddenCompanionQuestion } from "../tracks/singer/side-quests/hidden-companion.js";
import type { MelodyNote } from "../tracks/singer/missing-note/melodies.js";

// ---------------------------------------------------------------------------
// Singer: up/down hearing — an ascending major 2nd vs a descending minor 2nd,
// the simplest "did it go up or down" discrimination, anchored to two songs
// students already know (Happy Birthday's opening step up, Für Elise's
// opening step down). Beginner reveals the formal name after the song step;
// direction is what's actually being taught here.
// ---------------------------------------------------------------------------

export const CH01_INTERVAL_UP: IntervalQuestion = {
  interval: "M2",
  direction: "ascending",
  root: { note: spelled("C"), octave: 4 },
  mode: "song_hint",
  formalNameStep: "reveal",
  songOptions: referencesFor("M2", "ascending"),
  nameOptions: ["m2", "M2"],
};

export const CH01_INTERVAL_DOWN: IntervalQuestion = {
  interval: "m2",
  direction: "descending",
  root: { note: spelled("C"), octave: 5 },
  mode: "song_hint",
  formalNameStep: "reveal",
  songOptions: referencesFor("m2", "descending"),
  nameOptions: ["m2", "M2"],
};

// A P5-up reference question (Twinkle Twinkle) as the chapter's simple
// interval-reference content beyond up/down, per the session brief.
export const CH01_INTERVAL_P5: IntervalQuestion = {
  interval: "P5",
  direction: "ascending",
  root: { note: spelled("G"), octave: 4 },
  mode: "song_hint",
  formalNameStep: "ask",
  songOptions: referencesFor("P5", "ascending"),
  nameOptions: ["P4", "P5"],
};

// ---------------------------------------------------------------------------
// Singer: missing-note completion on Twinkle Twinkle (public domain, already
// authored in melodies.ts), gap at the third note (the first G — the leap
// from C up to G, a clear ear target for a first chapter).
// ---------------------------------------------------------------------------

export function ch01MissingNoteQuestion() {
  const twinkle = melodyById("melody-twinkle")!;
  return buildMissingNoteQuestion(twinkle, 2, "scale_degree");
}

// ---------------------------------------------------------------------------
// Singer side quests: Echo the Guide + Hold the Lantern, the first two of
// six, wired end-to-end this session as the pattern the remaining four
// follow later. Both use a short four-note C-major phrase.
// ---------------------------------------------------------------------------

const CH01_ECHO_PHRASE: MelodyNote[] = [
  { note: spelled("C"), octave: 4, beats: 1 },
  { note: spelled("E"), octave: 4, beats: 1 },
  { note: spelled("D"), octave: 4, beats: 1 },
  { note: spelled("C"), octave: 4, beats: 2 },
];

export const CH01_ECHO_QUESTION: EchoQuestion = {
  id: "ch01-echo-the-guide",
  phrase: CH01_ECHO_PHRASE,
};

const CH01_LANTERN_MELODY: MelodyNote[] = [
  { note: spelled("D"), octave: 4, beats: 1 },
  { note: spelled("E"), octave: 4, beats: 1 },
  { note: spelled("F"), octave: 4, beats: 1 },
  { note: spelled("E"), octave: 4, beats: 1 },
  { note: spelled("D"), octave: 4, beats: 1 },
];

const CH01_LANTERN_TARGET: PlacedNote = { note: spelled("C"), octave: 4 };

export const CH01_LANTERN_QUESTION: LanternQuestion = {
  id: "ch01-hold-the-lantern",
  target: CH01_LANTERN_TARGET,
  melody: CH01_LANTERN_MELODY,
  checkpoints: 5,
  allowedDrifts: 1,
};

// ---------------------------------------------------------------------------
// Singer side quests continued: Walking Beside the Melody, Finish the
// Phrase, Hidden Companion — the same short C-major world as Echo/Lantern
// above, each authored so the reducer's real grading (analyzeMotion,
// expectedResolution's tendency-tone rules, the companion index) lands on
// the intended answer rather than an accidental one.
// ---------------------------------------------------------------------------

// Melody climbs C-D-E-F while the companion descends C-B-A-G underneath —
// four contrary steps, so analyzeMotion's dominant motion is "contrary".
const CH01_WALKING_MELODY: MelodyNote[] = [
  { note: spelled("C"), octave: 4, beats: 1 },
  { note: spelled("D"), octave: 4, beats: 1 },
  { note: spelled("E"), octave: 4, beats: 1 },
  { note: spelled("F"), octave: 4, beats: 1 },
];

const CH01_WALKING_COMPANION: MelodyNote[] = [
  { note: spelled("C"), octave: 4, beats: 1 },
  { note: spelled("B"), octave: 3, beats: 1 },
  { note: spelled("A"), octave: 3, beats: 1 },
  { note: spelled("G"), octave: 3, beats: 1 },
];

export const CH01_WALKING_QUESTION: WalkingQuestion = {
  id: "ch01-walking-beside-the-melody",
  melody: CH01_WALKING_MELODY,
  companion: CH01_WALKING_COMPANION,
};

// Phrase climbs to B4 (scale degree 7, "ti") and stops — a classic
// tendency tone that pulls up to C5 ("do"). expectedResolution derives that
// answer from the C-major scale; the offered options are the resolution
// plus two decoys a step either side.
const CH01_FINISH_PHRASE: MelodyNote[] = [
  { note: spelled("G"), octave: 4, beats: 1 },
  { note: spelled("A"), octave: 4, beats: 1 },
  { note: spelled("B"), octave: 4, beats: 2 },
];

export const CH01_FINISH_QUESTION: FinishQuestion = {
  id: "ch01-finish-the-phrase",
  keyId: "C-major",
  phrase: CH01_FINISH_PHRASE,
  options: [
    { note: spelled("A"), octave: 4 },
    { note: spelled("C"), octave: 5 },
    { note: spelled("G"), octave: 4 },
  ],
};

// A duet where the companion walks a steady stepwise line under the
// melody; two decoy candidates (a leaping line, and the melody's own
// rhythm shifted) sit alongside the real companion at companionIndex 1.
const CH01_COMPANION_MELODY: MelodyNote[] = [
  { note: spelled("E"), octave: 4, beats: 1 },
  { note: spelled("F"), octave: 4, beats: 1 },
  { note: spelled("G"), octave: 4, beats: 1 },
  { note: spelled("E"), octave: 4, beats: 1 },
];

const CH01_COMPANION_LINE: MelodyNote[] = [
  { note: spelled("C"), octave: 4, beats: 1 },
  { note: spelled("D"), octave: 4, beats: 1 },
  { note: spelled("E"), octave: 4, beats: 1 },
  { note: spelled("C"), octave: 4, beats: 1 },
];

const CH01_COMPANION_DECOY_LEAP: MelodyNote[] = [
  { note: spelled("C"), octave: 3, beats: 1 },
  { note: spelled("G"), octave: 3, beats: 1 },
  { note: spelled("C"), octave: 4, beats: 1 },
  { note: spelled("G"), octave: 3, beats: 1 },
];

const CH01_COMPANION_DECOY_STATIC: MelodyNote[] = [
  { note: spelled("G"), octave: 3, beats: 1 },
  { note: spelled("G"), octave: 3, beats: 1 },
  { note: spelled("G"), octave: 3, beats: 1 },
  { note: spelled("G"), octave: 3, beats: 1 },
];

export const CH01_HIDDEN_COMPANION_QUESTION: HiddenCompanionQuestion = {
  id: "ch01-hidden-companion",
  melody: CH01_COMPANION_MELODY,
  companion: CH01_COMPANION_LINE,
  options: [CH01_COMPANION_DECOY_LEAP, CH01_COMPANION_LINE, CH01_COMPANION_DECOY_STATIC],
  companionIndex: 1,
};

// ---------------------------------------------------------------------------
// Materializer — the chapter-specific bridge from content refs to Challenge
// instances. Instrumentalist refs still resolve through the generic JSON
// materializer (real quiz-template data); singer refs resolve to the
// authored content above. Chapters 2–8 get their own such module.
// ---------------------------------------------------------------------------

export function materializeChapter01(
  ref: ChallengeRef,
  trackId: TrackId,
  tierId: DifficultyTierId,
  instrumentalistTemplates: Record<string, QuizTemplate>,
): Challenge | null {
  if (ref.source === "quiz_template") {
    const template = instrumentalistTemplates[ref.id];
    if (template) {
      const challenge = materializeInstrumentalistTemplate(template, trackId, tierId);
      if (challenge) return challenge;
    }
    if (trackId !== "singer") return null;
    switch (ref.id) {
      case "interval-up-down-c":
        return {
          kind: "interval",
          id: ref.id,
          contextKeyId: "C-major",
          question: tierId === "beginner" ? CH01_INTERVAL_UP : CH01_INTERVAL_DOWN,
        };
      case "missing-note-twinkle-c":
        return { kind: "missing_note", id: ref.id, question: ch01MissingNoteQuestion() };
      default:
        return null;
    }
  }

  if (trackId !== "singer") return null;
  switch (ref.id) {
    case "ch01-echo-the-guide":
      return {
        kind: "side_quest",
        id: ref.id,
        contextKeyId: "C-major",
        quest: { kind: "echo_the_guide", question: CH01_ECHO_QUESTION },
      };
    case "ch01-hold-the-lantern":
      return {
        kind: "side_quest",
        id: ref.id,
        contextKeyId: "C-major",
        quest: { kind: "hold_the_lantern", question: CH01_LANTERN_QUESTION },
      };
    case "ch01-walking-beside-the-melody":
      return {
        kind: "side_quest",
        id: ref.id,
        contextKeyId: "C-major",
        quest: { kind: "walking_beside_the_melody", question: CH01_WALKING_QUESTION },
      };
    case "ch01-finish-the-phrase":
      return {
        kind: "side_quest",
        id: ref.id,
        contextKeyId: "C-major",
        quest: { kind: "finish_the_phrase", question: CH01_FINISH_QUESTION },
      };
    case "ch01-hidden-companion":
      return {
        kind: "side_quest",
        id: ref.id,
        contextKeyId: "C-major",
        quest: { kind: "hidden_companion", question: CH01_HIDDEN_COMPANION_QUESTION },
      };
    default:
      return null;
  }
}
