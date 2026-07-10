/**
 * Level-flow orchestrator — the one entry point for playing a level,
 * regardless of track. Given a level plan (chapter + level + track + tier,
 * materialized into concrete challenges), it sequences the challenges,
 * routes each player response into the existing grading module that owns it,
 * and produces a LevelResult when the level ends.
 *
 * House pattern: a pure reducer (state, event) → { state, effects }. This
 * module contains NO grading, state-machine, or audio logic of its own —
 * it delegates to:
 *   - note-token: judgeAnswer (grade.ts) + strikeReducer (strike-machine.ts)
 *   - key signature: gradeMainAttempt + recoveryReducer (key-signature-quiz.ts)
 *   - intervals: startIntervalQuiz + intervalQuizReducer
 *   - missing note: startMissingNoteQuiz + missingNoteReducer
 *   - side quests: the six singer reducers via the challenges.ts adapter
 * Playback effects those modules emit are forwarded (tagged) for the audio
 * router / UI to interpret against the ONE AudioEngine.
 *
 * Pass rule: a level is passed when every challenge completes successfully.
 * The instrumentalist scaffolding path (strikes, diagnostics, scaffold
 * sequences, key-signature recovery) is instructional, not a gate — a player
 * who works through it still passes; what it cost is recorded (strikesUsed,
 * usedRecovery, closeCalls). Singer one-shot challenges (missing note, side
 * quests) can complete unsuccessfully, which fails the level for this run —
 * replaying is cheap and re-completion is handled by progress tracking.
 */
import type {
  DifficultyTier,
  DifficultyTierId,
  NoteTokenResult,
  SpelledNote,
  TrackId,
} from "../engine/types/schema.js";
import { getKey } from "../engine/theory/keys.js";
import { judgeAnswer, type Feedback } from "../tracks/instrumentalist/note-token/grade.js";
import {
  INITIAL_STRIKE_STATE,
  strikeReducer,
  type StrikeEffect,
  type StrikeState,
} from "../tracks/instrumentalist/scaffold/strike-machine.js";
import {
  gradeMainAttempt,
  recoveryReducer,
  type FullSetGrade,
  type RecoveryAnswer,
  type RecoveryEffect,
  type RecoveryState,
} from "../tracks/instrumentalist/quizzes/key-signature-quiz.js";
import {
  intervalQuizReducer,
  startIntervalQuiz,
  type IntervalQuizEffect,
  type IntervalQuizEvent,
  type IntervalQuizState,
} from "../tracks/singer/intervals/interval-quiz.js";
import {
  missingNoteReducer,
  startMissingNoteQuiz,
  type MissingNoteEffect,
  type MissingNoteEvent,
  type MissingNoteState,
} from "../tracks/singer/missing-note/missing-note-quiz.js";
import type { SideQuestEffect } from "../tracks/singer/side-quests/common.js";
import {
  challengeKeyId,
  reduceSideQuest,
  startSideQuest,
  type Challenge,
  type SideQuestEvent,
  type SideQuestRunState,
} from "./challenges.js";

// ---------------------------------------------------------------------------
// Plan & result
// ---------------------------------------------------------------------------

export interface LevelPlan {
  chapterId: string;
  levelId: string;
  trackId: TrackId;
  tier: DifficultyTier;
  /** From the chapter — governs Advanced Close-answer policy. */
  testsNotationPrecision: boolean;
  challenges: Challenge[];
}

export interface ChallengeResult {
  challengeId: string;
  kind: Challenge["kind"];
  succeeded: boolean;
  /** Answer events submitted for this challenge. */
  attempts: number;
  /** Wrong answers / drifts / retries, per the owning module's counting. */
  mistakes: number;
  /** Close (right pitch, wrong spelling) answers, regardless of tier policy. */
  closeCalls: number;
  /** Note-token only: the player reached the strike-3 scaffold sequence. */
  enteredScaffold: boolean;
  /** Key-signature only: the main attempt failed into the recovery flow. */
  usedRecovery: boolean;
  /** Three-state per-answer outcomes, for the progress attempt history. */
  answerResults: NoteTokenResult[];
}

export type LevelOutcome = "passed" | "failed" | "abandoned";

export interface LevelResult {
  chapterId: string;
  levelId: string;
  trackId: TrackId;
  tierId: DifficultyTierId;
  outcome: LevelOutcome;
  /** Mistakes that reached the strike machine, summed across challenges. */
  strikesUsed: number;
  closeCallCount: number;
  totalAttempts: number;
  enteredScaffoldSequence: boolean;
  challengeResults: ChallengeResult[];
}

// ---------------------------------------------------------------------------
// State, events, effects
// ---------------------------------------------------------------------------

interface Tally {
  attempts: number;
  mistakes: number;
  closeCalls: number;
  enteredScaffold: boolean;
  usedRecovery: boolean;
  answerResults: NoteTokenResult[];
}

const EMPTY_TALLY: Tally = {
  attempts: 0,
  mistakes: 0,
  closeCalls: 0,
  enteredScaffold: false,
  usedRecovery: false,
  answerResults: [],
};

export type ChallengeRuntime =
  | { kind: "note_token"; correctCount: number; strike: StrikeState; tally: Tally }
  | { kind: "key_signature"; mode: "main" | "recovery"; recovery: RecoveryState; tally: Tally }
  | { kind: "interval"; quiz: IntervalQuizState; tally: Tally }
  | { kind: "missing_note"; quiz: MissingNoteState; tally: Tally }
  | { kind: "side_quest"; quest: SideQuestRunState; tally: Tally };

export interface LevelFlowState {
  phase: "running" | "complete";
  challengeIndex: number;
  runtime: ChallengeRuntime | null;
  results: ChallengeResult[];
}

export type LevelEvent =
  // note-token challenge
  | { type: "answer_note"; note: SpelledNote }
  | { type: "diagnostic_answered"; correct: boolean }
  | { type: "scaffold_completed" }
  // key-signature challenge
  | { type: "submit_full_set"; notes: SpelledNote[] }
  | { type: "recovery_answer"; answer: RecoveryAnswer }
  // singer challenges
  | { type: "interval_event"; event: IntervalQuizEvent }
  | { type: "missing_note_event"; event: MissingNoteEvent }
  | { type: "side_quest_event"; event: SideQuestEvent }
  // any time
  | { type: "abandon" };

export type LevelEffect =
  | { type: "challenge_started"; index: number; challenge: Challenge }
  | { type: "set_key"; keyId: string }
  | { type: "feedback"; feedback: Feedback }
  | { type: "strike"; effect: StrikeEffect }
  | { type: "key_signature_graded"; grade: FullSetGrade; enteredRecovery: boolean }
  | { type: "recovery"; effect: RecoveryEffect }
  | { type: "interval"; effect: IntervalQuizEffect }
  | { type: "missing_note"; effect: MissingNoteEffect }
  | { type: "side_quest"; effect: SideQuestEffect }
  | { type: "level_complete"; result: LevelResult };

export interface LevelFlowTransition {
  state: LevelFlowState;
  effects: LevelEffect[];
}

// ---------------------------------------------------------------------------
// Starting
// ---------------------------------------------------------------------------

function initialRuntime(challenge: Challenge): { runtime: ChallengeRuntime; effects: LevelEffect[] } {
  switch (challenge.kind) {
    case "note_token":
      return {
        runtime: { kind: "note_token", correctCount: 0, strike: INITIAL_STRIKE_STATE, tally: EMPTY_TALLY },
        effects: [],
      };
    case "key_signature":
      return {
        runtime: {
          kind: "key_signature",
          mode: "main",
          recovery: { step: "circle_side", attemptsOnStep: 0 },
          tally: EMPTY_TALLY,
        },
        effects: [],
      };
    case "interval": {
      const t = startIntervalQuiz(challenge.question);
      return {
        runtime: { kind: "interval", quiz: t.state, tally: EMPTY_TALLY },
        effects: t.effects.map((effect) => ({ type: "interval", effect }) as const),
      };
    }
    case "missing_note": {
      const t = startMissingNoteQuiz(challenge.question);
      return {
        runtime: { kind: "missing_note", quiz: t.state, tally: EMPTY_TALLY },
        effects: t.effects.map((effect) => ({ type: "missing_note", effect }) as const),
      };
    }
    case "side_quest": {
      const t = startSideQuest(challenge.quest);
      return {
        runtime: { kind: "side_quest", quest: t.state, tally: EMPTY_TALLY },
        effects: t.effects.map((effect) => ({ type: "side_quest", effect }) as const),
      };
    }
  }
}

function startChallenge(plan: LevelPlan, index: number): { runtime: ChallengeRuntime; effects: LevelEffect[] } {
  const challenge = plan.challenges[index]!;
  const { runtime, effects } = initialRuntime(challenge);
  return {
    runtime,
    effects: [
      { type: "challenge_started", index, challenge },
      { type: "set_key", keyId: challengeKeyId(challenge) },
      ...effects,
    ],
  };
}

/** Begin the level: state plus the first challenge's start effects. */
export function startLevel(plan: LevelPlan): LevelFlowTransition {
  if (plan.challenges.length === 0) throw new Error(`Level ${plan.levelId} has no challenges`);
  const { runtime, effects } = startChallenge(plan, 0);
  return {
    state: { phase: "running", challengeIndex: 0, runtime, results: [] },
    effects,
  };
}

// ---------------------------------------------------------------------------
// Completion plumbing
// ---------------------------------------------------------------------------

function buildResult(plan: LevelPlan, results: ChallengeResult[], outcome: LevelOutcome): LevelResult {
  return {
    chapterId: plan.chapterId,
    levelId: plan.levelId,
    trackId: plan.trackId,
    tierId: plan.tier.id,
    outcome,
    strikesUsed: results.reduce((n, r) => n + (r.kind === "note_token" ? r.mistakes : 0), 0),
    closeCallCount: results.reduce((n, r) => n + r.closeCalls, 0),
    totalAttempts: results.reduce((n, r) => n + r.attempts, 0),
    enteredScaffoldSequence: results.some((r) => r.enteredScaffold),
    challengeResults: results,
  };
}

/** Finish the current challenge and either start the next or end the level. */
function completeChallenge(
  plan: LevelPlan,
  state: LevelFlowState,
  tally: Tally,
  succeeded: boolean,
  precedingEffects: LevelEffect[],
): LevelFlowTransition {
  const challenge = plan.challenges[state.challengeIndex]!;
  const result: ChallengeResult = {
    challengeId: challenge.id,
    kind: challenge.kind,
    succeeded,
    attempts: tally.attempts,
    mistakes: tally.mistakes,
    closeCalls: tally.closeCalls,
    enteredScaffold: tally.enteredScaffold,
    usedRecovery: tally.usedRecovery,
    answerResults: tally.answerResults,
  };
  const results = [...state.results, result];
  const nextIndex = state.challengeIndex + 1;

  if (nextIndex < plan.challenges.length) {
    const { runtime, effects } = startChallenge(plan, nextIndex);
    return {
      state: { phase: "running", challengeIndex: nextIndex, runtime, results },
      effects: [...precedingEffects, ...effects],
    };
  }

  const outcome: LevelOutcome = results.every((r) => r.succeeded) ? "passed" : "failed";
  const levelResult = buildResult(plan, results, outcome);
  return {
    state: { phase: "complete", challengeIndex: state.challengeIndex, runtime: null, results },
    effects: [...precedingEffects, { type: "level_complete", result: levelResult }],
  };
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function levelFlowReducer(
  state: LevelFlowState,
  event: LevelEvent,
  plan: LevelPlan,
): LevelFlowTransition {
  if (state.phase !== "running" || !state.runtime) return { state, effects: [] };

  if (event.type === "abandon") {
    const result = buildResult(plan, state.results, "abandoned");
    return {
      state: { ...state, phase: "complete", runtime: null },
      effects: [{ type: "level_complete", result }],
    };
  }

  const challenge = plan.challenges[state.challengeIndex]!;
  const rt = state.runtime;

  switch (rt.kind) {
    case "note_token":
      return reduceNoteToken(plan, state, rt, event, challenge);
    case "key_signature":
      return reduceKeySignature(plan, state, rt, event, challenge);
    case "interval": {
      if (event.type !== "interval_event" || challenge.kind !== "interval") return { state, effects: [] };
      const t = intervalQuizReducer(rt.quiz, event.event, challenge.question);
      const mistakes = t.effects.filter((e) => e.type === "retry").length;
      const tally: Tally = {
        ...rt.tally,
        attempts: rt.tally.attempts + 1,
        mistakes: rt.tally.mistakes + mistakes,
        answerResults: [...rt.tally.answerResults, mistakes > 0 ? "wrong" : "correct"],
      };
      const effects: LevelEffect[] = t.effects.map((effect) => ({ type: "interval", effect }) as const);
      const done = t.effects.find((e) => e.type === "complete");
      if (done) return completeChallenge(plan, state, tally, true, effects);
      return { state: { ...state, runtime: { ...rt, quiz: t.state, tally } }, effects };
    }
    case "missing_note": {
      if (event.type !== "missing_note_event" || challenge.kind !== "missing_note") return { state, effects: [] };
      const t = missingNoteReducer(rt.quiz, event.event, challenge.question);
      const effects: LevelEffect[] = t.effects.map((effect) => ({ type: "missing_note", effect }) as const);
      const done = t.effects.find((e) => e.type === "complete");
      if (done && done.type === "complete") {
        const tally: Tally = {
          ...rt.tally,
          attempts: rt.tally.attempts + 1,
          mistakes: rt.tally.mistakes + (done.correct ? 0 : 1),
          answerResults: [...rt.tally.answerResults, done.correct ? "correct" : "wrong"],
        };
        return completeChallenge(plan, state, tally, done.correct, effects);
      }
      return { state: { ...state, runtime: { ...rt, quiz: t.state } }, effects };
    }
    case "side_quest": {
      if (event.type !== "side_quest_event" || challenge.kind !== "side_quest") return { state, effects: [] };
      const t = reduceSideQuest(challenge.quest, rt.quest, event.event);
      const effects: LevelEffect[] = t.effects.map((effect) => ({ type: "side_quest", effect }) as const);
      const done = t.effects.find((e) => e.type === "complete");
      if (done && done.type === "complete") {
        const tally: Tally = {
          ...rt.tally,
          attempts: rt.tally.attempts + 1,
          mistakes: done.mistakes,
          answerResults: [...rt.tally.answerResults, done.success ? "correct" : "wrong"],
        };
        return completeChallenge(plan, state, tally, done.success, effects);
      }
      const tally: Tally = { ...rt.tally, attempts: rt.tally.attempts + 1 };
      return { state: { ...state, runtime: { ...rt, quest: t.state, tally } }, effects };
    }
  }
}

// ---------------------------------------------------------------------------
// Note-token challenge: judgeAnswer + strike machine, composed as documented
// in their own modules — grading decides what an answer WAS, tier policy
// decides what it COSTS, the strike machine counts only real mistakes.
// ---------------------------------------------------------------------------

function reduceNoteToken(
  plan: LevelPlan,
  state: LevelFlowState,
  rt: Extract<ChallengeRuntime, { kind: "note_token" }>,
  event: LevelEvent,
  challenge: Challenge,
): LevelFlowTransition {
  if (challenge.kind !== "note_token") return { state, effects: [] };
  const { scale } = getKey(challenge.keyId);

  if (event.type === "answer_note") {
    if (rt.strike.phase !== "answering") return { state, effects: [] }; // paused for diagnostic/scaffold
    const judgment = judgeAnswer(event.note, scale, plan.tier, plan.testsNotationPrecision);
    const effects: LevelEffect[] = [{ type: "feedback", feedback: judgment.feedback }];

    const tally: Tally = {
      ...rt.tally,
      attempts: rt.tally.attempts + 1,
      mistakes: rt.tally.mistakes + (judgment.countsAsMistake ? 1 : 0),
      closeCalls: rt.tally.closeCalls + (judgment.graded.result === "close" ? 1 : 0),
      answerResults: [...rt.tally.answerResults, judgment.graded.result],
    };

    const strikeEvent = judgment.countsAsMistake
      ? ({ type: "mistake" } as const)
      : judgment.graded.result === "correct"
        ? ({ type: "correct" } as const)
        : null; // Close under a lenient policy never reaches the machine.
    const strike = strikeEvent ? strikeReducer(rt.strike, strikeEvent) : { state: rt.strike, effects: [] };
    effects.push(...strike.effects.map((effect) => ({ type: "strike", effect }) as const));
    const enteredScaffold = tally.enteredScaffold || strike.state.phase === "scaffold";

    const correctCount = rt.correctCount + (judgment.graded.result === "correct" ? 1 : 0);
    const nextTally = { ...tally, enteredScaffold };
    if (correctCount >= challenge.requiredCorrect) {
      return completeChallenge(plan, state, nextTally, true, effects);
    }
    return {
      state: { ...state, runtime: { ...rt, correctCount, strike: strike.state, tally: nextTally } },
      effects,
    };
  }

  if (event.type === "diagnostic_answered") {
    const strike = strikeReducer(rt.strike, { type: "diagnostic_answered", correct: event.correct });
    const enteredScaffold = rt.tally.enteredScaffold || strike.state.phase === "scaffold";
    return {
      state: {
        ...state,
        runtime: { ...rt, strike: strike.state, tally: { ...rt.tally, enteredScaffold } },
      },
      effects: strike.effects.map((effect) => ({ type: "strike", effect }) as const),
    };
  }

  if (event.type === "scaffold_completed") {
    const strike = strikeReducer(rt.strike, { type: "scaffold_completed" });
    return {
      state: { ...state, runtime: { ...rt, strike: strike.state } },
      effects: strike.effects.map((effect) => ({ type: "strike", effect }) as const),
    };
  }

  return { state, effects: [] };
}

// ---------------------------------------------------------------------------
// Key-signature challenge: gradeMainAttempt, then the recovery reducer
// ---------------------------------------------------------------------------

function reduceKeySignature(
  plan: LevelPlan,
  state: LevelFlowState,
  rt: Extract<ChallengeRuntime, { kind: "key_signature" }>,
  event: LevelEvent,
  challenge: Challenge,
): LevelFlowTransition {
  if (challenge.kind !== "key_signature") return { state, effects: [] };
  const built = getKey(challenge.keyId);

  if (event.type === "submit_full_set" && rt.mode === "main") {
    const outcome = gradeMainAttempt(event.notes, built.keySignature);
    const closeCalls = outcome.grade.wrongSpellings.length;
    const answer: NoteTokenResult = outcome.kind === "passed" ? "correct" : closeCalls > 0 ? "close" : "wrong";
    const tally: Tally = {
      ...rt.tally,
      attempts: rt.tally.attempts + 1,
      mistakes: rt.tally.mistakes + (outcome.kind === "passed" ? 0 : 1),
      closeCalls: rt.tally.closeCalls + closeCalls,
      usedRecovery: rt.tally.usedRecovery || outcome.kind === "enter_recovery",
      answerResults: [...rt.tally.answerResults, answer],
    };
    const effects: LevelEffect[] = [
      { type: "key_signature_graded", grade: outcome.grade, enteredRecovery: outcome.kind === "enter_recovery" },
    ];
    if (outcome.kind === "passed") {
      return completeChallenge(plan, state, tally, true, effects);
    }
    return {
      state: { ...state, runtime: { ...rt, mode: "recovery", recovery: outcome.recovery, tally } },
      effects,
    };
  }

  if (event.type === "recovery_answer" && rt.mode === "recovery") {
    const t = recoveryReducer(rt.recovery, event.answer, built.key, built.keySignature, {
      includeOrderStep: challenge.includeOrderStep,
    });
    const retried = t.effects.some((e) => e.type === "retry_step");
    const tally: Tally = {
      ...rt.tally,
      attempts: rt.tally.attempts + 1,
      mistakes: rt.tally.mistakes + (retried ? 1 : 0),
    };
    const effects: LevelEffect[] = t.effects.map((effect) => ({ type: "recovery", effect }) as const);
    if (t.state.step === "complete") {
      // Recovery IS the scaffold for this quiz type — completing it completes
      // the challenge (successfully; what it cost is in the tally).
      return completeChallenge(plan, state, tally, true, effects);
    }
    return { state: { ...state, runtime: { ...rt, recovery: t.state, tally } }, effects };
  }

  return { state, effects: [] };
}
