import { describe, expect, it } from "vitest";
import { display, type Language } from "../../../engine/i18n/localized-text.js";
import { midiOf, spelled } from "../../../engine/theory/pitch.js";
import { melodyById, MELODIES } from "./melodies.js";
import {
  buildMissingNoteQuestion,
  fullPhrase,
  gappedPhrase,
  missingNoteReducer,
  phraseWithChoice,
  resultLabel,
  scaleNeighbor,
  startMissingNoteQuiz,
  type MissingNoteEffect,
} from "./missing-note-quiz.js";

const twinkle = melodyById("melody-twinkle")!;
const odeToJoy = melodyById("melody-ode-to-joy")!;

function effectsOf<T extends MissingNoteEffect["type"]>(effects: MissingNoteEffect[], type: T) {
  return effects.filter((e): e is Extract<MissingNoteEffect, { type: T }> => e.type === type);
}

describe("phrase builders", () => {
  it("gappedPhrase replaces exactly the gap note with a rest of the same length", () => {
    const gapped = gappedPhrase(twinkle, 2); // the first G
    expect(gapped).toHaveLength(twinkle.notes.length);
    expect(gapped[2]!.token).toBeUndefined();
    expect(gapped[2]!.beats).toBe(twinkle.notes[2]!.beats);
    expect(gapped[1]!.token).toBeDefined();
  });

  it("phraseWithChoice fills the gap with the chosen pitch", () => {
    const withChoice = phraseWithChoice(twinkle, 2, { note: spelled("A"), octave: 4 });
    expect(withChoice[2]!.token!.note).toEqual(spelled("A"));
    expect(withChoice[0]!.token!.note).toEqual(twinkle.notes[0]!.note);
  });
});

describe("buildMissingNoteQuestion — three options around the answer", () => {
  it("offers the missing note plus its two scale neighbours, sorted by pitch", () => {
    const q = buildMissingNoteQuestion(twinkle, 4, "scale_degree"); // A4
    expect(q.options).toHaveLength(3);
    const midis = q.options.map((o) => midiOf(o.note, o.octave));
    expect(midis).toEqual([...midis].sort((a, b) => a - b));
    expect(q.options.some((o) => o.note.letter === "A" && o.octave === 4)).toBe(true);
    expect(q.options.some((o) => o.note.letter === "G" && o.octave === 4)).toBe(true);
    expect(q.options.some((o) => o.note.letter === "B" && o.octave === 4)).toBe(true);
  });

  it("scaleNeighbor crosses the octave boundary correctly (B up to C)", () => {
    const scale = ["C", "D", "E", "F", "G", "A", "B"].map((l) => spelled(l as never));
    expect(scaleNeighbor({ note: spelled("B"), octave: 3 }, scale, 1)).toEqual({
      note: spelled("C"),
      octave: 4,
    });
    expect(scaleNeighbor({ note: spelled("C"), octave: 4 }, scale, -1)).toEqual({
      note: spelled("B"),
      octave: 3,
    });
  });
});

describe("quiz flow", () => {
  it("start plays the full phrase, then the gapped phrase", () => {
    const q = buildMissingNoteQuestion(twinkle, 2, "scale_degree");
    const t = startMissingNoteQuiz(q);
    expect(t.state.phase).toBe("choosing");
    expect(t.effects.map((e) => (e.type === "play_phrase" ? e.which : e.type))).toEqual(["full", "gapped"]);
  });

  it("a correct choice replays the phrase with the choice — no extra correction pass", () => {
    const q = buildMissingNoteQuestion(twinkle, 2, "scale_degree"); // G4
    const t = missingNoteReducer({ phase: "choosing" }, { type: "choose_pitch", choice: { note: spelled("G"), octave: 4 } }, q);
    expect(t.state.phase).toBe("complete");
    expect(effectsOf(t.effects, "play_phrase").map((e) => e.which)).toEqual(["with_choice"]);
    expect(effectsOf(t.effects, "show_result")[0]!.correct).toBe(true);
    expect(effectsOf(t.effects, "complete")[0]!.correct).toBe(true);
  });

  it("a wrong choice replays the choice AND the correct phrase — contrast is the lesson", () => {
    const q = buildMissingNoteQuestion(twinkle, 2, "scale_degree");
    const t = missingNoteReducer({ phase: "choosing" }, { type: "choose_pitch", choice: { note: spelled("A"), octave: 4 } }, q);
    expect(effectsOf(t.effects, "play_phrase").map((e) => e.which)).toEqual(["with_choice", "correct"]);
    expect(effectsOf(t.effects, "show_result")[0]!.correct).toBe(false);
  });

  it("grades by sounding pitch, octave included", () => {
    const q = buildMissingNoteQuestion(twinkle, 2, "scale_degree"); // G4
    const t = missingNoteReducer({ phase: "choosing" }, { type: "choose_pitch", choice: { note: spelled("G"), octave: 3 } }, q);
    expect(effectsOf(t.effects, "show_result")[0]!.correct).toBe(false);
  });

  it("ignores events after completion", () => {
    const q = buildMissingNoteQuestion(twinkle, 2, "scale_degree");
    const t = missingNoteReducer({ phase: "complete" }, { type: "choose_pitch", choice: { note: spelled("G"), octave: 4 } }, q);
    expect(t.effects).toEqual([]);
  });
});

describe("result labels — bilingual, per label kind", () => {
  it("scale_degree: names the note and degree in both languages", () => {
    const q = buildMissingNoteQuestion(odeToJoy, 3, "scale_degree"); // G4, degree 5
    const label = resultLabel(q);
    expect(label.en).toContain("G");
    expect(label.en).toContain("scale degree 5");
    expect(label.en).toContain("C major");
    expect(label.pt).toContain("Sol");
    expect(label.pt).toContain("5º grau");
    expect(label.pt).toContain("Dó maior");
  });

  it("solfege: movable-do syllable in both languages", () => {
    const q = buildMissingNoteQuestion(odeToJoy, 0, "solfege"); // E4, degree 3 = mi
    const label = resultLabel(q);
    expect(label.en).toContain("“mi”");
    expect(label.pt).toContain("“mi”");
    expect(label.pt).toContain("dó móvel");
  });

  it("interval: names the interval from the previous note in both languages", () => {
    const q = buildMissingNoteQuestion(twinkle, 2, "interval"); // C4 → G4 = P5 up
    const label = resultLabel(q);
    expect(label.en).toContain("perfect 5th up");
    expect(label.pt).toContain("quinta justa acima");
  });

  it("interval: a gap at the start of the phrase measures against the note after", () => {
    const q = buildMissingNoteQuestion(twinkle, 0, "interval"); // C4 vs next C4 = unison
    const label = resultLabel(q);
    expect(label.en).toContain("the note after");
    expect(label.pt).toContain("a nota seguinte");
  });
});

describe("melody content", () => {
  it("every melody has a bilingual title, a resolvable key, and a public-domain note", () => {
    for (const m of MELODIES) {
      for (const lang of ["en", "pt"] as Language[]) {
        expect(display(m.title, lang).length).toBeGreaterThan(0);
      }
      expect(m.publicDomainNote).toContain("public domain");
      expect(m.notes.length).toBeGreaterThanOrEqual(6);
    }
  });
});
