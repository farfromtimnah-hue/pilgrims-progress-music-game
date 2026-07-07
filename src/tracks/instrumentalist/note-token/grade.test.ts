import { describe, expect, it } from "vitest";
import type { DifficultyTier } from "../../../engine/types/schema.js";
import { buildKey } from "../../../engine/theory/keys.js";
import { spelled } from "../../../engine/theory/pitch.js";
import { gradeNoteToken, judgeAnswer } from "./grade.js";

const BEGINNER: DifficultyTier = { id: "beginner", name: "Beginner", closeAnswerPolicy: "neutral", description: "" };
const INTERMEDIATE: DifficultyTier = { id: "intermediate", name: "Intermediate", closeAnswerPolicy: "teach", description: "" };
const ADVANCED: DifficultyTier = {
  id: "advanced",
  name: "Advanced",
  closeAnswerPolicy: "penalize_if_notation_chapter",
  description: "",
};

const ebMajor = buildKey(spelled("E", "b"), "major").scale;
const csMajor = buildKey(spelled("C", "#"), "major").scale;
const cbMajor = buildKey(spelled("C", "b"), "major").scale;
const cMajor = buildKey(spelled("C"), "major").scale;

describe("gradeNoteToken — three states", () => {
  it("correct: in the key and correctly spelled", () => {
    expect(gradeNoteToken(spelled("E", "b"), ebMajor).result).toBe("correct");
    expect(gradeNoteToken(spelled("G"), ebMajor).result).toBe("correct");
  });

  it("close: right pitch, wrong spelling for the key (D# vs Eb)", () => {
    const graded = gradeNoteToken(spelled("D", "#"), ebMajor);
    expect(graded.result).toBe("close");
    expect(graded.expectedSpelling).toEqual(spelled("E", "b"));
  });

  it("wrong: pitch not in the key at all", () => {
    expect(gradeNoteToken(spelled("E"), ebMajor).result).toBe("wrong"); // E natural not in Eb major
    expect(gradeNoteToken(spelled("F", "#"), cMajor).result).toBe("wrong");
  });
});

describe("gradeNoteToken — enharmonic edge cases (B#, E#, Cb, Fb)", () => {
  it("B# is CORRECT in C# major — not an error", () => {
    expect(gradeNoteToken(spelled("B", "#"), csMajor).result).toBe("correct");
  });

  it("E# is CORRECT in C# major", () => {
    expect(gradeNoteToken(spelled("E", "#"), csMajor).result).toBe("correct");
  });

  it("C natural in C# major is CLOSE (the key spells that pitch B#)", () => {
    const graded = gradeNoteToken(spelled("C"), csMajor);
    expect(graded.result).toBe("close");
    expect(graded.expectedSpelling).toEqual(spelled("B", "#"));
  });

  it("Cb and Fb are CORRECT in Cb major", () => {
    expect(gradeNoteToken(spelled("C", "b"), cbMajor).result).toBe("correct");
    expect(gradeNoteToken(spelled("F", "b"), cbMajor).result).toBe("correct");
  });

  it("E natural in Cb major is CLOSE (the key spells that pitch Fb)", () => {
    const graded = gradeNoteToken(spelled("E"), cbMajor);
    expect(graded.result).toBe("close");
    expect(graded.expectedSpelling).toEqual(spelled("F", "b"));
  });

  it("B# in C major is CLOSE, not correct — the key spells that pitch C", () => {
    const graded = gradeNoteToken(spelled("B", "#"), cMajor);
    expect(graded.result).toBe("close");
    expect(graded.expectedSpelling).toEqual(spelled("C"));
  });
});

describe("judgeAnswer — tier policy on Close answers", () => {
  const closeAnswer = spelled("D", "#"); // in Eb major: close

  it("Beginner: neutral — no mistake, no prompt", () => {
    const j = judgeAnswer(closeAnswer, ebMajor, BEGINNER, false);
    expect(j.countsAsMistake).toBe(false);
    expect(j.feedback.kind).toBe("none");
  });

  it("Intermediate: teaching prompt, still no mistake", () => {
    const j = judgeAnswer(closeAnswer, ebMajor, INTERMEDIATE, false);
    expect(j.countsAsMistake).toBe(false);
    expect(j.feedback.kind).toBe("teaching_prompt");
  });

  it("Advanced in a notation-precision chapter: real mistake", () => {
    const j = judgeAnswer(closeAnswer, ebMajor, ADVANCED, true);
    expect(j.countsAsMistake).toBe(true);
    expect(j.feedback.kind).toBe("mistake_prompt");
  });

  it("Advanced in a non-notation chapter: teaching prompt only", () => {
    const j = judgeAnswer(closeAnswer, ebMajor, ADVANCED, false);
    expect(j.countsAsMistake).toBe(false);
    expect(j.feedback.kind).toBe("teaching_prompt");
  });

  it("wrong answers count as mistakes on every tier", () => {
    for (const tier of [BEGINNER, INTERMEDIATE, ADVANCED]) {
      expect(judgeAnswer(spelled("E"), ebMajor, tier, false).countsAsMistake).toBe(true);
    }
  });

  it("correct answers never count as mistakes", () => {
    expect(judgeAnswer(spelled("B", "b"), ebMajor, ADVANCED, true).countsAsMistake).toBe(false);
  });
});
