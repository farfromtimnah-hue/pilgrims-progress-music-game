/**
 * Choose the Better Path — hear two candidate harmony lines against the same
 * melody and pick the more natural one: the moving, independent companion
 * rather than the block that shadows the melody in lockstep.
 *
 * Which line IS better is decided by the harmony-naturalness judgment
 * (harmony/naturalness.ts) at question-build time — this machine only runs
 * the flow. One wrong pick earns a re-listen; a second reveals the answer
 * with the explanation.
 */
import { melodyToPhrase, type MelodyNote } from "../missing-note/melodies.js";
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import type { SideQuestEffect, SideQuestTransition } from "./common.js";

export interface BetterPathQuestion {
  id: string;
  melody: MelodyNote[];
  lineA: MelodyNote[];
  lineB: MelodyNote[];
  /** Which line the naturalness judgment prefers. */
  better: "a" | "b";
  /** Why — produced by the judgment, shown on success or final reveal. */
  explanation: LocalizedText;
}

export interface BetterPathState {
  phase: "choosing" | "complete";
  wrongPicks: number;
}

export type BetterPathEvent = { type: "choose_path"; pick: "a" | "b" } | { type: "replay_duet"; which: "a" | "b" };

export type BetterPathTransition = SideQuestTransition<BetterPathState>;

function duet(question: BetterPathQuestion, which: "a" | "b"): SideQuestEffect {
  const melody = melodyToPhrase(question.melody, `${question.id}-melody`);
  const line = which === "a" ? question.lineA : question.lineB;
  return { type: "play_duet", voices: [melody, melodyToPhrase(line, `${question.id}-${which}`)] };
}

function duets(question: BetterPathQuestion): SideQuestEffect[] {
  return [duet(question, "a"), duet(question, "b")];
}

export function startBetterPathQuest(question: BetterPathQuestion): BetterPathTransition {
  return {
    state: { phase: "choosing", wrongPicks: 0 },
    effects: [
      {
        type: "prompt",
        text: {
          en: "Two companions offer to walk with the melody. Listen to both — which one walks more naturally beside it?",
          pt: "Dois companheiros se oferecem para caminhar com a melodia. Escute os dois — qual caminha de forma mais natural ao lado dela?",
        },
      },
      ...duets(question),
    ],
  };
}

export function betterPathReducer(
  state: BetterPathState,
  event: BetterPathEvent,
  question: BetterPathQuestion,
): BetterPathTransition {
  if (state.phase !== "choosing") return { state, effects: [] };

  if (event.type === "replay_duet") {
    return { state, effects: [duet(question, event.which)] };
  }

  if (event.pick === question.better) {
    return {
      state: { phase: "complete", wrongPicks: state.wrongPicks },
      effects: [
        { type: "reveal", text: question.explanation },
        { type: "complete", success: true, mistakes: state.wrongPicks },
      ],
    };
  }

  if (state.wrongPicks === 0) {
    return {
      state: { phase: "choosing", wrongPicks: 1 },
      effects: [
        {
          type: "retry",
          hint: {
            en: "Listen again: does the companion take its own steps, or copy the melody's every move?",
            pt: "Escute de novo: o companheiro dá os próprios passos, ou copia cada movimento da melodia?",
          },
        },
        ...duets(question),
      ],
    };
  }

  return {
    state: { phase: "complete", wrongPicks: state.wrongPicks + 1 },
    effects: [
      { type: "reveal", text: question.explanation },
      { type: "complete", success: false, mistakes: state.wrongPicks + 1 },
    ],
  };
}
