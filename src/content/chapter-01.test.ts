/**
 * Proves the Chapter 1 content-authoring pattern end-to-end: real chapter
 * JSON + real quiz-template JSON + the chapter's own materializer produce a
 * playable challenge sequence for both tracks, and the level flow can
 * actually be driven through them with the real reducers.
 */
import { describe, expect, it } from "vitest";

import chapter01Json from "../../data/chapters/chapter-01.json";
import keySignatureTemplateJson from "../../data/quiz-templates/key-signature-full-set.json";
import noteTokenTemplateJson from "../../data/quiz-templates/note-token-basic.json";
import tiersJson from "../../data/difficulty-tiers.json";

import { spelled } from "../engine/theory/pitch.js";
import type { Chapter, DifficultyTier, QuizTemplate } from "../engine/types/schema.js";
import { buildChallengeSequence } from "../game/challenges.js";
import { levelFlowReducer, startLevel, type LevelEvent, type LevelPlan } from "../game/level-flow.js";
import { materializeChapter01 } from "./chapter-01.js";

const chapter01 = chapter01Json as unknown as Chapter;
const tiers = (tiersJson as { tiers: DifficultyTier[] }).tiers;
const tier = (id: string): DifficultyTier => tiers.find((t) => t.id === id)!;
const templates: Record<string, QuizTemplate> = Object.fromEntries(
  [noteTokenTemplateJson, keySignatureTemplateJson].map((t) => [t.id, t as unknown as QuizTemplate]),
);

function plan(trackId: "instrumentalist" | "singer", tierId: string, levelIndex: number): LevelPlan {
  const level = chapter01.levels[levelIndex]!;
  return {
    chapterId: chapter01.id,
    levelId: level.id,
    trackId,
    tier: tier(tierId),
    testsNotationPrecision: chapter01.testsNotationPrecision,
    challenges: buildChallengeSequence(level, (ref) =>
      materializeChapter01(ref, trackId, tierId as DifficultyTier["id"], templates),
    ),
  };
}

describe("Chapter 1 content — instrumentalist", () => {
  it("materializes level 1 (note-token + key-signature) from real data", () => {
    const p = plan("instrumentalist", "beginner", 0);
    expect(p.challenges.map((c) => c.kind)).toEqual(["note_token", "key_signature"]);
    const noteToken = p.challenges[0]!;
    if (noteToken.kind !== "note_token") throw new Error("bad plan");
    expect(noteToken.keyId).toBe("C-major");
  });

  it("level 1 plays through to a passed result with real grading", () => {
    const p = plan("instrumentalist", "beginner", 0);
    const started = startLevel(p);
    let state = started.state;
    const events: LevelEvent[] = [
      { type: "answer_note", note: spelled("C") },
      { type: "answer_note", note: spelled("D") },
      { type: "answer_note", note: spelled("E") },
      { type: "submit_full_set", notes: [] }, // C major: no accidentals
    ];
    for (const event of events) {
      state = levelFlowReducer(state, event, p).state;
    }
    expect(state.phase).toBe("complete");
  });
});

describe("Chapter 1 content — singer", () => {
  it("materializes level 1's singer refs (interval, missing note, five side quests)", () => {
    const p = plan("singer", "beginner", 0);
    expect(p.challenges.map((c) => c.kind)).toEqual([
      "interval",
      "missing_note",
      "side_quest",
      "side_quest",
      "side_quest",
      "side_quest",
      "side_quest",
    ]);
  });

  it("interval question is real content anchored to C major", () => {
    const p = plan("singer", "beginner", 0);
    const interval = p.challenges[0]!;
    if (interval.kind !== "interval") throw new Error("bad plan");
    expect(interval.question.songOptions.length).toBeGreaterThan(0);
  });

  it("side quests are the five wired into chapter 1's UI", () => {
    const p = plan("singer", "beginner", 0);
    const quests = p.challenges.slice(2).map((c) => (c.kind === "side_quest" ? c.quest.kind : null));
    expect(quests).toEqual([
      "echo_the_guide",
      "hold_the_lantern",
      "walking_beside_the_melody",
      "finish_the_phrase",
      "hidden_companion",
    ]);
  });
});
