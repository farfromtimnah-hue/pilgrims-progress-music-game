/**
 * Hidden Companion — hear the inner/partner line inside a two-voice texture.
 * The duet plays; the student picks which of the candidate lines was the
 * companion walking inside the music. One wrong pick earns a hint and a
 * re-listen; a second reveals the companion sung alone.
 */
import { melodyToPhrase, type MelodyNote } from "../missing-note/melodies.js";
import type { SideQuestTransition } from "./common.js";

export interface HiddenCompanionQuestion {
  id: string;
  melody: MelodyNote[];
  companion: MelodyNote[];
  /** Candidate lines shown to the student (one is the companion). */
  options: MelodyNote[][];
  /** Index into options of the real companion line. */
  companionIndex: number;
}

export interface HiddenCompanionState {
  phase: "listening" | "complete";
  wrongPicks: number;
}

export type HiddenCompanionEvent =
  | { type: "choose_line"; index: number }
  | { type: "audition_line"; index: number };

export type HiddenCompanionTransition = SideQuestTransition<HiddenCompanionState>;

function duet(question: HiddenCompanionQuestion) {
  return {
    type: "play_duet" as const,
    voices: [melodyToPhrase(question.melody, `${question.id}-m`), melodyToPhrase(question.companion, `${question.id}-c`)],
  };
}

export function startHiddenCompanionQuest(question: HiddenCompanionQuestion): HiddenCompanionTransition {
  return {
    state: { phase: "listening", wrongPicks: 0 },
    effects: [
      {
        type: "prompt",
        text: {
          en: "Someone is singing along inside the music. Which line is the hidden companion's?",
          pt: "Alguém está cantando junto, escondido dentro da música. Qual linha é a do companheiro oculto?",
        },
      },
      duet(question),
    ],
  };
}

export function hiddenCompanionReducer(
  state: HiddenCompanionState,
  event: HiddenCompanionEvent,
  question: HiddenCompanionQuestion,
): HiddenCompanionTransition {
  if (state.phase !== "listening") return { state, effects: [] };

  // The student may audition any candidate line alone before choosing.
  if (event.type === "audition_line") {
    const line = question.options[event.index];
    if (!line) return { state, effects: [] };
    return {
      state,
      effects: [{ type: "play_phrase", phrase: melodyToPhrase(line, `${question.id}-opt${event.index}`) }],
    };
  }

  if (event.index === question.companionIndex) {
    return {
      state: { phase: "complete", wrongPicks: state.wrongPicks },
      effects: [
        {
          type: "reveal",
          text: { en: "That's the companion — here they are on their own.", pt: "É esse o companheiro — aqui está ele sozinho." },
        },
        { type: "play_phrase", phrase: melodyToPhrase(question.companion, `${question.id}-c`) },
        { type: "complete", success: true, mistakes: state.wrongPicks },
      ],
    };
  }

  if (state.wrongPicks === 0) {
    return {
      state: { phase: "listening", wrongPicks: 1 },
      effects: [
        {
          type: "retry",
          hint: {
            en: "Listen underneath the melody — the companion's line is quieter but keeps its own shape.",
            pt: "Escute por baixo da melodia — a linha do companheiro é mais discreta, mas tem o próprio desenho.",
          },
        },
        duet(question),
      ],
    };
  }

  return {
    state: { phase: "complete", wrongPicks: state.wrongPicks + 1 },
    effects: [
      {
        type: "reveal",
        text: { en: "Here is the companion's line by itself.", pt: "Aqui está a linha do companheiro sozinha." },
      },
      { type: "play_phrase", phrase: melodyToPhrase(question.companion, `${question.id}-c`) },
      { type: "complete", success: false, mistakes: state.wrongPicks + 1 },
    ],
  };
}
