/**
 * Finish the Phrase — resolution hearing. A phrase stops one note short, on
 * a tone that leans somewhere (ti pulls up to do, re settles to do, fa falls
 * to mi). The student picks where it wants to go, then hears the phrase
 * resolved with their choice.
 *
 * The expected resolution comes from the classic tendency-tone rules, not
 * hand-authoring, so content stays honest across keys.
 */
import type { PlacedNote } from "../../../engine/theory/intervals.js";
import { getKey } from "../../../engine/theory/keys.js";
import { midiOf, sameSpelling } from "../../../engine/theory/pitch.js";
import { melodyToPhrase, type MelodyNote } from "../missing-note/melodies.js";
import { scaleNeighbor } from "../missing-note/missing-note-quiz.js";
import type { SideQuestTransition } from "./common.js";

export interface FinishQuestion {
  id: string;
  keyId: string;
  /** The phrase, ending on the unresolved tendency tone. */
  phrase: MelodyNote[];
  /** Pitch options offered (should include the expected resolution). */
  options: PlacedNote[];
}

/**
 * Tendency-tone resolutions (scale degrees): 7→1 up, 2→1 down, 4→3 down,
 * 6→5 down. Other degrees are already restful; a phrase ending there is a
 * content error, so this throws rather than guessing.
 */
export function expectedResolution(last: PlacedNote, keyId: string): PlacedNote {
  const { scale } = getKey(keyId);
  const degreeIdx = scale.findIndex((s) => sameSpelling(s, last.note));
  if (degreeIdx < 0) throw new Error(`Phrase ends outside the ${keyId} scale`);
  switch (degreeIdx + 1) {
    case 7:
      return scaleNeighbor(last, scale, 1); // ti → do
    case 2:
      return scaleNeighbor(last, scale, -1); // re → do
    case 4:
      return scaleNeighbor(last, scale, -1); // fa → mi
    case 6:
      return scaleNeighbor(last, scale, -1); // la → sol
    default:
      throw new Error(`Degree ${degreeIdx + 1} is not a tendency tone — phrase already sounds finished`);
  }
}

export interface FinishState {
  phase: "choosing" | "complete";
  wrongPicks: number;
}

export type FinishEvent = { type: "choose_pitch"; choice: PlacedNote };

export type FinishTransition = SideQuestTransition<FinishState>;

function resolvedPhrase(question: FinishQuestion, resolution: PlacedNote) {
  return melodyToPhrase(
    [...question.phrase, { note: resolution.note, octave: resolution.octave, beats: 2 }],
    question.id,
  );
}

export function startFinishQuest(question: FinishQuestion): FinishTransition {
  return {
    state: { phase: "choosing", wrongPicks: 0 },
    effects: [
      {
        type: "prompt",
        text: {
          en: "The phrase stops before it gets home. Where does it want to go?",
          pt: "A frase para antes de chegar em casa. Para onde ela quer ir?",
        },
      },
      { type: "play_phrase", phrase: melodyToPhrase(question.phrase, question.id) },
    ],
  };
}

export function finishReducer(
  state: FinishState,
  event: FinishEvent,
  question: FinishQuestion,
): FinishTransition {
  if (state.phase !== "choosing" || event.type !== "choose_pitch") return { state, effects: [] };

  const last = question.phrase[question.phrase.length - 1]!;
  const expected = expectedResolution({ note: last.note, octave: last.octave }, question.keyId);
  const correct = midiOf(event.choice.note, event.choice.octave) === midiOf(expected.note, expected.octave);

  if (correct) {
    return {
      state: { phase: "complete", wrongPicks: state.wrongPicks },
      effects: [
        { type: "play_phrase", phrase: resolvedPhrase(question, event.choice) },
        { type: "complete", success: true, mistakes: state.wrongPicks },
      ],
    };
  }

  if (state.wrongPicks === 0) {
    return {
      state: { phase: "choosing", wrongPicks: 1 },
      // Hear the un-rest of the wrong ending, then try again.
      effects: [
        { type: "play_phrase", phrase: resolvedPhrase(question, event.choice) },
        {
          type: "retry",
          hint: {
            en: "Did that sound like arriving home, or stopping in the doorway? Listen and try again.",
            pt: "Isso soou como chegar em casa, ou como parar na porta? Escute e tente de novo.",
          },
        },
        { type: "play_phrase", phrase: melodyToPhrase(question.phrase, question.id) },
      ],
    };
  }

  return {
    state: { phase: "complete", wrongPicks: state.wrongPicks + 1 },
    effects: [
      {
        type: "reveal",
        text: { en: "Here is where it was leaning — hear it settle.", pt: "É para cá que ela estava se inclinando — ouça como descansa." },
      },
      { type: "play_phrase", phrase: resolvedPhrase(question, expected) },
      { type: "complete", success: false, mistakes: state.wrongPicks + 1 },
    ],
  };
}
