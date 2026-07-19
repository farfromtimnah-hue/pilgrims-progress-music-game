// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { startLevel, levelFlowReducer, type LevelPlan, type LevelEvent } from "../../game/level-flow.js";
import type { AppContext } from "../context.js";
import { AudioEngine } from "../../engine/audio/audio-engine.js";
import { InMemoryLanguageBackend } from "../../engine/i18n/language-store.js";
import { ProgressStore, InMemoryProgressBackend } from "../../game/progress.js";
import { renderSideQuestChallenge } from "./singer-side-quest.js";
import {
  CH01_WALKING_QUESTION,
  CH01_FINISH_QUESTION,
  CH01_HIDDEN_COMPANION_QUESTION,
  CH01_BETTER_PATH_QUESTION,
} from "../../content/chapter-01.js";

class SilentBackend {
  events: string[] = [];
  start = async () => {};
  playNote = () => {};
  playChord = () => {};
  stop = () => {};
}

function fakeCtx(): AppContext {
  void InMemoryLanguageBackend;
  return {
    language: "en",
    playerId: "p1",
    audio: new AudioEngine(new SilentBackend() as never),
    progress: new ProgressStore(new InMemoryProgressBackend()),
    data: {} as never,
    currentTrackId: "singer",
  };
}

function planFor(quest: LevelPlan["challenges"][number]): LevelPlan {
  return {
    chapterId: "ch01",
    levelId: "ch01-l01",
    trackId: "singer",
    tier: { id: "beginner", name: { en: "Beginner", pt: "Iniciante" }, description: { en: "", pt: "" }, closeAnswerPolicy: "neutral" } as never,
    testsNotationPrecision: false,
    challenges: [quest],
  };
}

describe("side-quest UI wiring: walking / finish / hidden-companion", () => {
  it("Walking Beside the Melody completes on the correct motion pick", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-walking-beside-the-melody",
      contextKeyId: "C-major",
      quest: { kind: "walking_beside_the_melody", question: CH01_WALKING_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;

    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };

    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);
    const el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    const contraryBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.includes("opposite directions"));
    expect(contraryBtn).toBeDefined();
    contraryBtn!.click();

    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "complete" && e.effect.success)).toBe(true);
    expect(state.phase).toBe("complete");
  });

  it("Walking Beside the Melody renders a retry hint on a wrong pick, then completes on the second", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-walking-beside-the-melody",
      contextKeyId: "C-major",
      quest: { kind: "walking_beside_the_melody", question: CH01_WALKING_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;
    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };
    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);
    let el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    const wrongBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.includes("moving together"));
    wrongBtn!.click();
    expect(state.phase).toBe("running");
    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "retry")).toBe(true);

    el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    expect(el.textContent).toMatch(/Follow just the lower voice/);
    const correctBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.includes("opposite directions"));
    correctBtn!.click();
    expect(state.phase).toBe("complete");
  });

  it("Finish the Phrase completes on the correct resolution pick (C5)", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-finish-the-phrase",
      contextKeyId: "C-major",
      quest: { kind: "finish_the_phrase", question: CH01_FINISH_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;
    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };
    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);
    const el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    const buttons = Array.from(el.querySelectorAll("button"));
    expect(buttons.length).toBe(3);
    // The correct option is the derived tendency-tone resolution (C5).
    const correctIndex = CH01_FINISH_QUESTION.options.findIndex((o) => o.note.letter === "C" && o.octave === 5);
    buttons[correctIndex]!.click();

    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "complete" && e.effect.success)).toBe(true);
    expect(state.phase).toBe("complete");
  });

  it("Hidden Companion completes on choosing the real companion line, and audition dispatches without completing", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-hidden-companion",
      contextKeyId: "C-major",
      quest: { kind: "hidden_companion", question: CH01_HIDDEN_COMPANION_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;
    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };
    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);
    let el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);

    // Audition the first candidate — should not complete the quest.
    const auditionButtons = Array.from(el.querySelectorAll("button")).filter((b) => b.textContent?.includes("Audition line"));
    expect(auditionButtons.length).toBe(CH01_HIDDEN_COMPANION_QUESTION.options.length);
    auditionButtons[0]!.click();
    expect(state.phase).toBe("running");

    // Choose the real companion index.
    el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    const chooseButtons = Array.from(el.querySelectorAll("button")).filter((b) => b.textContent?.includes("Choose line"));
    chooseButtons[CH01_HIDDEN_COMPANION_QUESTION.companionIndex]!.click();

    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "complete" && e.effect.success)).toBe(true);
    expect(state.phase).toBe("complete");
  });

  it("Choose the Better Path completes on the judged-better pick and shows the real explanation", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-choose-the-better-path",
      contextKeyId: "C-major",
      quest: { kind: "choose_the_better_path", question: CH01_BETTER_PATH_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;
    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };
    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);

    // Both duets play before any choice exists to make.
    const duetsAtStart = effects.filter((e) => e.type === "side_quest" && e.effect.type === "play_duet");
    expect(duetsAtStart.length).toBe(2);

    let el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    const correctLabel = `Choose companion ${CH01_BETTER_PATH_QUESTION.better.toUpperCase()}`;
    const correctBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === correctLabel);
    expect(correctBtn).toBeDefined();
    correctBtn!.click();

    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "complete" && e.effect.success)).toBe(true);
    expect(state.phase).toBe("complete");

    // The reveal carries the judgment's real explanation (the level-runner
    // renders it — on the completion screen when the quest ends the level).
    const reveal = effects.find((e) => e.type === "side_quest" && e.effect.type === "reveal");
    expect(reveal && reveal.type === "side_quest" && reveal.effect.type === "reveal" ? reveal.effect.text.en : "").toBe(
      CH01_BETTER_PATH_QUESTION.explanation.en,
    );
  });

  it("Choose the Better Path retries with both duets on the first wrong pick, reveals on the second", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-choose-the-better-path",
      contextKeyId: "C-major",
      quest: { kind: "choose_the_better_path", question: CH01_BETTER_PATH_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;
    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };
    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);

    const wrongLabel = `Choose companion ${CH01_BETTER_PATH_QUESTION.better === "a" ? "B" : "A"}`;
    let el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    Array.from(el.querySelectorAll("button")).find((b) => b.textContent === wrongLabel)!.click();

    expect(state.phase).toBe("running");
    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "retry")).toBe(true);
    expect(effects.filter((e) => e.type === "side_quest" && e.effect.type === "play_duet").length).toBe(2);

    el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);
    expect(el.textContent).toMatch(/Listen again/);
    Array.from(el.querySelectorAll("button")).find((b) => b.textContent === wrongLabel)!.click();

    expect(state.phase).toBe("complete");
    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "complete" && !e.effect.success)).toBe(true);
    const reveal = effects.find((e) => e.type === "side_quest" && e.effect.type === "reveal");
    expect(reveal && reveal.type === "side_quest" && reveal.effect.type === "reveal" ? reveal.effect.text.en : "").toBe(
      CH01_BETTER_PATH_QUESTION.explanation.en,
    );
  });

  it("Choose the Better Path replays a single companion's duet on demand without completing or counting as a pick", () => {
    const ctx = fakeCtx();
    const plan = planFor({
      kind: "side_quest",
      id: "ch01-choose-the-better-path",
      contextKeyId: "C-major",
      quest: { kind: "choose_the_better_path", question: CH01_BETTER_PATH_QUESTION },
    });
    const started = startLevel(plan);
    let state = started.state;
    let effects = started.effects;
    const dispatch = (event: LevelEvent) => {
      const t = levelFlowReducer(state, event, plan);
      state = t.state;
      effects = t.effects;
    };
    const runtime = () => (state.runtime as Extract<typeof state.runtime, { kind: "side_quest" }>);
    const el = renderSideQuestChallenge(ctx, plan.challenges[0]!.kind === "side_quest" ? plan.challenges[0]!.quest : undefined, runtime(), effects, dispatch);

    const replayBtn = Array.from(el.querySelectorAll("button")).find((b) => b.textContent === "Replay companion A");
    expect(replayBtn).toBeDefined();
    replayBtn!.click();

    expect(state.phase).toBe("running");
    const duetEffects = effects.filter((e) => e.type === "side_quest" && e.effect.type === "play_duet");
    expect(duetEffects).toHaveLength(1);
    expect(effects.some((e) => e.type === "side_quest" && e.effect.type === "complete")).toBe(false);
  });
});
