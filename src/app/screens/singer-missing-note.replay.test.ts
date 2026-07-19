// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { startLevel, levelFlowReducer, type LevelPlan, type LevelEvent } from "../../game/level-flow.js";
import type { AppContext } from "../context.js";
import { AudioEngine } from "../../engine/audio/audio-engine.js";
import { ProgressStore, InMemoryProgressBackend } from "../../game/progress.js";
import { renderMissingNoteChallenge, renderMissingNoteOptions } from "./singer-missing-note.js";
import { ch01MissingNoteQuestion } from "../../content/chapter-01.js";

class SilentBackend {
  start = async () => {};
  playNote = () => {};
  playChord = () => {};
  stop = () => {};
}

function fakeCtx(): AppContext {
  return {
    language: "en",
    playerId: "p1",
    audio: new AudioEngine(new SilentBackend() as never),
    progress: new ProgressStore(new InMemoryProgressBackend()),
    data: {} as never,
    currentTrackId: "singer",
  };
}

function planFor(question: ReturnType<typeof ch01MissingNoteQuestion>): LevelPlan {
  return {
    chapterId: "ch01",
    levelId: "ch01-l01",
    trackId: "singer",
    tier: { id: "beginner", name: { en: "Beginner", pt: "Iniciante" }, description: { en: "", pt: "" }, closeAnswerPolicy: "neutral" } as never,
    testsNotationPrecision: false,
    challenges: [{ kind: "missing_note", id: "ch01-missing-note", question }],
  };
}

describe("missing-note UI: replay and per-option preview", () => {
  it("Replay button re-fires the full-then-gapped phrase without completing", () => {
    const ctx = fakeCtx();
    const question = ch01MissingNoteQuestion();
    const plan = planFor(question);
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;

    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };

    const runtime = () => state.runtime as Extract<typeof state.runtime, { kind: "missing_note" }>;
    const el = renderMissingNoteChallenge(ctx, runtime(), effects, dispatch);

    const replayBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.includes("Replay phrase"));
    expect(replayBtn).toBeDefined();
    replayBtn!.click();

    expect(state.phase).toBe("running");
    const phraseEffects = effects.filter((e) => e.type === "missing_note" && e.effect.type === "play_phrase");
    expect(phraseEffects.map((e) => (e.type === "missing_note" && e.effect.type === "play_phrase" ? e.effect.which : undefined))).toEqual([
      "full",
      "gapped",
    ]);
    expect(effects.some((e) => e.type === "missing_note" && e.effect.type === "complete")).toBe(false);
  });

  it("Preview button plays a single option in context without submitting an answer", () => {
    const ctx = fakeCtx();
    const question = ch01MissingNoteQuestion();
    const plan = planFor(question);
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;

    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };

    const runtime = () => state.runtime as Extract<typeof state.runtime, { kind: "missing_note" }>;
    const challenge = plan.challenges[0]! as Extract<LevelPlan["challenges"][number], { kind: "missing_note" }>;
    const el = renderMissingNoteOptions(ctx, challenge, runtime(), dispatch);

    const previewButtons = Array.from(el.querySelectorAll("button")).filter((b) => b.textContent?.startsWith("🔊 Preview"));
    expect(previewButtons.length).toBe(challenge.question.options.length);

    previewButtons[0]!.click();

    expect(state.phase).toBe("running");
    const previewEffects = effects.filter((e) => e.type === "missing_note" && e.effect.type === "play_phrase" && e.effect.which === "with_choice");
    expect(previewEffects).toHaveLength(1);
    expect(effects.some((e) => e.type === "missing_note" && e.effect.type === "show_result")).toBe(false);
    expect(effects.some((e) => e.type === "missing_note" && e.effect.type === "complete")).toBe(false);
  });

  it("choosing the actual answer still submits and completes correctly", () => {
    const ctx = fakeCtx();
    const question = ch01MissingNoteQuestion();
    const plan = planFor(question);
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;

    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };

    const runtime = () => state.runtime as Extract<typeof state.runtime, { kind: "missing_note" }>;
    const challenge = plan.challenges[0]! as Extract<LevelPlan["challenges"][number], { kind: "missing_note" }>;
    const el = renderMissingNoteOptions(ctx, challenge, runtime(), dispatch);

    const gap = question.melody.notes[question.gapIndex]!;
    const correctIndex = question.options.findIndex((o) => o.note.letter === gap.note.letter && o.octave === gap.octave);
    const chooseButtons = Array.from(el.querySelectorAll("button")).filter((b) => !b.textContent?.startsWith("🔊 Preview"));
    expect(chooseButtons.length).toBe(challenge.question.options.length);

    chooseButtons[correctIndex]!.click();

    expect(effects.some((e) => e.type === "missing_note" && e.effect.type === "show_result" && e.effect.correct)).toBe(true);
    expect(effects.some((e) => e.type === "missing_note" && e.effect.type === "complete" && e.effect.correct)).toBe(true);
  });
});
