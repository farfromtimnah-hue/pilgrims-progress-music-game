import { describe, expect, it } from "vitest";
import { buildKey } from "../../../engine/theory/keys.js";
import { spelled } from "../../../engine/theory/pitch.js";
import type { SpelledNote } from "../../../engine/types/schema.js";
import {
  gradeFullSet,
  gradeMainAttempt,
  INITIAL_RECOVERY_STATE,
  recoveryReducer,
  type RecoveryAnswer,
  type RecoveryState,
} from "./key-signature-quiz.js";

const eMajor = buildKey(spelled("E"), "major"); // F# C# G# D#
const abMajor = buildKey(spelled("A", "b"), "major"); // Bb Eb Ab Db
const cMajor = buildKey(spelled("C"), "major"); // none

const E_MAJOR_SET: SpelledNote[] = [spelled("F", "#"), spelled("C", "#"), spelled("G", "#"), spelled("D", "#")];

describe("gradeFullSet — complete set, no extras", () => {
  it("passes the exact set regardless of selection order", () => {
    const shuffled = [spelled("D", "#"), spelled("F", "#"), spelled("G", "#"), spelled("C", "#")];
    expect(gradeFullSet(shuffled, eMajor.keySignature).correct).toBe(true);
  });

  it("fails an incomplete set and reports what is missing", () => {
    const grade = gradeFullSet(E_MAJOR_SET.slice(0, 3), eMajor.keySignature);
    expect(grade.correct).toBe(false);
    expect(grade.missing).toEqual([spelled("D", "#")]);
    expect(grade.extras).toEqual([]);
  });

  it("fails a complete set that has extras — no passing by over-selection", () => {
    const grade = gradeFullSet([...E_MAJOR_SET, spelled("A", "#")], eMajor.keySignature);
    expect(grade.correct).toBe(false);
    expect(grade.extras).toEqual([spelled("A", "#")]);
  });

  it("flags enharmonic wrong spellings (Gb selected where E major needs F#)", () => {
    const grade = gradeFullSet(
      [spelled("G", "b"), spelled("C", "#"), spelled("G", "#"), spelled("D", "#")],
      eMajor.keySignature,
    );
    expect(grade.correct).toBe(false);
    expect(grade.wrongSpellings).toEqual([{ selected: spelled("G", "b"), expected: spelled("F", "#") }]);
  });

  it("C major: only the empty set passes", () => {
    expect(gradeFullSet([], cMajor.keySignature).correct).toBe(true);
    expect(gradeFullSet([spelled("F", "#")], cMajor.keySignature).correct).toBe(false);
  });
});

describe("gradeMainAttempt", () => {
  it("passes on a correct set", () => {
    expect(gradeMainAttempt(E_MAJOR_SET, eMajor.keySignature).kind).toBe("passed");
  });

  it("routes a wrong answer into recovery at step 1 (circle side)", () => {
    const outcome = gradeMainAttempt([spelled("F", "#")], eMajor.keySignature);
    expect(outcome.kind).toBe("enter_recovery");
    if (outcome.kind === "enter_recovery") {
      expect(outcome.recovery.step).toBe("circle_side");
    }
  });
});

describe("recovery flow — the exact four-step order", () => {
  function step(state: RecoveryState, answer: RecoveryAnswer, key = eMajor, opts = {}) {
    return recoveryReducer(state, answer, key.key, key.keySignature, opts);
  }

  it("walks side → count → select → complete (order step off by default)", () => {
    let t = step(INITIAL_RECOVERY_STATE, { step: "circle_side", side: "sharp" });
    expect(t.state.step).toBe("accidental_count");

    t = step(t.state, { step: "accidental_count", count: 4 });
    expect(t.state.step).toBe("select_set");

    t = step(t.state, { step: "select_set", notes: E_MAJOR_SET });
    expect(t.state.step).toBe("complete");
    expect(t.effects.some((e) => e.type === "recovery_complete")).toBe(true);
  });

  it("includes the optional ordering step when enabled", () => {
    const opts = { includeOrderStep: true };
    let t = step(INITIAL_RECOVERY_STATE, { step: "circle_side", side: "sharp" }, eMajor, opts);
    t = step(t.state, { step: "accidental_count", count: 4 }, eMajor, opts);
    t = step(t.state, { step: "select_set", notes: [...E_MAJOR_SET].reverse() }, eMajor, opts);
    expect(t.state.step).toBe("order_set");

    // Wrong order retries with the fifths hint…
    const wrong = step(t.state, { step: "order_set", notes: [...E_MAJOR_SET].reverse() }, eMajor, opts);
    expect(wrong.state.step).toBe("order_set");
    expect(wrong.effects[0]!.type).toBe("retry_step");

    // …canonical order completes.
    const done = step(t.state, { step: "order_set", notes: E_MAJOR_SET }, eMajor, opts);
    expect(done.state.step).toBe("complete");
  });

  it("wrong circle side retries step 1 with a hint and counts the attempt", () => {
    const t = step(INITIAL_RECOVERY_STATE, { step: "circle_side", side: "flat" });
    expect(t.state).toEqual({ step: "circle_side", attemptsOnStep: 1 });
    expect(t.effects[0]!.type).toBe("retry_step");
  });

  it("hints carry both languages with the key named per language", () => {
    const t = step(INITIAL_RECOVERY_STATE, { step: "circle_side", side: "flat" });
    const effect = t.effects[0]!;
    expect(effect.type).toBe("retry_step");
    if (effect.type === "retry_step") {
      expect(effect.hint.en).toContain("E major");
      expect(effect.hint.pt).toContain("Mi maior");
      expect(effect.hint.pt).toContain("círculo das quintas");
    }
  });

  it("ordering mnemonics use letters in EN and solfège in PT", () => {
    const opts = { includeOrderStep: true };
    const atOrder: RecoveryState = { step: "order_set", attemptsOnStep: 0 };
    const t = step(atOrder, { step: "order_set", notes: [...E_MAJOR_SET].reverse() }, eMajor, opts);
    const effect = t.effects[0]!;
    expect(effect.type).toBe("retry_step");
    if (effect.type === "retry_step") {
      expect(effect.hint.en).toContain("F C G D A E B");
      expect(effect.hint.pt).toContain("Fá Dó Sol Ré Lá Mi Si");
    }
  });

  it("wrong count retries step 2", () => {
    const atCount: RecoveryState = { step: "accidental_count", attemptsOnStep: 0 };
    const t = step(atCount, { step: "accidental_count", count: 3 });
    expect(t.state).toEqual({ step: "accidental_count", attemptsOnStep: 1 });
  });

  it("wrong-spelling selection at step 3 gets the enharmonic hint", () => {
    const atSelect: RecoveryState = { step: "select_set", attemptsOnStep: 0 };
    const t = step(atSelect, {
      step: "select_set",
      notes: [spelled("G", "b"), spelled("C", "#"), spelled("G", "#"), spelled("D", "#")],
    });
    expect(t.state.step).toBe("select_set");
    const effect = t.effects[0]!;
    expect(effect.type).toBe("retry_step");
    if (effect.type === "retry_step") {
      expect(effect.hint.en).toContain("F♯");
      expect(effect.hint.en).toContain("G♭");
      expect(effect.hint.pt).toContain("Fá♯");
      expect(effect.hint.pt).toContain("Sol♭");
    }
  });

  it("works for flat keys (Ab major: flat side, 4 flats)", () => {
    let t = step(INITIAL_RECOVERY_STATE, { step: "circle_side", side: "flat" }, abMajor);
    t = step(t.state, { step: "accidental_count", count: 4 }, abMajor);
    t = step(
      t.state,
      { step: "select_set", notes: [spelled("B", "b"), spelled("E", "b"), spelled("A", "b"), spelled("D", "b")] },
      abMajor,
    );
    expect(t.state.step).toBe("complete");
  });

  it("C major short-circuits: side 'none' completes immediately", () => {
    const t = step(INITIAL_RECOVERY_STATE, { step: "circle_side", side: "none" }, cMajor);
    expect(t.state.step).toBe("complete");
  });

  it("ignores answers for a step that is not current", () => {
    const t = step(INITIAL_RECOVERY_STATE, { step: "accidental_count", count: 4 });
    expect(t.state).toEqual(INITIAL_RECOVERY_STATE);
    expect(t.effects).toEqual([]);
  });
});
