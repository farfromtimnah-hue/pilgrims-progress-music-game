import { describe, expect, it } from "vitest";
import { spelled } from "../../../engine/theory/pitch.js";
import type { SpelledNote } from "../../../engine/types/schema.js";
import type { MelodyNote } from "../missing-note/melodies.js";
import {
  assessLine,
  buildBetterPathQuestion,
  judgeHarmonyLines,
  MARGIN_TOO_CLOSE,
} from "./naturalness.js";

const n = (letter: string, octave = 4, beats = 1): MelodyNote => ({
  note: spelled(letter as SpelledNote["letter"]),
  octave,
  beats,
});

// A stepwise melody: C D E F G
const melody = [n("C"), n("D"), n("E"), n("F"), n("G")];
// Block harmony: parallel 3rds below, every step.
const blockLine = [n("A", 3), n("B", 3), n("C"), n("D"), n("E")];
// Independent companion: holds, then moves against the melody.
const movingLine = [n("E"), n("D"), n("C"), n("D"), n("C")];

describe("assessLine", () => {
  it("flags an all-parallel line as a shadow", () => {
    const a = assessLine(melody, blockLine);
    expect(a.parallelSteps).toBe(4);
    expect(a.isShadow).toBe(true);
  });

  it("credits an independent line's contrary/oblique motion", () => {
    const a = assessLine(melody, movingLine);
    expect(a.motion.counts.contrary).toBeGreaterThan(0);
    expect(a.isShadow).toBe(false);
    expect(a.score).toBeGreaterThan(assessLine(melody, blockLine).score);
  });

  it("penalizes dissonant verticals against the melody", () => {
    const clashing = [n("B", 3), n("C"), n("D"), n("E"), n("F")]; // 2nds below throughout
    const consonant = [n("E", 3), n("F", 3), n("G", 3), n("A", 3), n("B", 3)];
    expect(assessLine(melody, clashing).dissonantVerticals).toBeGreaterThan(
      assessLine(melody, consonant).dissonantVerticals,
    );
  });
});

describe("judgeHarmonyLines", () => {
  it("prefers the moving, independent line over block harmony", () => {
    const judged = judgeHarmonyLines(melody, blockLine, movingLine);
    expect(judged.verdict).toBe("b");
  });

  it("explains the verdict in both languages, naming block harmony", () => {
    const judged = judgeHarmonyLines(melody, blockLine, movingLine);
    if (judged.verdict === "too_close_to_call") throw new Error("expected a verdict");
    expect(judged.explanation.en).toContain("block harmony");
    expect(judged.explanation.pt).toContain("harmonia em bloco");
    expect(judged.explanation.en).toContain("more natural");
    expect(judged.explanation.pt).toContain("mais natural");
  });

  it("refuses to call two equally natural lines", () => {
    // The same line against itself: identical scores, margin 0.
    const judged = judgeHarmonyLines(melody, movingLine, [...movingLine]);
    expect(judged.verdict).toBe("too_close_to_call");
    expect(judged.margin).toBeLessThan(MARGIN_TOO_CLOSE);
  });

  it("is symmetric: swapping the lines swaps the verdict", () => {
    const ab = judgeHarmonyLines(melody, blockLine, movingLine);
    const ba = judgeHarmonyLines(melody, movingLine, blockLine);
    expect(ab.verdict).toBe("b");
    expect(ba.verdict).toBe("a");
  });
});

describe("buildBetterPathQuestion", () => {
  it("builds a playable question with the judged answer and explanation", () => {
    const q = buildBetterPathQuestion("q1", melody, blockLine, movingLine);
    expect(q.better).toBe("b");
    expect(q.explanation.pt.length).toBeGreaterThan(0);
  });

  it("throws loudly on un-derivable content instead of guessing", () => {
    expect(() => buildBetterPathQuestion("q2", melody, movingLine, [...movingLine])).toThrow(
      /too close to call/,
    );
  });
});
