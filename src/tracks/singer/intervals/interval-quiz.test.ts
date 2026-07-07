import { describe, expect, it } from "vitest";
import { display, type Language } from "../../../engine/i18n/localized-text.js";
import { spelled } from "../../../engine/theory/pitch.js";
import {
  intervalPhrase,
  intervalQuizReducer,
  startIntervalQuiz,
  type IntervalQuestion,
  type IntervalQuizEffect,
} from "./interval-quiz.js";
import { referencesFor, songReferenceById, SONG_REFERENCES } from "./song-references.js";

const p5Ref = referencesFor("P5", "ascending")[0]!; // Twinkle Twinkle
const p4Ref = referencesFor("P4", "ascending")[0]!; // Amazing Grace
const m3Ref = referencesFor("m3", "ascending")[0]!; // Brahms' Lullaby

function songHintQuestion(formalNameStep: "reveal" | "ask"): IntervalQuestion {
  return {
    interval: "P5",
    direction: "ascending",
    root: { note: spelled("C"), octave: 4 },
    mode: "song_hint",
    formalNameStep,
    songOptions: [p4Ref, p5Ref, m3Ref],
    nameOptions: ["P4", "P5", "m3"],
  };
}

const directQuestion: IntervalQuestion = {
  interval: "M3",
  direction: "ascending",
  root: { note: spelled("F"), octave: 3 },
  mode: "direct",
  formalNameStep: "ask",
  songOptions: [],
  nameOptions: ["m3", "M3", "P4"],
};

function effectOf<T extends IntervalQuizEffect["type"]>(effects: IntervalQuizEffect[], type: T) {
  return effects.find((e): e is Extract<IntervalQuizEffect, { type: T }> => e.type === type);
}

describe("intervalPhrase", () => {
  it("builds a two-note phrase with the transposed second note", () => {
    const phrase = intervalPhrase(songHintQuestion("reveal"));
    expect(phrase).toHaveLength(2);
    expect(phrase[0]!.token.note).toEqual(spelled("C"));
    expect(phrase[1]!.token.note).toEqual(spelled("G")); // P5 up from C4
    expect(phrase[1]!.token.octave).toBe(4);
  });
});

describe("song-hint mode", () => {
  it("starts in song_choice and plays the interval", () => {
    const t = startIntervalQuiz(songHintQuestion("reveal"));
    expect(t.state.phase).toBe("song_choice");
    expect(effectOf(t.effects, "play_interval")?.phrase).toHaveLength(2);
  });

  it("wrong song choice: retry hint in both languages, plus a replay", () => {
    const q = songHintQuestion("reveal");
    const t = intervalQuizReducer(startIntervalQuiz(q).state, { type: "choose_song", songReferenceId: p4Ref.id }, q);
    expect(t.state.phase).toBe("song_choice");
    expect(t.state.totalMistakes).toBe(1);
    const retry = effectOf(t.effects, "retry")!;
    expect(retry.hint.en).toContain("sing the start of each song");
    expect(retry.hint.pt).toContain("cante o começo de cada música");
    expect(effectOf(t.effects, "play_interval")).toBeDefined();
  });

  it("reveal variant: correct song reveals the formal name bilingually and completes", () => {
    const q = songHintQuestion("reveal");
    const t = intervalQuizReducer(startIntervalQuiz(q).state, { type: "choose_song", songReferenceId: p5Ref.id }, q);
    expect(t.state.phase).toBe("complete");
    const reveal = effectOf(t.effects, "reveal_interval_name")!;
    expect(reveal.name.en).toContain("Twinkle, Twinkle, Little Star");
    expect(reveal.name.en).toContain("perfect 5th");
    expect(reveal.name.pt).toContain("Brilha, Brilha, Estrelinha");
    expect(reveal.name.pt).toContain("quinta justa");
    expect(effectOf(t.effects, "complete")?.totalMistakes).toBe(0);
  });

  it("ask variant: correct song advances to the formal-name step", () => {
    const q = songHintQuestion("ask");
    const t = intervalQuizReducer(startIntervalQuiz(q).state, { type: "choose_song", songReferenceId: p5Ref.id }, q);
    expect(t.state.phase).toBe("name_choice");
    expect(effectOf(t.effects, "advance_to_name_choice")).toBeDefined();
  });

  it("ask variant: wrong formal name gets a song-anchored hint in both languages", () => {
    const q = songHintQuestion("ask");
    let t = intervalQuizReducer(startIntervalQuiz(q).state, { type: "choose_song", songReferenceId: p5Ref.id }, q);
    t = intervalQuizReducer(t.state, { type: "choose_name", intervalId: "P4" }, q);
    expect(t.state.phase).toBe("name_choice");
    const retry = effectOf(t.effects, "retry")!;
    expect(retry.hint.en).toContain("Twinkle, Twinkle, Little Star");
    expect(retry.hint.pt).toContain("Brilha, Brilha, Estrelinha");
  });

  it("ask variant: correct formal name completes, carrying accumulated mistakes", () => {
    const q = songHintQuestion("ask");
    let t = intervalQuizReducer(startIntervalQuiz(q).state, { type: "choose_song", songReferenceId: m3Ref.id }, q);
    t = intervalQuizReducer(t.state, { type: "choose_song", songReferenceId: p5Ref.id }, q);
    t = intervalQuizReducer(t.state, { type: "choose_name", intervalId: "P5" }, q);
    expect(t.state.phase).toBe("complete");
    expect(effectOf(t.effects, "complete")?.totalMistakes).toBe(1);
  });
});

describe("direct mode (no song hint)", () => {
  it("starts straight at name_choice", () => {
    const t = startIntervalQuiz(directQuestion);
    expect(t.state.phase).toBe("name_choice");
    expect(effectOf(t.effects, "play_interval")).toBeDefined();
  });

  it("wrong name: generic listening hint (no song anchor) in both languages, plus replay", () => {
    const t = intervalQuizReducer(
      startIntervalQuiz(directQuestion).state,
      { type: "choose_name", intervalId: "P4" },
      directQuestion,
    );
    const retry = effectOf(t.effects, "retry")!;
    for (const lang of ["en", "pt"] as Language[]) {
      expect(display(retry.hint, lang).length).toBeGreaterThan(0);
    }
    expect(retry.hint.en).toContain("Listen again");
    expect(retry.hint.pt).toContain("Escute de novo");
    expect(effectOf(t.effects, "play_interval")).toBeDefined();
  });

  it("correct name completes", () => {
    const t = intervalQuizReducer(
      startIntervalQuiz(directQuestion).state,
      { type: "choose_name", intervalId: "M3" },
      directQuestion,
    );
    expect(t.state.phase).toBe("complete");
  });

  it("events for the wrong phase are ignored", () => {
    const t = intervalQuizReducer(
      startIntervalQuiz(directQuestion).state,
      { type: "choose_song", songReferenceId: p5Ref.id },
      directQuestion,
    );
    expect(t.state.phase).toBe("name_choice");
    expect(t.effects).toEqual([]);
  });
});

describe("song reference content", () => {
  it("every reference has bilingual title and cue", () => {
    for (const ref of SONG_REFERENCES) {
      expect(ref.title.en.length).toBeGreaterThan(0);
      expect(ref.title.pt.length).toBeGreaterThan(0);
      expect(ref.cue.en.length).toBeGreaterThan(0);
      expect(ref.cue.pt.length).toBeGreaterThan(0);
      expect(ref.publicDomainNote).toContain("public domain");
    }
  });

  it("looks up references by id", () => {
    expect(songReferenceById(p5Ref.id)?.intervalId).toBe("P5");
    expect(songReferenceById("nope")).toBeUndefined();
  });
});
