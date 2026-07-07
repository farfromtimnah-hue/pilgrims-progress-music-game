/**
 * Hold the Lantern — hold one pitch steady while the melody moves around it.
 * The first taste of vocal independence: your note doesn't move just because
 * the melody does. The caller's pitch detection reports what the student is
 * singing at each checkpoint; the machine counts drifts and completes when
 * all checkpoints are in.
 */
import type { PlacedNote } from "../../../engine/theory/intervals.js";
import { midiOf, pitchClassOf } from "../../../engine/theory/pitch.js";
import { melodyToPhrase, type MelodyNote } from "../missing-note/melodies.js";
import type { SideQuestTransition } from "./common.js";

export interface LanternQuestion {
  id: string;
  /** The pitch to hold. */
  target: PlacedNote;
  /** The melody that moves against it. */
  melody: MelodyNote[];
  /** How many pitch checkpoints the caller will report. */
  checkpoints: number;
  /** Drifts tolerated before the quest counts as unsuccessful. */
  allowedDrifts: number;
}

export interface LanternState {
  phase: "holding" | "complete";
  checkpointsSeen: number;
  drifts: number;
}

export type LanternEvent = { type: "checkpoint"; pitch: PlacedNote };

export type LanternTransition = SideQuestTransition<LanternState>;

export function startLanternQuest(question: LanternQuestion): LanternTransition {
  const targetToken = {
    id: `${question.id}-target`,
    note: question.target.note,
    pitchClass: pitchClassOf(question.target.note),
    octave: question.target.octave,
  };
  return {
    state: { phase: "holding", checkpointsSeen: 0, drifts: 0 },
    effects: [
      {
        type: "prompt",
        text: {
          en: "This is your note — hold the lantern steady while the melody walks around you.",
          pt: "Esta é a sua nota — segure a lanterna firme enquanto a melodia caminha ao seu redor.",
        },
      },
      // Give the pitch, then start the moving melody against it.
      { type: "play_phrase", phrase: [{ token: targetToken, beats: 2 }] },
      { type: "play_duet", voices: [melodyToPhrase(question.melody, question.id), [{ token: targetToken, beats: totalBeats(question.melody) }]] },
    ],
  };
}

function totalBeats(melody: MelodyNote[]): number {
  return melody.reduce((sum, n) => sum + n.beats, 0);
}

export function lanternReducer(
  state: LanternState,
  event: LanternEvent,
  question: LanternQuestion,
): LanternTransition {
  if (state.phase !== "holding" || event.type !== "checkpoint") return { state, effects: [] };

  const onTarget = midiOf(event.pitch.note, event.pitch.octave) === midiOf(question.target.note, question.target.octave);
  const drifts = state.drifts + (onTarget ? 0 : 1);
  const checkpointsSeen = state.checkpointsSeen + 1;

  if (checkpointsSeen >= question.checkpoints) {
    const success = drifts <= question.allowedDrifts;
    return {
      state: { phase: "complete", checkpointsSeen, drifts },
      effects: [{ type: "complete", success, mistakes: drifts }],
    };
  }

  return {
    state: { phase: "holding", checkpointsSeen, drifts },
    effects: onTarget
      ? []
      : [
          {
            type: "retry",
            hint: {
              en: "The melody pulled you along — find your note again; it's still there underneath.",
              pt: "A melodia te levou junto — encontre sua nota de novo; ela continua ali embaixo.",
            },
          },
        ],
  };
}
