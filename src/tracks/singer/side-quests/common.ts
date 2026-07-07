/**
 * Shared shapes for the Singer counterpoint-oriented side quests. Every
 * quest follows the instrumentalist side's state-machine pattern: a pure
 * reducer `(state, event) → { state, effects }`, no UI/audio/persistence
 * coupling. Playback effects carry PhraseNote[] (or voices of them) for the
 * ONE AudioEngine (`playPhrase` / `playPhrases`).
 *
 * The six quests share a theme: harmony as a companion walking beside the
 * melody, not a block glued to it.
 */
import type { PhraseNote } from "../../../engine/audio/audio-engine.js";
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";

export type SingerSideQuestKind =
  | "echo_the_guide" // phrase memory/recall
  | "hold_the_lantern" // hold one pitch while the melody moves
  | "choose_the_better_path" // pick the more natural harmony line
  | "walking_beside_the_melody" // hear contrary/oblique motion
  | "finish_the_phrase" // resolution hearing
  | "hidden_companion"; // hear an inner/partner line

/** One effect union for all six quests — the caller interprets these. */
export type SideQuestEffect =
  | { type: "prompt"; text: LocalizedText }
  | { type: "play_phrase"; phrase: PhraseNote[] }
  | { type: "play_duet"; voices: PhraseNote[][] }
  | { type: "retry"; hint: LocalizedText }
  | { type: "reveal"; text: LocalizedText }
  | { type: "complete"; success: boolean; mistakes: number };

export interface SideQuestTransition<S> {
  state: S;
  effects: SideQuestEffect[];
}
