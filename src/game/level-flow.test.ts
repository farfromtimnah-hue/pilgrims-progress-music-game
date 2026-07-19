/**
 * Integration tests for the level-flow orchestrator. These deliberately use
 * the REAL committed modules end-to-end — real chapter/template JSON, real
 * grading (grade.ts, key-signature-quiz.ts), the real strike machine, real
 * singer quiz reducers, the real naturalness judgment, and the real
 * AudioEngine (over the silent test backend, the same seam its own tests
 * use). No grading or state-machine logic is mocked.
 */
import { describe, expect, it } from "vitest";

import chapter01Json from "../../data/chapters/chapter-01.json";
import tiersJson from "../../data/difficulty-tiers.json";
import keySignatureTemplateJson from "../../data/quiz-templates/key-signature-full-set.json";
import noteTokenTemplateJson from "../../data/quiz-templates/note-token-basic.json";

import { AudioEngine } from "../engine/audio/audio-engine.js";
import type { AudioBackend, VoiceHandle } from "../engine/audio/backend.js";
import { display } from "../engine/i18n/localized-text.js";
import { spelled } from "../engine/theory/pitch.js";
import type { Chapter, DifficultyTier, Level, QuizTemplate } from "../engine/types/schema.js";
import { buildBetterPathQuestion } from "../tracks/singer/harmony/naturalness.js";
import { referencesFor, SONG_REFERENCES } from "../tracks/singer/intervals/song-references.js";
import { melodyById, type MelodyNote } from "../tracks/singer/missing-note/melodies.js";
import { buildMissingNoteQuestion } from "../tracks/singer/missing-note/missing-note-quiz.js";

import { routeEffectsToAudio } from "./audio-router.js";
import {
  buildChallengeSequence,
  materializeInstrumentalistTemplate,
  type Challenge,
} from "./challenges.js";
import {
  levelFlowReducer,
  startLevel,
  type LevelEffect,
  type LevelEvent,
  type LevelFlowState,
  type LevelPlan,
  type LevelResult,
} from "./level-flow.js";

const chapter01 = chapter01Json as unknown as Chapter;
const tiers = (tiersJson as { tiers: DifficultyTier[] }).tiers;
const templates: Record<string, QuizTemplate> = Object.fromEntries(
  [noteTokenTemplateJson, keySignatureTemplateJson].map((t) => [t.id, t as unknown as QuizTemplate]),
);

const tier = (id: string): DifficultyTier => tiers.find((t) => t.id === id)!;

class SilentBackend implements AudioBackend {
  playedFrequencies: number[] = [];
  sustainedLayers: number[][] = [];
  async start(): Promise<void> {}
  sustain(frequencies: number[]): VoiceHandle {
    this.sustainedLayers.push(frequencies);
    return { release: () => {} };
  }
  playNote(frequency: number): void {
    this.playedFrequencies.push(frequency);
  }
  now(): number {
    return 0;
  }
}

/** Drive the reducer through events, collecting every effect. */
function run(plan: LevelPlan, events: LevelEvent[]): { effects: LevelEffect[]; state: LevelFlowState } {
  const started = startLevel(plan);
  let state = started.state;
  const effects = [...started.effects];
  for (const event of events) {
    const t = levelFlowReducer(state, event, plan);
    state = t.state;
    effects.push(...t.effects);
  }
  return { effects, state };
}

function levelResult(effects: LevelEffect[]): LevelResult {
  const done = effects.find((e) => e.type === "level_complete");
  expect(done, "level should have completed").toBeDefined();
  return (done as Extract<LevelEffect, { type: "level_complete" }>).result;
}

describe("instrumentalist level end-to-end (real chapter data, real grading, real strike machine)", () => {
  function instrumentalistPlan(tierId: "beginner" | "intermediate" | "advanced"): LevelPlan {
    const level: Level = chapter01.levels[0]!;
    const challenges = buildChallengeSequence(level, (ref) => {
      const template = ref.source === "quiz_template" ? templates[ref.id] : undefined;
      return template ? materializeInstrumentalistTemplate(template, "instrumentalist", tierId) : null;
    });
    return {
      chapterId: chapter01.id,
      levelId: level.id,
      trackId: "instrumentalist",
      tier: tier(tierId),
      testsNotationPrecision: chapter01.testsNotationPrecision,
      challenges,
    };
  }

  it("sequences both quiz templates from chapter-01.json in order", () => {
    const plan = instrumentalistPlan("intermediate");
    expect(plan.challenges.map((c) => c.kind)).toEqual(["note_token", "key_signature"]);
    expect(plan.challenges.map((c) => c.id)).toEqual(["note-token-basic", "key-signature-full-set"]);
  });

  it("routes answers through grade.ts + the strike machine, then the key-signature quiz, and passes", () => {
    const plan = instrumentalistPlan("intermediate");
    // note-token-basic at intermediate: tokenCount 8 → 4 correct picks required.
    const { effects, state } = run(plan, [
      // Close answer: B# sounds like C but C major spells it C → teaching prompt, no strike.
      { type: "answer_note", note: spelled("B", "#") },
      // Wrong answer: F# is not in C major → strike 1 (damage + short prompt).
      { type: "answer_note", note: spelled("F", "#") },
      // Four correct picks complete the challenge (first also clears the strike).
      { type: "answer_note", note: spelled("C") },
      { type: "answer_note", note: spelled("D") },
      { type: "answer_note", note: spelled("E") },
      { type: "answer_note", note: spelled("F") },
      // Key-signature challenge: C major has NO accidentals; F# is an extra → recovery.
      { type: "submit_full_set", notes: [spelled("F", "#")] },
      // Recovery step 1: C major sits on neither side — completes recovery immediately.
      { type: "recovery_answer", answer: { step: "circle_side", side: "none" } },
    ]);

    // The Close answer produced grade.ts's real bilingual teaching prompt.
    const teach = effects.find((e) => e.type === "feedback" && e.feedback.kind === "teaching_prompt");
    expect(teach).toBeDefined();
    const message = (teach as { feedback: { message: { en: string; pt: string } } }).feedback.message;
    expect(display(message, "en")).toContain("key signature");
    expect(display(message, "pt")).toContain("armadura de clave");

    // The wrong answer reached the real strike machine: damage + short prompt.
    const strikeEffects = effects.filter((e) => e.type === "strike").map((e) => e.effect.type);
    expect(strikeEffects).toContain("apply_damage");
    expect(strikeEffects).toContain("show_short_prompt");
    expect(strikeEffects).toContain("clear_strikes"); // the later correct answer recovered

    // The failed full set entered the real recovery flow, which then completed.
    const graded = effects.find((e) => e.type === "key_signature_graded");
    expect(graded).toMatchObject({ enteredRecovery: true });
    expect(effects.some((e) => e.type === "recovery" && e.effect.type === "recovery_complete")).toBe(true);

    const result = levelResult(effects);
    expect(state.phase).toBe("complete");
    expect(result).toMatchObject({
      outcome: "passed",
      trackId: "instrumentalist",
      tierId: "intermediate",
      strikesUsed: 1,
      closeCallCount: 1, // the B# — key-signature wrongSpellings would add here too
      enteredScaffoldSequence: false,
    });
    expect(result.challengeResults.map((r) => r.succeeded)).toEqual([true, true]);
    expect(result.challengeResults[1]).toMatchObject({ usedRecovery: true });
    expect(result.challengeResults[0]!.answerResults).toEqual([
      "close",
      "wrong",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
  });

  it("walks strike 2 (diagnostic) and strike 3 (scaffold) through the real machine", () => {
    const plan = instrumentalistPlan("intermediate");
    const wrong = { type: "answer_note", note: spelled("F", "#") } as const;
    const { effects } = run(plan, [
      wrong, // strike 1
      wrong, // strike 2 → pause for diagnostic
      { type: "answer_note", note: spelled("C") }, // ignored: paused for diagnostic
      { type: "diagnostic_answered", correct: false }, // gap confirmed → scaffold
      { type: "scaffold_completed" }, // re-entry, strikes cleared
      { type: "answer_note", note: spelled("C") },
      { type: "answer_note", note: spelled("D") },
      { type: "answer_note", note: spelled("E") },
      { type: "answer_note", note: spelled("F") },
      { type: "submit_full_set", notes: [] }, // C major: empty set is correct
    ]);

    const strikeEffects = effects.filter((e) => e.type === "strike").map((e) => e.effect.type);
    expect(strikeEffects).toContain("pause_for_diagnostic");
    expect(strikeEffects).toContain("enter_scaffold_sequence");
    expect(strikeEffects).toContain("reenter_question");

    const result = levelResult(effects);
    expect(result.outcome).toBe("passed"); // scaffolding is instructional, not a gate
    expect(result.enteredScaffoldSequence).toBe(true);
    // The answer submitted while paused was ignored, not graded.
    expect(result.challengeResults[0]!.answerResults.filter((r) => r === "correct")).toHaveLength(4);
  });
});

describe("singer level end-to-end (real quiz reducers, real naturalness judgment, real AudioEngine)", () => {
  function singerPlan(): LevelPlan {
    const twinkle = melodyById("melody-twinkle")!;
    // Real content builders: the interval question uses the committed song
    // references; the missing-note question and the better-path judgment are
    // built by the committed builders (naturalness.ts decides which line wins).
    const intervalChallenge: Challenge = {
      kind: "interval",
      id: "singer-interval-P5",
      contextKeyId: "C-major",
      question: {
        interval: "P5",
        direction: "ascending",
        root: { note: spelled("C"), octave: 4 },
        mode: "song_hint",
        formalNameStep: "ask",
        songOptions: [...referencesFor("P5", "ascending"), SONG_REFERENCES[0]!],
        nameOptions: ["P4", "P5"],
      },
    };
    const missingNoteChallenge: Challenge = {
      kind: "missing_note",
      id: "singer-missing-note-twinkle",
      question: buildMissingNoteQuestion(twinkle, 2, "scale_degree"),
    };
    const melody: MelodyNote[] = [
      { note: spelled("C"), octave: 4, beats: 1 },
      { note: spelled("D"), octave: 4, beats: 1 },
      { note: spelled("E"), octave: 4, beats: 1 },
      { note: spelled("F"), octave: 4, beats: 1 },
    ];
    const blockLine: MelodyNote[] = [
      { note: spelled("A"), octave: 3, beats: 1 },
      { note: spelled("B"), octave: 3, beats: 1 },
      { note: spelled("C"), octave: 4, beats: 1 },
      { note: spelled("D"), octave: 4, beats: 1 },
    ];
    const contraryLine: MelodyNote[] = [
      { note: spelled("C"), octave: 4, beats: 1 },
      { note: spelled("B"), octave: 3, beats: 1 },
      { note: spelled("A"), octave: 3, beats: 1 },
      { note: spelled("F"), octave: 3, beats: 1 },
    ];
    const betterPathChallenge: Challenge = {
      kind: "side_quest",
      id: "singer-sq-better-path",
      contextKeyId: "C-major",
      quest: {
        kind: "choose_the_better_path",
        question: buildBetterPathQuestion("bp-int-test", melody, blockLine, contraryLine),
      },
    };

    const level: Level = {
      id: "singer-test-level",
      order: 1,
      quizTemplateIds: ["singer-interval-P5", "singer-missing-note-twinkle"],
      rewardIds: [],
      sideQuestIds: ["singer-sq-better-path"],
      audioCueIds: [],
      harmonicUnlockIds: [],
    };
    const byId: Record<string, Challenge> = {
      "singer-interval-P5": intervalChallenge,
      "singer-missing-note-twinkle": missingNoteChallenge,
      "singer-sq-better-path": betterPathChallenge,
    };
    return {
      chapterId: chapter01.id,
      levelId: level.id,
      trackId: "singer",
      tier: tier("beginner"),
      testsNotationPrecision: false,
      challenges: buildChallengeSequence(level, (ref) => byId[ref.id] ?? null),
    };
  }

  it("sequences interval → missing note → side quest, grading each with its real module", () => {
    const plan = singerPlan();
    expect(plan.challenges.map((c) => c.kind)).toEqual(["interval", "missing_note", "side_quest"]);
    // naturalness.ts (real judgment) must have picked the contrary line, not the block.
    const quest = plan.challenges[2]!;
    if (quest.kind !== "side_quest" || quest.quest.kind !== "choose_the_better_path") throw new Error("bad plan");
    expect(quest.quest.question.better).toBe("b");

    const twinkle = melodyById("melody-twinkle")!;
    const gapNote = twinkle.notes[2]!; // G4
    const { effects, state } = run(plan, [
      // Interval quiz: wrong song first (Für Elise is a descending m2) → real retry hint.
      { type: "interval_event", event: { type: "choose_song", songReferenceId: SONG_REFERENCES[0]!.id } },
      { type: "interval_event", event: { type: "choose_song", songReferenceId: "ref-P5-asc-twinkle-twinkle" } },
      { type: "interval_event", event: { type: "choose_name", intervalId: "P5" } },
      // Missing note: choose the actual gap pitch (G4) — graded by the real reducer.
      { type: "missing_note_event", event: { type: "choose_pitch", choice: { note: gapNote.note, octave: gapNote.octave } } },
      // Better path: wrong pick "a" (the block line) → hint + duets again; then "b".
      { type: "side_quest_event", event: { type: "choose_path", pick: "a" } },
      { type: "side_quest_event", event: { type: "choose_path", pick: "b" } },
    ]);

    // Real interval-quiz hint, bilingual, plus a replay of the interval.
    const retry = effects.find((e) => e.type === "interval" && e.effect.type === "retry");
    expect(retry).toBeDefined();
    expect(effects.filter((e) => e.type === "interval" && e.effect.type === "play_interval").length).toBeGreaterThan(1);

    // Real missing-note reveal: scale-degree label in both languages.
    const reveal = effects.find((e) => e.type === "missing_note" && e.effect.type === "show_result");
    expect(reveal).toBeDefined();
    const label = (reveal as { effect: { label: { en: string; pt: string } } }).effect.label;
    expect(label.en).toContain("scale degree 5");
    expect(label.pt).toContain("5º grau");

    // Real naturalness explanation revealed by the side quest on success.
    const questReveal = effects.find((e) => e.type === "side_quest" && e.effect.type === "reveal");
    expect(questReveal).toBeDefined();
    const explanation = (questReveal as { effect: { text: { en: string; pt: string } } }).effect.text;
    expect(explanation.en).toContain("more natural");

    const result = levelResult(effects);
    expect(state.phase).toBe("complete");
    expect(result).toMatchObject({ outcome: "passed", trackId: "singer", tierId: "beginner", strikesUsed: 0 });
    expect(result.challengeResults.map((r) => r.succeeded)).toEqual([true, true, true]);
    expect(result.challengeResults[0]!.mistakes).toBe(1); // the wrong song pick
    expect(result.challengeResults[2]!.mistakes).toBe(1); // the wrong path pick
  });

  it("fails the level when a one-shot singer challenge completes unsuccessfully", () => {
    const plan = singerPlan();
    const twinkle = melodyById("melody-twinkle")!;
    const gapNote = twinkle.notes[2]!;
    const { effects } = run(plan, [
      { type: "interval_event", event: { type: "choose_song", songReferenceId: "ref-P5-asc-twinkle-twinkle" } },
      { type: "interval_event", event: { type: "choose_name", intervalId: "P5" } },
      { type: "missing_note_event", event: { type: "choose_pitch", choice: { note: gapNote.note, octave: gapNote.octave } } },
      // Two wrong picks end the better-path quest unsuccessfully (real reducer rule).
      { type: "side_quest_event", event: { type: "choose_path", pick: "a" } },
      { type: "side_quest_event", event: { type: "choose_path", pick: "a" } },
    ]);
    const result = levelResult(effects);
    expect(result.outcome).toBe("failed");
    expect(result.challengeResults[2]!.succeeded).toBe(false);
  });

  it("drives the real AudioEngine: playback effects become context + notes, never a bare tone", () => {
    const plan = singerPlan();
    const backend = new SilentBackend();
    const engine = new AudioEngine(backend);

    const started = startLevel(plan);
    routeEffectsToAudio(engine, started.effects);
    let state = started.state;
    const events: LevelEvent[] = [
      { type: "interval_event", event: { type: "choose_song", songReferenceId: "ref-P5-asc-twinkle-twinkle" } },
      { type: "interval_event", event: { type: "choose_name", intervalId: "P5" } },
    ];
    for (const event of events) {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      routeEffectsToAudio(engine, t.effects);
    }

    // The interval's two notes were played through the ONE engine…
    expect(backend.playedFrequencies.length).toBeGreaterThanOrEqual(2);
    // …and the engine auto-started a tonic context first (the core audio rule).
    expect(backend.sustainedLayers.length).toBeGreaterThanOrEqual(1);
  });

  it("records an abandoned run", () => {
    const plan = singerPlan();
    const { effects } = run(plan, [{ type: "abandon" }]);
    expect(levelResult(effects).outcome).toBe("abandoned");
  });
});
