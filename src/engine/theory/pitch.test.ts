import { describe, expect, it } from "vitest";
import { frequencyOf, isEnharmonic, midiOf, pitchClassOf, spelled } from "./pitch.js";

describe("pitchClassOf", () => {
  it("handles naturals", () => {
    expect(pitchClassOf(spelled("C"))).toBe(0);
    expect(pitchClassOf(spelled("A"))).toBe(9);
  });

  it("handles the theoretical spellings B#, E#, Cb, Fb", () => {
    expect(pitchClassOf(spelled("B", "#"))).toBe(0); // sounds like C
    expect(pitchClassOf(spelled("E", "#"))).toBe(5); // sounds like F
    expect(pitchClassOf(spelled("C", "b"))).toBe(11); // sounds like B
    expect(pitchClassOf(spelled("F", "b"))).toBe(4); // sounds like E
  });

  it("handles double accidentals", () => {
    expect(pitchClassOf(spelled("F", "##"))).toBe(7); // sounds like G
    expect(pitchClassOf(spelled("B", "bb"))).toBe(9); // sounds like A
  });
});

describe("isEnharmonic", () => {
  it("recognizes same-pitch different spellings", () => {
    expect(isEnharmonic(spelled("D", "#"), spelled("E", "b"))).toBe(true);
    expect(isEnharmonic(spelled("B", "#"), spelled("C"))).toBe(true);
    expect(isEnharmonic(spelled("F", "b"), spelled("E"))).toBe(true);
    expect(isEnharmonic(spelled("G"), spelled("A", "b"))).toBe(false);
  });
});

describe("midiOf / frequencyOf", () => {
  it("A4 = 69 = 440 Hz", () => {
    expect(midiOf(spelled("A"), 4)).toBe(69);
    expect(frequencyOf(spelled("A"), 4)).toBeCloseTo(440);
  });

  it("octave follows the letter: B#3 sounds like C4, Cb4 sounds like B3", () => {
    expect(midiOf(spelled("B", "#"), 3)).toBe(midiOf(spelled("C"), 4));
    expect(midiOf(spelled("C", "b"), 4)).toBe(midiOf(spelled("B"), 3));
  });
});
