/**
 * Singer interval-recognition quiz — song references before formal names.
 *
 * Early mode ("song_hint"): the interval plays, the student picks which
 * familiar song it starts like, THEN the formal name is either revealed
 * (Beginner) or asked for (Intermediate). Later mode ("direct") drops the
 * song step entirely: hear the interval, name it — independent listening.
 *
 * Pure reducer in the house pattern: (state, event) → { state, effects };
 * no UI, no audio calls. Playback happens through the ONE audio engine:
 * the `play_interval` effect carries a PhraseNote[] the caller feeds to
 * AudioEngine.playPhrase (which also guarantees the notes sound in a tonal
 * context, never bare).
 */
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import type { PhraseNote } from "../../../engine/audio/audio-engine.js";
import {
  INTERVALS,
  transposeByInterval,
  type IntervalDirection,
  type IntervalId,
  type PlacedNote,
} from "../../../engine/theory/intervals.js";
import { pitchClassOf } from "../../../engine/theory/pitch.js";
import type { NoteToken } from "../../../engine/types/schema.js";
import { songReferenceById, type SongReference } from "./song-references.js";

export type IntervalQuizMode = "song_hint" | "direct";

export interface IntervalQuestion {
  interval: IntervalId;
  direction: IntervalDirection;
  /** First note of the interval; the second is derived by transposition. */
  root: PlacedNote;
  mode: IntervalQuizMode;
  /** song_hint mode: reveal the formal name after the song step (Beginner)
   *  or ask for it (Intermediate). Ignored in direct mode. */
  formalNameStep: "reveal" | "ask";
  /** Song choices offered (must include at least one correct reference). */
  songOptions: SongReference[];
  /** Formal-name choices offered. */
  nameOptions: IntervalId[];
}

/** The two-note phrase for a question, for AudioEngine.playPhrase. */
export function intervalPhrase(question: IntervalQuestion): PhraseNote[] {
  const second = transposeByInterval(question.root, question.interval, question.direction);
  const token = (placed: PlacedNote, id: string): NoteToken => ({
    id,
    note: placed.note,
    pitchClass: pitchClassOf(placed.note),
    octave: placed.octave,
  });
  return [
    { token: token(question.root, "interval-note-1"), beats: 1 },
    { token: token(second, "interval-note-2"), beats: 2 },
  ];
}

export type IntervalQuizPhase = "song_choice" | "name_choice" | "complete";

export interface IntervalQuizState {
  phase: IntervalQuizPhase;
  /** Wrong tries on the current phase, for escalating hints. */
  attemptsOnPhase: number;
  /** Total wrong tries across the question (for scoring by the caller). */
  totalMistakes: number;
}

export type IntervalQuizEvent =
  | { type: "choose_song"; songReferenceId: string }
  | { type: "choose_name"; intervalId: IntervalId };

export type IntervalQuizEffect =
  | { type: "play_interval"; phrase: PhraseNote[] }
  | { type: "retry"; hint: LocalizedText }
  | { type: "reveal_interval_name"; name: LocalizedText }
  | { type: "advance_to_name_choice" }
  | { type: "complete"; totalMistakes: number };

export interface IntervalQuizTransition {
  state: IntervalQuizState;
  effects: IntervalQuizEffect[];
}

/** Begin a question: initial state plus the first playback effect. */
export function startIntervalQuiz(question: IntervalQuestion): IntervalQuizTransition {
  return {
    state: {
      phase: question.mode === "song_hint" ? "song_choice" : "name_choice",
      attemptsOnPhase: 0,
      totalMistakes: 0,
    },
    effects: [{ type: "play_interval", phrase: intervalPhrase(question) }],
  };
}

/** True when this song reference matches the interval the question played. */
export function isCorrectSongChoice(question: IntervalQuestion, ref: SongReference): boolean {
  return ref.intervalId === question.interval && ref.direction === question.direction;
}

export function intervalQuizReducer(
  state: IntervalQuizState,
  event: IntervalQuizEvent,
  question: IntervalQuestion,
): IntervalQuizTransition {
  const retry = (hint: LocalizedText): IntervalQuizTransition => ({
    state: {
      ...state,
      attemptsOnPhase: state.attemptsOnPhase + 1,
      totalMistakes: state.totalMistakes + 1,
    },
    // Replay after every wrong answer — the ear needs the sound again.
    effects: [{ type: "retry", hint }, { type: "play_interval", phrase: intervalPhrase(question) }],
  });

  switch (state.phase) {
    case "song_choice": {
      if (event.type !== "choose_song") return { state, effects: [] };
      const ref = songReferenceById(event.songReferenceId);
      if (!ref || !isCorrectSongChoice(question, ref)) {
        return retry({
          en: "Listen again, then sing the start of each song in your head — which one begins with this sound?",
          pt: "Escute de novo e cante o começo de cada música na cabeça — qual delas começa com esse som?",
        });
      }
      const name = INTERVALS[question.interval].name;
      if (question.formalNameStep === "reveal") {
        // Beginner: the song was the answer; the formal name is a gift.
        const matched: LocalizedText = {
          en: `Yes — that's the start of ${ref.title.en}. Musicians call this distance a ${name.en}.`,
          pt: `Isso — é o começo de ${ref.title.pt}. Os músicos chamam essa distância de ${name.pt}.`,
        };
        return {
          state: { phase: "complete", attemptsOnPhase: 0, totalMistakes: state.totalMistakes },
          effects: [
            { type: "reveal_interval_name", name: matched },
            { type: "complete", totalMistakes: state.totalMistakes },
          ],
        };
      }
      return {
        state: { phase: "name_choice", attemptsOnPhase: 0, totalMistakes: state.totalMistakes },
        effects: [{ type: "advance_to_name_choice" }],
      };
    }

    case "name_choice": {
      if (event.type !== "choose_name") return { state, effects: [] };
      if (event.intervalId !== question.interval) {
        // In song_hint mode the student already found the song — anchor the
        // hint to it. In direct mode, just send them back to the sound.
        const correctRef = question.songOptions.find((r) => isCorrectSongChoice(question, r));
        const hint: LocalizedText =
          question.mode === "song_hint" && correctRef
            ? {
                en: `Not that one. It's the same distance as the start of ${correctRef.title.en} — listen once more.`,
                pt: `Essa não. É a mesma distância do começo de ${correctRef.title.pt} — escute mais uma vez.`,
              }
            : {
                en: "Not that one. Listen again — is the distance a step, a small leap, or a big leap?",
                pt: "Essa não. Escute de novo — a distância é um passo, um salto pequeno ou um salto grande?",
              };
        return retry(hint);
      }
      return {
        state: { phase: "complete", attemptsOnPhase: 0, totalMistakes: state.totalMistakes },
        effects: [{ type: "complete", totalMistakes: state.totalMistakes }],
      };
    }

    case "complete":
      return { state, effects: [] };
  }
}
