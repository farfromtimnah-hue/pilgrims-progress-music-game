/**
 * Progress-tracking tests. The LevelResults folded in here are produced by
 * running the REAL level flow over real singer modules (buildMissingNoteQuestion,
 * missingNoteReducer) — not hand-built fixtures — so the pipeline
 * level flow → LevelResult → PlayerProgress is exercised end-to-end.
 */
import { describe, expect, it } from "vitest";

import tiersJson from "../../data/difficulty-tiers.json";
import type { DifficultyTier, DifficultyTierId } from "../engine/types/schema.js";
import { melodyById } from "../tracks/singer/missing-note/melodies.js";
import { buildMissingNoteQuestion } from "../tracks/singer/missing-note/missing-note-quiz.js";
import type { Challenge } from "./challenges.js";
import {
  levelFlowReducer,
  startLevel,
  type LevelEffect,
  type LevelPlan,
  type LevelResult,
} from "./level-flow.js";
import { InMemoryProgressBackend, ProgressStore, applyLevelResult, hasCompletedLevels } from "./progress.js";

const tiers = (tiersJson as { tiers: DifficultyTier[] }).tiers;
const tier = (id: DifficultyTierId): DifficultyTier => tiers.find((t) => t.id === id)!;

/** Play a one-challenge missing-note level for real and return its result. */
function playLevel(levelId: string, tierId: DifficultyTierId, chooseCorrectly: boolean): LevelResult {
  const twinkle = melodyById("melody-twinkle")!;
  const question = buildMissingNoteQuestion(twinkle, 2, "scale_degree");
  const challenge: Challenge = { kind: "missing_note", id: `${levelId}-q1`, question };
  const plan: LevelPlan = {
    chapterId: "ch01",
    levelId,
    trackId: "singer",
    tier: tier(tierId),
    testsNotationPrecision: false,
    challenges: [challenge],
  };
  const gap = twinkle.notes[2]!;
  const wrong = question.options.find(
    (o) => !(o.note.letter === gap.note.letter && o.octave === gap.octave),
  )!;
  const choice = chooseCorrectly ? { note: gap.note, octave: gap.octave } : wrong;

  const started = startLevel(plan);
  const t = levelFlowReducer(started.state, { type: "missing_note_event", event: { type: "choose_pitch", choice } }, plan);
  const done = t.effects.find((e) => e.type === "level_complete") as Extract<
    LevelEffect,
    { type: "level_complete" }
  >;
  return done.result;
}

function makeStore(): { store: ProgressStore; backend: InMemoryProgressBackend } {
  const backend = new InMemoryProgressBackend();
  let tick = 0;
  const store = new ProgressStore(backend, () => `2026-07-10T00:00:0${tick++}.000Z`);
  return { store, backend };
}

describe("progress tracking", () => {
  it("records a passed level into a fresh per-track-per-tier record", () => {
    const { store } = makeStore();
    const result = playLevel("ch01-l01", "beginner", true);
    expect(result.outcome).toBe("passed");

    const record = store.recordLevelResult("nicole", result);
    expect(record).toMatchObject({
      playerId: "nicole",
      trackId: "singer",
      tierId: "beginner",
      currentChapterId: "ch01",
      currentLevelId: "ch01-l01",
      completedLevelIds: ["ch01-l01"],
    });
    expect(record.attemptHistory).toHaveLength(1);
    expect(record.attemptHistory[0]).toMatchObject({
      quizTemplateId: "ch01-l01-q1",
      levelId: "ch01-l01",
      result: "passed",
      answerResults: ["correct"],
      strikesUsed: 0,
      enteredScaffoldSequence: false,
    });
    expect(hasCompletedLevels(record, ["ch01-l01"])).toBe(true);
  });

  it("re-completing a passed tier appends history without duplicating completion", () => {
    const { store } = makeStore();
    store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", true));
    const after = store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", true));

    expect(after.completedLevelIds).toEqual(["ch01-l01"]); // no duplicate
    expect(after.attemptHistory).toHaveLength(2); // history is history
    expect(store.allForPlayer("nicole")).toHaveLength(1); // still one record for this track+tier
  });

  it("a failed run records the attempt but not completion — and a later pass completes", () => {
    const { store } = makeStore();
    const failed = store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", false));
    expect(failed.completedLevelIds).toEqual([]);
    expect(failed.attemptHistory[0]!.result).toBe("failed");
    expect(failed.attemptHistory[0]!.answerResults).toEqual(["wrong"]);

    const passed = store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", true));
    expect(passed.completedLevelIds).toEqual(["ch01-l01"]);
    expect(passed.attemptHistory).toHaveLength(2);
  });

  it("keeps tiers in separate records — completing Beginner says nothing about Advanced", () => {
    const { store } = makeStore();
    store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", true));
    store.recordLevelResult("nicole", playLevel("ch01-l01", "advanced", true));

    expect(store.allForPlayer("nicole")).toHaveLength(2);
    expect(store.getProgress("nicole", "singer", "beginner")!.completedLevelIds).toEqual(["ch01-l01"]);
    expect(store.getProgress("nicole", "singer", "advanced")!.completedLevelIds).toEqual(["ch01-l01"]);
    expect(store.getProgress("nicole", "singer", "intermediate")).toBeNull();
  });

  it("a corrupt stored blob reads as no progress, never a crash", () => {
    const { store, backend } = makeStore();
    backend.write("nicole", "{not json");
    expect(store.allForPlayer("nicole")).toEqual([]);
    backend.write("nicole", JSON.stringify({ wrong: "shape" }));
    expect(store.getProgress("nicole", "singer", "beginner")).toBeNull();
    // …and recording over corruption starts clean rather than corrupting further.
    const record = store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", true));
    expect(record.completedLevelIds).toEqual(["ch01-l01"]);
  });

  it("grantRewards and grantHarmonicUnlocks never duplicate", () => {
    const { store } = makeStore();
    store.recordLevelResult("nicole", playLevel("ch01-l01", "beginner", true));
    store.grantRewards("nicole", "singer", "beginner", ["badge-a"]);
    const after = store.grantRewards("nicole", "singer", "beginner", ["badge-a", "badge-b"]);
    expect(after.earnedRewardIds).toEqual(["badge-a", "badge-b"]);

    store.grantHarmonicUnlocks("nicole", "singer", "beginner", ["unlock-1"]);
    const unlocked = store.grantHarmonicUnlocks("nicole", "singer", "beginner", ["unlock-1"]);
    expect(unlocked.harmonicUnlockIds).toEqual(["unlock-1"]);
    expect(store.earnedRewardIds("nicole")).toEqual(["badge-a", "badge-b"]);
  });

  it("applyLevelResult refuses to fold a result into the wrong record", () => {
    const result = playLevel("ch01-l01", "beginner", true);
    const other = applyLevelResult(null, "nicole", playLevel("ch01-l01", "advanced", true), "2026-07-10T00:00:00Z");
    expect(() => applyLevelResult(other, "nicole", result, "2026-07-10T00:00:01Z")).toThrow(/Progress record is for singer\/advanced/);
  });
});
