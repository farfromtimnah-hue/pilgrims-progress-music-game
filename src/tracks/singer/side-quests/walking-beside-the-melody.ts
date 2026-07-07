/**
 * Walking Beside the Melody — hear HOW a companion line moves against the
 * melody: opposite steps (contrary), one holding while the other walks
 * (oblique), or moving together (similar). The passage's dominant motion is
 * computed from the two voices (harmony/motion.ts); the student names it.
 */
import type { MelodyNote } from "../missing-note/melodies.js";
import { melodyToPhrase } from "../missing-note/melodies.js";
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import { analyzeMotion, type MotionKind } from "../harmony/motion.js";
import type { SideQuestTransition } from "./common.js";

export interface WalkingQuestion {
  id: string;
  melody: MelodyNote[];
  companion: MelodyNote[];
}

export const MOTION_NAMES: Record<MotionKind, LocalizedText> = {
  contrary: { en: "moving in opposite directions", pt: "andando em direções opostas" },
  oblique: { en: "one voice holding while the other moves", pt: "uma voz parada enquanto a outra anda" },
  similar: { en: "moving together in the same direction", pt: "andando juntas na mesma direção" },
  static: { en: "both voices holding still", pt: "as duas vozes paradas" },
};

export interface WalkingState {
  phase: "listening" | "complete";
  wrongPicks: number;
}

export type WalkingEvent = { type: "choose_motion"; motion: MotionKind };

export type WalkingTransition = SideQuestTransition<WalkingState>;

/** The correct answer for a question — exported so content can be validated. */
export function dominantMotion(question: WalkingQuestion): MotionKind {
  return analyzeMotion(question.melody, question.companion).dominant;
}

function duet(question: WalkingQuestion) {
  return {
    type: "play_duet" as const,
    voices: [melodyToPhrase(question.melody, `${question.id}-m`), melodyToPhrase(question.companion, `${question.id}-c`)],
  };
}

export function startWalkingQuest(question: WalkingQuestion): WalkingTransition {
  return {
    state: { phase: "listening", wrongPicks: 0 },
    effects: [
      {
        type: "prompt",
        text: {
          en: "A companion walks beside the melody. How do their steps move — opposite ways, one holding, or together?",
          pt: "Um companheiro caminha ao lado da melodia. Como os passos deles se movem — em direções opostas, um parado, ou juntos?",
        },
      },
      duet(question),
    ],
  };
}

export function walkingReducer(
  state: WalkingState,
  event: WalkingEvent,
  question: WalkingQuestion,
): WalkingTransition {
  if (state.phase !== "listening" || event.type !== "choose_motion") return { state, effects: [] };

  const correct = dominantMotion(question);
  if (event.motion === correct) {
    return {
      state: { phase: "complete", wrongPicks: state.wrongPicks },
      effects: [{ type: "complete", success: true, mistakes: state.wrongPicks }],
    };
  }

  if (state.wrongPicks === 0) {
    return {
      state: { phase: "listening", wrongPicks: 1 },
      effects: [
        {
          type: "retry",
          hint: {
            en: "Follow just the lower voice with your hand: does it rise when the melody falls, stay put, or copy it?",
            pt: "Acompanhe só a voz de baixo com a mão: ela sobe quando a melodia desce, fica parada, ou copia a melodia?",
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
        text: {
          en: `Here they were ${MOTION_NAMES[correct].en} — listen once more.`,
          pt: `Aqui elas estavam ${MOTION_NAMES[correct].pt} — escute mais uma vez.`,
        },
      },
      duet(question),
      { type: "complete", success: false, mistakes: state.wrongPicks + 1 },
    ],
  };
}
