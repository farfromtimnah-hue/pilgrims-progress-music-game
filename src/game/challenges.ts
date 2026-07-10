/**
 * Challenge materialization — the bridge between data-driven level
 * definitions (chapters/levels/quiz templates by id) and the concrete,
 * playable challenge instances the level-flow orchestrator sequences.
 *
 * Nothing here grades anything: every challenge kind points at the existing
 * committed module that owns its logic (note-token grading + strike machine,
 * key-signature quiz, interval quiz, missing-note quiz, the six singer side
 * quests). This file only names them in one union so the orchestrator can
 * route events to the right one.
 *
 * Real chapter/level content (which melodies, which intervals, token sets)
 * is a future authoring session; the materializer hook below is where that
 * content will plug in without touching the orchestrator.
 */
import type {
  Chapter,
  DifficultyTierId,
  Level,
  QuizTemplate,
  TrackId,
} from "../engine/types/schema.js";
import type { IntervalQuestion } from "../tracks/singer/intervals/interval-quiz.js";
import type { MissingNoteQuestion } from "../tracks/singer/missing-note/missing-note-quiz.js";
import type { SingerSideQuestKind, SideQuestTransition } from "../tracks/singer/side-quests/common.js";
import {
  echoReducer,
  startEchoQuest,
  type EchoEvent,
  type EchoQuestion,
  type EchoState,
} from "../tracks/singer/side-quests/echo-the-guide.js";
import {
  lanternReducer,
  startLanternQuest,
  type LanternEvent,
  type LanternQuestion,
  type LanternState,
} from "../tracks/singer/side-quests/hold-the-lantern.js";
import {
  betterPathReducer,
  startBetterPathQuest,
  type BetterPathEvent,
  type BetterPathQuestion,
  type BetterPathState,
} from "../tracks/singer/side-quests/choose-the-better-path.js";
import {
  startWalkingQuest,
  walkingReducer,
  type WalkingEvent,
  type WalkingQuestion,
  type WalkingState,
} from "../tracks/singer/side-quests/walking-beside-the-melody.js";
import {
  finishReducer,
  startFinishQuest,
  type FinishEvent,
  type FinishQuestion,
  type FinishState,
} from "../tracks/singer/side-quests/finish-the-phrase.js";
import {
  hiddenCompanionReducer,
  startHiddenCompanionQuest,
  type HiddenCompanionEvent,
  type HiddenCompanionQuestion,
  type HiddenCompanionState,
} from "../tracks/singer/side-quests/hidden-companion.js";

// ---------------------------------------------------------------------------
// Challenge union
// ---------------------------------------------------------------------------

/** Instrumentalist: classify note tokens against the key (grade.ts + strike machine). */
export interface NoteTokenChallenge {
  kind: "note_token";
  id: string;
  keyId: string;
  /** Correct in-key picks required to complete the challenge. */
  requiredCorrect: number;
}

/** Instrumentalist: full-set key-signature selection with scaffolded recovery. */
export interface KeySignatureChallenge {
  kind: "key_signature";
  id: string;
  keyId: string;
  includeOrderStep: boolean;
}

/** Singer: interval recognition (song-hint or direct mode). */
export interface IntervalChallenge {
  kind: "interval";
  id: string;
  /** Key whose context the interval sounds against (audio only). */
  contextKeyId: string;
  question: IntervalQuestion;
}

/** Singer: missing-note melodic completion. */
export interface MissingNoteChallenge {
  kind: "missing_note";
  id: string;
  question: MissingNoteQuestion;
}

/** Singer: one of the six counterpoint side quests. */
export interface SideQuestChallenge {
  kind: "side_quest";
  id: string;
  contextKeyId: string;
  quest: SideQuestSpec;
}

export type Challenge =
  | NoteTokenChallenge
  | KeySignatureChallenge
  | IntervalChallenge
  | MissingNoteChallenge
  | SideQuestChallenge;

/** The key whose audio context a challenge plays in. */
export function challengeKeyId(challenge: Challenge): string {
  switch (challenge.kind) {
    case "note_token":
    case "key_signature":
      return challenge.keyId;
    case "interval":
    case "side_quest":
      return challenge.contextKeyId;
    case "missing_note":
      return challenge.question.melody.keyId;
  }
}

// ---------------------------------------------------------------------------
// Side-quest adapter — one uniform start/reduce over the six real reducers
// ---------------------------------------------------------------------------

export type SideQuestSpec =
  | { kind: "echo_the_guide"; question: EchoQuestion }
  | { kind: "hold_the_lantern"; question: LanternQuestion }
  | { kind: "choose_the_better_path"; question: BetterPathQuestion }
  | { kind: "walking_beside_the_melody"; question: WalkingQuestion }
  | { kind: "finish_the_phrase"; question: FinishQuestion }
  | { kind: "hidden_companion"; question: HiddenCompanionQuestion };

export type SideQuestEvent =
  | EchoEvent
  | LanternEvent
  | BetterPathEvent
  | WalkingEvent
  | FinishEvent
  | HiddenCompanionEvent;

/** Opaque to the orchestrator; each quest's real state type underneath. */
export type SideQuestRunState =
  | EchoState
  | LanternState
  | BetterPathState
  | WalkingState
  | FinishState
  | HiddenCompanionState;

export function startSideQuest(spec: SideQuestSpec): SideQuestTransition<SideQuestRunState> {
  switch (spec.kind) {
    case "echo_the_guide":
      return startEchoQuest(spec.question);
    case "hold_the_lantern":
      return startLanternQuest(spec.question);
    case "choose_the_better_path":
      return startBetterPathQuest(spec.question);
    case "walking_beside_the_melody":
      return startWalkingQuest(spec.question);
    case "finish_the_phrase":
      return startFinishQuest(spec.question);
    case "hidden_companion":
      return startHiddenCompanionQuest(spec.question);
  }
}

/**
 * Route an event into the real quest reducer. Each reducer already ignores
 * event shapes it doesn't recognize, so a mismatched event is a no-op rather
 * than a crash — same discipline as the reducers themselves.
 */
export function reduceSideQuest(
  spec: SideQuestSpec,
  state: SideQuestRunState,
  event: SideQuestEvent,
): SideQuestTransition<SideQuestRunState> {
  switch (spec.kind) {
    case "echo_the_guide":
      return echoReducer(state as EchoState, event as EchoEvent, spec.question);
    case "hold_the_lantern":
      return lanternReducer(state as LanternState, event as LanternEvent, spec.question);
    case "choose_the_better_path":
      return betterPathReducer(state as BetterPathState, event as BetterPathEvent, spec.question);
    case "walking_beside_the_melody":
      return walkingReducer(state as WalkingState, event as WalkingEvent, spec.question);
    case "finish_the_phrase":
      return finishReducer(state as FinishState, event as FinishEvent, spec.question);
    case "hidden_companion":
      return hiddenCompanionReducer(state as HiddenCompanionState, event as HiddenCompanionEvent, spec.question);
  }
}

export type { SingerSideQuestKind };

// ---------------------------------------------------------------------------
// Materialization from level data
// ---------------------------------------------------------------------------

/** A reference the level definition makes to content, by id. */
export type ChallengeRef =
  | { source: "quiz_template"; id: string }
  | { source: "side_quest"; id: string };

/**
 * Turns a content reference into a playable challenge, or null when the
 * referenced content isn't for this track (it's then skipped, not an error).
 * Content authoring sessions supply richer materializers; tests and the
 * default instrumentalist path use the helpers below.
 */
export type ChallengeMaterializer = (ref: ChallengeRef) => Challenge | null;

/**
 * Default materializer for the two instrumentalist quiz template types.
 * Returns null for templates that don't include the given track or whose
 * type this helper doesn't know (singer questions need authored content).
 */
export function materializeInstrumentalistTemplate(
  template: QuizTemplate,
  trackId: TrackId,
  tierId: DifficultyTierId,
): Challenge | null {
  if (!template.trackIds.includes(trackId)) return null;
  const keyId = template.keyIds[0];
  if (!keyId) throw new Error(`Quiz template ${template.id} lists no keys`);
  const params = template.tierParams?.[tierId] ?? {};

  switch (template.type) {
    case "note_token_membership": {
      // tokenCount is how many tokens the (future) UI displays; roughly half
      // of a mixed token set is in-key, so that's the required correct picks.
      const tokenCount = typeof params["tokenCount"] === "number" ? params["tokenCount"] : 6;
      return { kind: "note_token", id: template.id, keyId, requiredCorrect: Math.ceil(tokenCount / 2) };
    }
    case "key_signature_full_set":
      return {
        kind: "key_signature",
        id: template.id,
        keyId,
        includeOrderStep: params["includeOrderStep"] === true,
      };
    default:
      return null;
  }
}

export interface LevelPlanInput {
  chapter: Chapter;
  level: Level;
  trackId: TrackId;
  tierId: DifficultyTierId;
}

/**
 * Build the ordered challenge list for one level as one track/tier plays it:
 * quiz templates first (the level's core), then side quests. Refs the
 * materializer maps to null (other track's content) are skipped.
 */
export function buildChallengeSequence(
  level: Level,
  materialize: ChallengeMaterializer,
): Challenge[] {
  const refs: ChallengeRef[] = [
    ...level.quizTemplateIds.map((id) => ({ source: "quiz_template", id }) as const),
    ...level.sideQuestIds.map((id) => ({ source: "side_quest", id }) as const),
  ];
  const challenges = refs.map(materialize).filter((c): c is Challenge => c !== null);
  if (challenges.length === 0) {
    throw new Error(`Level ${level.id} materialized no challenges — content error for this track`);
  }
  return challenges;
}
