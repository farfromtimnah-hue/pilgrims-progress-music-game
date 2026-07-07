import { describe, expect, it } from "vitest";
import { display } from "../i18n/localized-text.js";
import {
  INTERVALS,
  intervalFromSemitones,
  semitonesBetween,
  transposeByInterval,
} from "./intervals.js";
import { spelled } from "./pitch.js";

describe("interval definitions", () => {
  it("names every interval in both languages", () => {
    for (const def of Object.values(INTERVALS)) {
      expect(def.name.en.length).toBeGreaterThan(0);
      expect(def.name.pt.length).toBeGreaterThan(0);
    }
  });

  it("P5 is 'perfect 5th' in EN and 'quinta justa' in PT", () => {
    expect(display(INTERVALS.P5.name, "en")).toBe("perfect 5th");
    expect(display(INTERVALS.P5.name, "pt")).toBe("quinta justa");
  });

  it("maps semitone distances back to interval ids", () => {
    expect(intervalFromSemitones(7)).toBe("P5");
    expect(intervalFromSemitones(-3)).toBe("m3"); // direction-agnostic
    expect(intervalFromSemitones(13)).toBeNull();
  });
});

describe("transposeByInterval — spelled transposition", () => {
  it("ascends a perfect 5th from C4 to G4", () => {
    expect(transposeByInterval({ note: spelled("C"), octave: 4 }, "P5", "ascending")).toEqual({
      note: spelled("G"),
      octave: 4,
    });
  });

  it("spells a minor 3rd up from G as B♭ (not A♯)", () => {
    expect(transposeByInterval({ note: spelled("G"), octave: 4 }, "m3", "ascending")).toEqual({
      note: spelled("B", "b"),
      octave: 4,
    });
  });

  it("descends a major 6th from D5 to F4, crossing the octave", () => {
    expect(transposeByInterval({ note: spelled("D"), octave: 5 }, "M6", "descending")).toEqual({
      note: spelled("F"),
      octave: 4,
    });
  });

  it("octave up keeps the spelling and bumps the octave", () => {
    expect(transposeByInterval({ note: spelled("E", "b"), octave: 3 }, "P8", "ascending")).toEqual({
      note: spelled("E", "b"),
      octave: 4,
    });
  });

  it("round-trips: transposing and measuring agree", () => {
    const start = { note: spelled("A"), octave: 3 };
    for (const def of Object.values(INTERVALS)) {
      const up = transposeByInterval(start, def.id, "ascending");
      expect(semitonesBetween(start, up)).toBe(def.semitones);
    }
  });
});
