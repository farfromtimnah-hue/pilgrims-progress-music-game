import { describe, expect, it } from "vitest";
import { noteName, spelled } from "./pitch.js";
import { allMajorKeys, buildKey, scaleSpellings } from "./keys.js";

const names = (notes: { letter: string; accidental: string }[]) =>
  notes.map((n) => noteName(n as never)).join(" ");

describe("scaleSpellings", () => {
  it("spells C# major with E# and B#", () => {
    expect(names(scaleSpellings(spelled("C", "#"), "major"))).toBe("C♯ D♯ E♯ F♯ G♯ A♯ B♯");
  });

  it("spells Cb major with Fb and Cb", () => {
    expect(names(scaleSpellings(spelled("C", "b"), "major"))).toBe("C♭ D♭ E♭ F♭ G♭ A♭ B♭");
  });

  it("spells Gb major with Cb", () => {
    expect(names(scaleSpellings(spelled("G", "b"), "major"))).toBe("G♭ A♭ B♭ C♭ D♭ E♭ F");
  });

  it("spells natural minor keys (A minor, C# minor)", () => {
    expect(names(scaleSpellings(spelled("A"), "minor"))).toBe("A B C D E F G");
    expect(names(scaleSpellings(spelled("C", "#"), "minor"))).toBe("C♯ D♯ E F♯ G♯ A B");
  });
});

describe("buildKey key signatures", () => {
  it("E major: 4 sharps in canonical order F# C# G# D#", () => {
    const { key, keySignature } = buildKey(spelled("E"), "major");
    expect(key.circleSide).toBe("sharp");
    expect(key.accidentalCount).toBe(4);
    expect(names(keySignature.accidentals)).toBe("F♯ C♯ G♯ D♯");
  });

  it("Ab major: 4 flats in canonical order Bb Eb Ab Db", () => {
    const { key, keySignature } = buildKey(spelled("A", "b"), "major");
    expect(key.circleSide).toBe("flat");
    expect(names(keySignature.accidentals)).toBe("B♭ E♭ A♭ D♭");
  });

  it("C major: no accidentals", () => {
    const { key, keySignature } = buildKey(spelled("C"), "major");
    expect(key.circleSide).toBe("none");
    expect(keySignature.accidentals).toEqual([]);
  });

  it("builds bilingual display names (letters in EN, solfège in PT)", () => {
    expect(buildKey(spelled("E", "b"), "major").key.displayName).toEqual({ en: "E♭ major", pt: "Mi♭ maior" });
    expect(buildKey(spelled("C", "#"), "minor").key.displayName).toEqual({ en: "C♯ minor", pt: "Dó♯ menor" });
  });

  it("generates all 15 standard major keys with 0–7 accidentals", () => {
    const keys = allMajorKeys();
    expect(keys).toHaveLength(15);
    expect(keys.find((k) => k.key.id === "C#-major")!.key.accidentalCount).toBe(7);
    expect(keys.find((k) => k.key.id === "Cb-major")!.key.accidentalCount).toBe(7);
  });
});
