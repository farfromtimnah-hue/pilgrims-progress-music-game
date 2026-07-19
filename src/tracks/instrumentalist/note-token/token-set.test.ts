import { describe, expect, it } from "vitest";
import { buildKey } from "../../../engine/theory/keys.js";
import { spelled } from "../../../engine/theory/pitch.js";
import { gradeNoteToken } from "./grade.js";
import { buildNoteTokenSet } from "./token-set.js";

describe("buildNoteTokenSet", () => {
  const cMajor = buildKey(spelled("C"), "major");

  it("produces exactly `count` tokens", () => {
    expect(buildNoteTokenSet(cMajor, 6, 1)).toHaveLength(6);
    expect(buildNoteTokenSet(cMajor, 10, 1)).toHaveLength(10);
  });

  it("roughly half grade correct, half wrong, none are silently mis-gradeable", () => {
    const tokens = buildNoteTokenSet(cMajor, 8, 42);
    const results = tokens.map((t) => gradeNoteToken(t.note, cMajor.scale).result);
    expect(results.filter((r) => r === "correct")).toHaveLength(4);
    expect(results.filter((r) => r === "wrong")).toHaveLength(4);
  });

  it("is deterministic for a given seed", () => {
    const a = buildNoteTokenSet(cMajor, 6, 7);
    const b = buildNoteTokenSet(cMajor, 6, 7);
    expect(a).toEqual(b);
  });

  it("varies with the seed", () => {
    const a = buildNoteTokenSet(cMajor, 6, 1);
    const b = buildNoteTokenSet(cMajor, 6, 2);
    expect(a).not.toEqual(b);
  });

  it("works for a key with few out-of-key naturals (many accidentals)", () => {
    const csMajor = buildKey(spelled("C", "#"), "major");
    const tokens = buildNoteTokenSet(csMajor, 10, 3);
    expect(tokens).toHaveLength(10);
  });
});
