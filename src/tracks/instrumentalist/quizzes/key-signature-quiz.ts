/**
 * Key-signature quiz — full-set selection, not multiple choice.
 *
 * The student must select ALL accidentals in the key and NOTHING extra
 * ("select all accidentals in E major" → exactly {F#, C#, G#, D#}).
 * Four-option recognition lets students pass by elimination; producing the
 * complete set verifies real knowledge, so grading is set-based.
 *
 * A wrong main attempt routes into a scaffolded recovery flow, in this exact
 * order:
 *   step 1 — which side of the circle of fifths is this key on (sharp/flat)?
 *   step 2 — how many sharps/flats?
 *   step 3 — select the actual sharps/flats (full set again)
 *   step 4 — (optional) put them in signature order
 *
 * Both the grader and the recovery flow are pure and UI-free.
 */
import type { Key, KeySignatureAccidentals, SpelledNote } from "../../../engine/types/schema.js";
import { isEnharmonic, noteName, sameSpelling } from "../../../engine/theory/pitch.js";

// ---------------------------------------------------------------------------
// Full-set grading
// ---------------------------------------------------------------------------

export interface FullSetGrade {
  correct: boolean;
  /** Signature accidentals the student failed to select. */
  missing: SpelledNote[];
  /** Selected notes that are not in the signature at all. */
  extras: SpelledNote[];
  /**
   * Extras that are enharmonic to a missing accidental (e.g. selected Gb
   * where E major needs F#): right pitch, wrong spelling — worth a targeted
   * teaching prompt rather than a generic "wrong."
   */
  wrongSpellings: { selected: SpelledNote; expected: SpelledNote }[];
}

/** Grade a full-set selection against the key's signature. Order-insensitive. */
export function gradeFullSet(selected: SpelledNote[], signature: KeySignatureAccidentals): FullSetGrade {
  const missing = signature.accidentals.filter((sig) => !selected.some((s) => sameSpelling(s, sig)));
  const extras = selected.filter((s) => !signature.accidentals.some((sig) => sameSpelling(s, sig)));
  const wrongSpellings = extras.flatMap((sel) => {
    const expected = missing.find((m) => isEnharmonic(m, sel));
    return expected ? [{ selected: sel, expected }] : [];
  });
  return { correct: missing.length === 0 && extras.length === 0, missing, extras, wrongSpellings };
}

// ---------------------------------------------------------------------------
// Scaffolded recovery flow
// ---------------------------------------------------------------------------

export type CircleSide = "sharp" | "flat" | "none";

export type RecoveryStep = "circle_side" | "accidental_count" | "select_set" | "order_set" | "complete";

export interface RecoveryState {
  step: RecoveryStep;
  /** Wrong tries on the current step (for escalating hints in the UI). */
  attemptsOnStep: number;
}

export const INITIAL_RECOVERY_STATE: RecoveryState = { step: "circle_side", attemptsOnStep: 0 };

export type RecoveryAnswer =
  | { step: "circle_side"; side: CircleSide }
  | { step: "accidental_count"; count: number }
  | { step: "select_set"; notes: SpelledNote[] }
  | { step: "order_set"; notes: SpelledNote[] };

export type RecoveryEffect =
  | { type: "advance"; to: RecoveryStep }
  | { type: "retry_step"; hint: string }
  | { type: "recovery_complete" };

export interface RecoveryTransition {
  state: RecoveryState;
  effects: RecoveryEffect[];
}

export interface RecoveryOptions {
  /** Include the optional step 4 (ordering the accidentals). Default false. */
  includeOrderStep?: boolean;
}

const SIDE_WORD: Record<"#" | "b" | "none", string> = { "#": "sharps", b: "flats", none: "no accidentals" };

/**
 * Advance the recovery flow with the student's answer to the current step.
 * Answers for a step other than the current one are ignored.
 */
export function recoveryReducer(
  state: RecoveryState,
  answer: RecoveryAnswer,
  key: Key,
  signature: KeySignatureAccidentals,
  options: RecoveryOptions = {},
): RecoveryTransition {
  if (answer.step !== state.step) return { state, effects: [] };

  const retry = (hint: string): RecoveryTransition => ({
    state: { ...state, attemptsOnStep: state.attemptsOnStep + 1 },
    effects: [{ type: "retry_step", hint }],
  });
  const advance = (to: RecoveryStep): RecoveryTransition => ({
    state: { step: to, attemptsOnStep: 0 },
    effects: to === "complete" ? [{ type: "advance", to }, { type: "recovery_complete" }] : [{ type: "advance", to }],
  });

  switch (answer.step) {
    case "circle_side": {
      if (answer.side !== key.circleSide) {
        return retry(
          `Think of the circle of fifths: does ${key.displayName} sit on the sharp side or the flat side?`,
        );
      }
      // A key with no accidentals (C major / A minor) has nothing left to recover.
      return key.accidentalCount === 0 ? advance("complete") : advance("accidental_count");
    }

    case "accidental_count": {
      if (answer.count !== key.accidentalCount) {
        return retry(`${key.displayName} has ${SIDE_WORD[signature.accidentalType]} — count around the circle again.`);
      }
      return advance("select_set");
    }

    case "select_set": {
      const grade = gradeFullSet(answer.notes, signature);
      if (!grade.correct) {
        const spellingHint = grade.wrongSpellings[0]
          ? ` Careful: this key spells that pitch ${noteName(grade.wrongSpellings[0].expected)}, not ${noteName(grade.wrongSpellings[0].selected)}.`
          : "";
        return retry(
          `You know the side and the count (${key.accidentalCount}) — now pick exactly those ${SIDE_WORD[signature.accidentalType]}.${spellingHint}`,
        );
      }
      return options.includeOrderStep ? advance("order_set") : advance("complete");
    }

    case "order_set": {
      const inOrder =
        answer.notes.length === signature.accidentals.length &&
        answer.notes.every((n, i) => sameSpelling(n, signature.accidentals[i]!));
      if (!inOrder) {
        return retry(
          signature.accidentalType === "#"
            ? "Sharps are added in fifths: F C G D A E B."
            : "Flats are added in fourths: B E A D G C F.",
        );
      }
      return advance("complete");
    }
  }
}

// ---------------------------------------------------------------------------
// Main-attempt orchestration
// ---------------------------------------------------------------------------

export type MainAttemptOutcome =
  | { kind: "passed"; grade: FullSetGrade }
  | { kind: "enter_recovery"; grade: FullSetGrade; recovery: RecoveryState };

/** Grade the main full-set attempt; a wrong answer enters the recovery flow at step 1. */
export function gradeMainAttempt(selected: SpelledNote[], signature: KeySignatureAccidentals): MainAttemptOutcome {
  const grade = gradeFullSet(selected, signature);
  return grade.correct
    ? { kind: "passed", grade }
    : { kind: "enter_recovery", grade, recovery: INITIAL_RECOVERY_STATE };
}
