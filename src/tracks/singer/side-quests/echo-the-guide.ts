/**
 * Echo the Guide — phrase memory and recall. The guide sings a phrase; the
 * student echoes it back. A first failure earns a replay; a second failure
 * chunks the phrase into halves (echo each, then the whole) — scaffolding
 * by shrinking the memory load, never by punishing.
 */
import { midiOf } from "../../../engine/theory/pitch.js";
import type { PlacedNote } from "../../../engine/theory/intervals.js";
import { melodyToPhrase, type MelodyNote } from "../missing-note/melodies.js";
import type { SideQuestEffect, SideQuestTransition } from "./common.js";

export interface EchoQuestion {
  id: string;
  phrase: MelodyNote[];
}

export type EchoPhase = "echo_full" | "echo_first_half" | "echo_second_half" | "echo_full_again" | "complete";

export interface EchoState {
  phase: EchoPhase;
  failuresOnPhase: number;
  totalMistakes: number;
}

export type EchoEvent = { type: "submit_echo"; pitches: PlacedNote[] };

export type EchoTransition = SideQuestTransition<EchoState>;

const PROMPT = {
  en: "Listen to the guide, then sing the phrase back exactly.",
  pt: "Escute o guia e depois cante a frase de volta, igualzinha.",
};

function halves(phrase: MelodyNote[]): { first: MelodyNote[]; second: MelodyNote[] } {
  const mid = Math.ceil(phrase.length / 2);
  return { first: phrase.slice(0, mid), second: phrase.slice(mid) };
}

function targetFor(question: EchoQuestion, phase: EchoPhase): MelodyNote[] {
  const { first, second } = halves(question.phrase);
  switch (phase) {
    case "echo_first_half":
      return first;
    case "echo_second_half":
      return second;
    default:
      return question.phrase;
  }
}

/** Echo matches when every sounding pitch (octave included) lines up. */
export function echoMatches(target: MelodyNote[], pitches: PlacedNote[]): boolean {
  return (
    pitches.length === target.length &&
    target.every((t, i) => midiOf(t.note, t.octave) === midiOf(pitches[i]!.note, pitches[i]!.octave))
  );
}

export function startEchoQuest(question: EchoQuestion): EchoTransition {
  return {
    state: { phase: "echo_full", failuresOnPhase: 0, totalMistakes: 0 },
    effects: [
      { type: "prompt", text: PROMPT },
      { type: "play_phrase", phrase: melodyToPhrase(question.phrase, question.id) },
    ],
  };
}

export function echoReducer(state: EchoState, event: EchoEvent, question: EchoQuestion): EchoTransition {
  if (state.phase === "complete" || event.type !== "submit_echo") return { state, effects: [] };

  const target = targetFor(question, state.phase);
  const play = (notes: MelodyNote[]): SideQuestEffect => ({
    type: "play_phrase",
    phrase: melodyToPhrase(notes, question.id),
  });

  if (echoMatches(target, event.pitches)) {
    switch (state.phase) {
      case "echo_first_half":
        return {
          state: { phase: "echo_second_half", failuresOnPhase: 0, totalMistakes: state.totalMistakes },
          effects: [
            { type: "prompt", text: { en: "Now the second half.", pt: "Agora a segunda metade." } },
            play(halves(question.phrase).second),
          ],
        };
      case "echo_second_half":
        return {
          state: { phase: "echo_full_again", failuresOnPhase: 0, totalMistakes: state.totalMistakes },
          effects: [
            { type: "prompt", text: { en: "Now the whole phrase.", pt: "Agora a frase inteira." } },
            play(question.phrase),
          ],
        };
      default:
        return {
          state: { phase: "complete", failuresOnPhase: 0, totalMistakes: state.totalMistakes },
          effects: [{ type: "complete", success: true, mistakes: state.totalMistakes }],
        };
    }
  }

  const failures = state.failuresOnPhase + 1;
  const mistakes = state.totalMistakes + 1;

  // A second failure on the full phrase shrinks the memory load: halves.
  if (state.phase === "echo_full" && failures >= 2) {
    return {
      state: { phase: "echo_first_half", failuresOnPhase: 0, totalMistakes: mistakes },
      effects: [
        {
          type: "retry",
          hint: { en: "Let's take it in two steps — echo just the first half.", pt: "Vamos por partes — cante só a primeira metade." },
        },
        play(halves(question.phrase).first),
      ],
    };
  }

  // A second failure on the final full echo ends the quest gently.
  if (state.phase === "echo_full_again" && failures >= 2) {
    return {
      state: { phase: "complete", failuresOnPhase: 0, totalMistakes: mistakes },
      effects: [
        {
          type: "reveal",
          text: { en: "Here it is once more — we'll walk this path again later.", pt: "Aqui está mais uma vez — vamos repetir esse caminho depois." },
        },
        play(question.phrase),
        { type: "complete", success: false, mistakes },
      ],
    };
  }

  return {
    state: { ...state, failuresOnPhase: failures, totalMistakes: mistakes },
    effects: [
      { type: "retry", hint: { en: "Almost — listen once more.", pt: "Quase — escute mais uma vez." } },
      play(target),
    ],
  };
}
