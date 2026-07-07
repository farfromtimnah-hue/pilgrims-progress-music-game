/**
 * Instrumentalist note-token grading — three-state, never binary.
 *
 *   correct — the note is in the key AND spelled the way this key spells it.
 *   close   — same sounding pitch as a key note but the wrong spelling for
 *             this key (e.g. D# offered where Eb major calls for Eb, or
 *             C natural where C# major calls for B#). Sounds right,
 *             spelled wrong.
 *   wrong   — the sounding pitch is not in the key at all.
 *
 * Tier policy then decides what a `close` answer *does* (see judgeAnswer):
 * Beginner = neutral, Intermediate = corrective teaching prompt,
 * Advanced = real mistake when the chapter tests notation precision.
 */
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import { noteNamePt } from "../../../engine/i18n/note-names.js";
import { noteName, pitchClassOf, sameSpelling } from "../../../engine/theory/pitch.js";
import type { DifficultyTier, NoteTokenResult, SpelledNote } from "../../../engine/types/schema.js";

export interface GradedNote {
  result: NoteTokenResult;
  /** For close answers: the spelling this key actually calls for. */
  expectedSpelling?: SpelledNote;
}

/** Grade one spelled note against a key's scale spellings. */
export function gradeNoteToken(answer: SpelledNote, scale: SpelledNote[]): GradedNote {
  const exact = scale.find((n) => sameSpelling(n, answer));
  if (exact) return { result: "correct" };

  const answerPc = pitchClassOf(answer);
  const enharmonicMatch = scale.find((n) => pitchClassOf(n) === answerPc);
  if (enharmonicMatch) return { result: "close", expectedSpelling: enharmonicMatch };

  return { result: "wrong" };
}

export type Feedback =
  | { kind: "none" }
  | { kind: "affirm" }
  | { kind: "teaching_prompt"; message: LocalizedText }
  | { kind: "mistake_prompt"; message: LocalizedText };

export interface AnswerJudgment {
  graded: GradedNote;
  /** Whether this answer feeds the three-strike machine as a mistake. */
  countsAsMistake: boolean;
  feedback: Feedback;
}

/**
 * Apply the tier's Close-answer policy. `testsNotationPrecision` comes from
 * the current chapter and only matters on Advanced.
 */
export function judgeAnswer(
  answer: SpelledNote,
  scale: SpelledNote[],
  tier: DifficultyTier,
  testsNotationPrecision: boolean,
): AnswerJudgment {
  const graded = gradeNoteToken(answer, scale);

  switch (graded.result) {
    case "correct":
      return { graded, countsAsMistake: false, feedback: { kind: "affirm" } };

    case "wrong":
      return {
        graded,
        countsAsMistake: true,
        feedback: {
          kind: "mistake_prompt",
          message: {
            en: `${noteName(answer)} isn't in this key. Listen again against the drone.`,
            pt: `${noteNamePt(answer)} não está nesta tonalidade. Escute de novo com o bordão.`,
          },
        },
      };

    case "close": {
      const expected = graded.expectedSpelling!;
      const message: LocalizedText = {
        en:
          `${noteName(answer)} sounds right, but this key spells that pitch ${noteName(expected)}. ` +
          `Check the key signature.`,
        pt:
          `${noteNamePt(answer)} soa certo, mas nesta tonalidade essa altura se escreve ${noteNamePt(expected)}. ` +
          `Confira a armadura de clave.`,
      };

      switch (tier.closeAnswerPolicy) {
        case "neutral":
          // Beginner: no damage, no strike — the pitch ear is being built first.
          return { graded, countsAsMistake: false, feedback: { kind: "none" } };
        case "teach":
          // Intermediate: corrective prompt, still no strike.
          return { graded, countsAsMistake: false, feedback: { kind: "teaching_prompt", message } };
        case "penalize_if_notation_chapter":
          return testsNotationPrecision
            ? { graded, countsAsMistake: true, feedback: { kind: "mistake_prompt", message } }
            : { graded, countsAsMistake: false, feedback: { kind: "teaching_prompt", message } };
      }
    }
  }
}
