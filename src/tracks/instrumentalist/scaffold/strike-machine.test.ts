import { describe, expect, it } from "vitest";
import {
  INITIAL_STRIKE_STATE,
  strikeReducer,
  type StrikeEvent,
  type StrikeState,
} from "./strike-machine.js";

function run(events: StrikeEvent[], from: StrikeState = INITIAL_STRIKE_STATE) {
  let state = from;
  const allEffects = [];
  for (const e of events) {
    const t = strikeReducer(state, e);
    state = t.state;
    allEffects.push(t.effects.map((f) => f.type));
  }
  return { state, allEffects };
}

describe("strike machine — escalation", () => {
  it("strike 1: damage + short prompt, play continues", () => {
    const t = strikeReducer(INITIAL_STRIKE_STATE, { type: "mistake" });
    expect(t.state).toEqual({ phase: "answering", strikes: 1 });
    expect(t.effects.map((f) => f.type)).toEqual(["apply_damage", "show_short_prompt"]);
  });

  it("strike 2: pause and ask the smaller diagnostic question", () => {
    const { state, allEffects } = run([{ type: "mistake" }, { type: "mistake" }]);
    expect(state).toEqual({ phase: "diagnostic", strikes: 2 });
    expect(allEffects[1]).toEqual(["pause_for_diagnostic"]);
  });

  it("strike 3: route into a scaffold sequence, no extra damage", () => {
    const { state, allEffects } = run([
      { type: "mistake" },
      { type: "mistake" },
      { type: "diagnostic_answered", correct: true },
      { type: "mistake" },
    ]);
    expect(state).toEqual({ phase: "scaffold", strikes: 3 });
    expect(allEffects[3]).toEqual(["enter_scaffold_sequence"]);
  });
});

describe("strike machine — diagnostic branch", () => {
  it("passing the diagnostic re-enters the question with strikes preserved at 2", () => {
    const { state, allEffects } = run([
      { type: "mistake" },
      { type: "mistake" },
      { type: "diagnostic_answered", correct: true },
    ]);
    expect(state).toEqual({ phase: "answering", strikes: 2 });
    expect(allEffects[2]).toEqual(["reenter_question"]);
  });

  it("failing the diagnostic escalates straight into the scaffold sequence", () => {
    const { state } = run([
      { type: "mistake" },
      { type: "mistake" },
      { type: "diagnostic_answered", correct: false },
    ]);
    expect(state).toEqual({ phase: "scaffold", strikes: 3 });
  });

  it("ignores answer events while paused on the diagnostic", () => {
    const paused: StrikeState = { phase: "diagnostic", strikes: 2 };
    expect(strikeReducer(paused, { type: "mistake" }).state).toEqual(paused);
    expect(strikeReducer(paused, { type: "correct" }).state).toEqual(paused);
  });
});

describe("strike machine — recovery", () => {
  it("a correct answer clears accumulated strikes", () => {
    const { state, allEffects } = run([{ type: "mistake" }, { type: "correct" }]);
    expect(state).toEqual({ phase: "answering", strikes: 0 });
    expect(allEffects[1]).toEqual(["clear_strikes"]);
  });

  it("completing the scaffold sequence clears strikes and re-enters the question", () => {
    const { state, allEffects } = run([
      { type: "mistake" },
      { type: "mistake" },
      { type: "diagnostic_answered", correct: false },
      { type: "scaffold_completed" },
    ]);
    expect(state).toEqual({ phase: "answering", strikes: 0 });
    expect(allEffects[3]).toEqual(["clear_strikes", "reenter_question"]);
  });

  it("after scaffold re-entry the cycle starts fresh: next mistake is strike 1 again", () => {
    const { allEffects } = run([
      { type: "mistake" },
      { type: "mistake" },
      { type: "diagnostic_answered", correct: false },
      { type: "scaffold_completed" },
      { type: "mistake" },
    ]);
    expect(allEffects[4]).toEqual(["apply_damage", "show_short_prompt"]);
  });

  it("ignores scaffold_completed outside the scaffold phase", () => {
    const t = strikeReducer(INITIAL_STRIKE_STATE, { type: "scaffold_completed" });
    expect(t.state).toEqual(INITIAL_STRIKE_STATE);
    expect(t.effects).toEqual([]);
  });
});
