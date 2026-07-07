import { describe, expect, it } from "vitest";
import { spelled } from "../theory/pitch.js";
import { localizedNoteName, noteNamePt } from "./note-names.js";

describe("noteNamePt — fixed-do solfège", () => {
  it("names the seven naturals Dó Ré Mi Fá Sol Lá Si", () => {
    expect(noteNamePt(spelled("C"))).toBe("Dó");
    expect(noteNamePt(spelled("D"))).toBe("Ré");
    expect(noteNamePt(spelled("E"))).toBe("Mi");
    expect(noteNamePt(spelled("F"))).toBe("Fá");
    expect(noteNamePt(spelled("G"))).toBe("Sol");
    expect(noteNamePt(spelled("A"))).toBe("Lá");
    expect(noteNamePt(spelled("B"))).toBe("Si");
  });

  it("keeps the same accidental symbols as English", () => {
    expect(noteNamePt(spelled("E", "b"))).toBe("Mi♭");
    expect(noteNamePt(spelled("B", "#"))).toBe("Si♯");
    expect(noteNamePt(spelled("F", "##"))).toBe("Fá𝄪");
    expect(noteNamePt(spelled("B", "bb"))).toBe("Si𝄫");
  });
});

describe("localizedNoteName", () => {
  it("pairs the letter name with the solfège name", () => {
    expect(localizedNoteName(spelled("E", "b"))).toEqual({ en: "E♭", pt: "Mi♭" });
    expect(localizedNoteName(spelled("C", "#"))).toEqual({ en: "C♯", pt: "Dó♯" });
  });
});
