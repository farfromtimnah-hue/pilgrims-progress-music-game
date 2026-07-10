/**
 * Badge/reward assignment tests. Chapter completions here are produced by
 * playing REAL levels through the real level flow (chapter-01.json, the real
 * instrumentalist graders, the real singer missing-note quiz) and settling
 * them through the real progress store — proving the piece 1 → 2 → 3
 * pipeline end-to-end, including the full-chapter pilgrimage emblem.
 */
import { describe, expect, it } from "vitest";

import chapter01Json from "../../data/chapters/chapter-01.json";
import tiersJson from "../../data/difficulty-tiers.json";
import rewardsJson from "../../data/rewards/chapter-01-rewards.json";
import unlocksJson from "../../data/harmonic-unlocks/chapter-01-unlocks.json";
import keySignatureTemplateJson from "../../data/quiz-templates/key-signature-full-set.json";
import noteTokenTemplateJson from "../../data/quiz-templates/note-token-basic.json";

import { spelled } from "../engine/theory/pitch.js";
import type {
  Chapter,
  DifficultyTier,
  DifficultyTierId,
  HarmonicUnlock,
  QuizTemplate,
  Reward,
  TrackId,
} from "../engine/types/schema.js";
import { melodyById } from "../tracks/singer/missing-note/melodies.js";
import { buildMissingNoteQuestion } from "../tracks/singer/missing-note/missing-note-quiz.js";
import { buildChallengeSequence, materializeInstrumentalistTemplate, type Challenge } from "./challenges.js";
import {
  levelFlowReducer,
  startLevel,
  type LevelEffect,
  type LevelEvent,
  type LevelPlan,
  type LevelResult,
} from "./level-flow.js";
import { InMemoryProgressBackend, ProgressStore } from "./progress.js";
import { evaluateChapterGrants, settleLevelResult } from "./rewards.js";

const chapter01 = chapter01Json as unknown as Chapter;
const tiers = (tiersJson as { tiers: DifficultyTier[] }).tiers;
const rewards = (rewardsJson as { rewards: unknown[] }).rewards as Reward[];
const unlocks = (unlocksJson as { harmonicUnlocks: unknown[] }).harmonicUnlocks as HarmonicUnlock[];
const templates: Record<string, QuizTemplate> = Object.fromEntries(
  [noteTokenTemplateJson, keySignatureTemplateJson].map((t) => [t.id, t as unknown as QuizTemplate]),
);
const tier = (id: DifficultyTierId): DifficultyTier => tiers.find((t) => t.id === id)!;

function runToResult(plan: LevelPlan, events: LevelEvent[]): LevelResult {
  const started = startLevel(plan);
  let state = started.state;
  const effects = [...started.effects];
  for (const event of events) {
    const t = levelFlowReducer(state, event, plan);
    state = t.state;
    effects.push(...t.effects);
  }
  const done = effects.find((e) => e.type === "level_complete") as Extract<
    LevelEffect,
    { type: "level_complete" }
  >;
  expect(done, `level should complete (tier ${plan.tier.id})`).toBeDefined();
  return done.result;
}

/** Play chapter 1's real level on the instrumentalist track at a tier, correctly. */
function playInstrumentalistLevel(tierId: DifficultyTierId): LevelResult {
  const level = chapter01.levels[0]!;
  const plan: LevelPlan = {
    chapterId: chapter01.id,
    levelId: level.id,
    trackId: "instrumentalist",
    tier: tier(tierId),
    testsNotationPrecision: chapter01.testsNotationPrecision,
    challenges: buildChallengeSequence(level, (ref) =>
      ref.source === "quiz_template"
        ? materializeInstrumentalistTemplate(templates[ref.id]!, "instrumentalist", tierId)
        : null,
    ),
  };
  // Enough correct C-major picks for every tier's requiredCorrect (max 5 at
  // advanced), then the correct (empty) C-major signature set.
  const events: LevelEvent[] = [
    ...(["C", "D", "E", "F", "G"] as const).map(
      (letter) => ({ type: "answer_note", note: spelled(letter) }) as const,
    ),
    { type: "submit_full_set", notes: [] },
  ];
  return runToResult(plan, events);
}

/** Play chapter 1's level id on the singer track at a tier (missing-note challenge). */
function playSingerLevel(tierId: DifficultyTierId): LevelResult {
  const twinkle = melodyById("melody-twinkle")!;
  const question = buildMissingNoteQuestion(twinkle, 2, "scale_degree");
  const gap = twinkle.notes[2]!;
  const challenge: Challenge = { kind: "missing_note", id: "singer-ch01-q1", question };
  const plan: LevelPlan = {
    chapterId: chapter01.id,
    levelId: chapter01.levels[0]!.id,
    trackId: "singer",
    tier: tier(tierId),
    testsNotationPrecision: false,
    challenges: [challenge],
  };
  return runToResult(plan, [
    { type: "missing_note_event", event: { type: "choose_pitch", choice: { note: gap.note, octave: gap.octave } } },
  ]);
}

function settle(store: ProgressStore, playerId: string, result: LevelResult) {
  return settleLevelResult(store, playerId, result, chapter01, rewards, unlocks);
}

describe("badge assignment (one shared rule engine, keyed by tier completion)", () => {
  it("assigns crown → lantern/scroll → seal per tier, and the pilgrimage emblem on full-chapter mastery", () => {
    const store = new ProgressStore(new InMemoryProgressBackend());

    const beginner = settle(store, "nicole", playInstrumentalistLevel("beginner"));
    expect(beginner.newRewardIds).toEqual(["badge-ch01-beginner-crown"]);
    // Harmonic unlocks wait for Advanced mastery; earlier tiers open nothing.
    expect(beginner.newHarmonicUnlockIds).toEqual([]);

    const intermediate = settle(store, "nicole", playInstrumentalistLevel("intermediate"));
    expect(intermediate.newRewardIds).toEqual(["badge-ch01-intermediate-lantern"]);
    expect(intermediate.newHarmonicUnlockIds).toEqual([]);

    const advanced = settle(store, "nicole", playInstrumentalistLevel("advanced"));
    // Seal AND emblem: the third tier completes the full pilgrimage.
    expect(advanced.newRewardIds).toEqual([
      "badge-ch01-advanced-seal",
      "badge-ch01-pilgrimage-emblem",
    ]);
    // Advanced completion is what opens the chapter's harmonic unlock.
    expect(advanced.newHarmonicUnlockIds).toEqual(["unlock-ch01-sustained-pad"]);

    expect(store.earnedRewardIds("nicole").sort()).toEqual([
      "badge-ch01-advanced-seal",
      "badge-ch01-beginner-crown",
      "badge-ch01-intermediate-lantern",
      "badge-ch01-pilgrimage-emblem",
    ]);
  });

  it("re-completing a tier grants nothing twice", () => {
    const store = new ProgressStore(new InMemoryProgressBackend());
    settle(store, "nicole", playInstrumentalistLevel("beginner"));
    const replay = settle(store, "nicole", playInstrumentalistLevel("beginner"));
    expect(replay.newRewardIds).toEqual([]);
    expect(replay.newHarmonicUnlockIds).toEqual([]);
    expect(store.earnedRewardIds("nicole")).toEqual(["badge-ch01-beginner-crown"]);
  });

  it("is track-agnostic: the singer track earns the same badges from the same rules", () => {
    const store = new ProgressStore(new InMemoryProgressBackend());
    const beginner = settle(store, "aluno", playSingerLevel("beginner"));
    expect(beginner.newRewardIds).toEqual(["badge-ch01-beginner-crown"]);

    settle(store, "aluno", playSingerLevel("intermediate"));
    const advanced = settle(store, "aluno", playSingerLevel("advanced"));
    expect(advanced.newRewardIds).toContain("badge-ch01-pilgrimage-emblem");
  });

  it("a failed level completes no chapter and earns nothing", () => {
    const store = new ProgressStore(new InMemoryProgressBackend());
    const twinkle = melodyById("melody-twinkle")!;
    const question = buildMissingNoteQuestion(twinkle, 2, "scale_degree");
    const gap = twinkle.notes[2]!;
    const wrong = question.options.find(
      (o) => !(o.note.letter === gap.note.letter && o.octave === gap.octave),
    )!;
    const plan: LevelPlan = {
      chapterId: chapter01.id,
      levelId: chapter01.levels[0]!.id,
      trackId: "singer",
      tier: tier("beginner"),
      testsNotationPrecision: false,
      challenges: [{ kind: "missing_note", id: "singer-ch01-q1", question }],
    };
    const result = runToResult(plan, [
      { type: "missing_note_event", event: { type: "choose_pitch", choice: wrong } },
    ]);
    expect(result.outcome).toBe("failed");
    const settled = settle(store, "aluno", result);
    expect(settled.newRewardIds).toEqual([]);
    expect(settled.progress.completedLevelIds).toEqual([]);
  });

  it("evaluateChapterGrants is pure and reads straight from the data criteria", () => {
    const store = new ProgressStore(new InMemoryProgressBackend());
    (["beginner", "intermediate", "advanced"] as const).forEach((t) =>
      store.recordLevelResult("nicole", playInstrumentalistLevel(t)),
    );
    const byTier = Object.fromEntries(
      (["beginner", "intermediate", "advanced"] as const).map((t) => [
        t,
        store.getProgress("nicole", "instrumentalist" as TrackId, t),
      ]),
    );
    const grants = evaluateChapterGrants(chapter01, rewards, unlocks, byTier, [], []);
    expect(grants.rewardIds).toHaveLength(4); // three tier badges + the emblem
    expect(grants.harmonicUnlockIds).toEqual(["unlock-ch01-sustained-pad"]);
  });
});
