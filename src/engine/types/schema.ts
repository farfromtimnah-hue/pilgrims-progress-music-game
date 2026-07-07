/**
 * Core data schema for the Pilgrim's Progress Music Game.
 *
 * These types describe the shapes of the JSON content files in /data and the
 * player-progress records the engine persists. Everything the game presents —
 * chapters, tracks, tiers, quiz types, rewards — is instances of these types
 * loaded from data, never hardcoded.
 *
 * Pitch-spelling model: a note is a letter name plus an accidental. The same
 * sounding pitch (pitch class) can have several legitimate spellings; which
 * spelling is *correct* depends on the active key. B# is right in C# major,
 * Fb is right in Gb major — the engine must never flag them as errors merely
 * for being unusual.
 *
 * Localization: every user-facing string field is a LocalizedText carrying
 * both English and Brazilian Portuguese; the active language is resolved at
 * read time (see engine/i18n). Ids and enum values stay plain strings.
 */
import type { LocalizedText } from "../i18n/localized-text.js";

// ---------------------------------------------------------------------------
// Pitch fundamentals
// ---------------------------------------------------------------------------

export type LetterName = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export type Accidental = "bb" | "b" | "natural" | "#" | "##";

/** 0–11, C = 0. The "sounds right" axis, independent of spelling. */
export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

/** A spelled note: the "spelled right for this key" axis. */
export interface SpelledNote {
  letter: LetterName;
  accidental: Accidental;
}

export type KeyMode = "major" | "minor";

// ---------------------------------------------------------------------------
// Tracks & difficulty tiers
// ---------------------------------------------------------------------------

export type TrackId = "instrumentalist" | "singer";

/** Instrumentalist pedagogy order: key signature → note-in-key → scale degree → chord function. */
export type LearningTopic =
  | "key_signature"
  | "note_in_key"
  | "scale_degree"
  | "chord_function";

export interface Track {
  id: TrackId;
  name: LocalizedText;
  description: LocalizedText;
  learningSequence: LearningTopic[];
  enabled: boolean;
}

/** How a tier handles a Close (right pitch, wrong spelling) answer. */
export type CloseAnswerPolicy =
  | "neutral" // Beginner: no damage
  | "teach" // Intermediate: corrective teaching prompt
  | "penalize_if_notation_chapter"; // Advanced: real mistake in notation-precision chapters

export type DifficultyTierId = "beginner" | "intermediate" | "advanced";

export interface DifficultyTier {
  id: DifficultyTierId;
  name: LocalizedText;
  closeAnswerPolicy: CloseAnswerPolicy;
  description: LocalizedText;
}

// ---------------------------------------------------------------------------
// World: chapters, levels, side quests
// ---------------------------------------------------------------------------

export interface Chapter {
  id: string;
  title: LocalizedText;
  order: number;
  /** When true, Advanced tier counts Close answers as real mistakes. */
  testsNotationPrecision: boolean;
  /** Keys in play for this chapter (ids into keys data). */
  keyIds: string[];
  levels: Level[];
}

export interface Level {
  id: string;
  order: number;
  quizTemplateIds: string[];
  rewardIds: string[];
  sideQuestIds: string[];
  audioCueIds: string[];
  harmonicUnlockIds: string[];
}

export interface SideQuest {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  /** Which track(s) can take this quest; both share one world. */
  trackIds: TrackId[];
  quizTemplateIds: string[];
  rewardIds: string[];
}

// ---------------------------------------------------------------------------
// Keys, key signatures, enharmonics, scale degrees
// ---------------------------------------------------------------------------

export interface Key {
  id: string; // e.g. "Eb-major", "c#-minor"
  tonic: SpelledNote;
  mode: KeyMode;
  displayName: LocalizedText; // e.g. { en: "E♭ major", pt: "Mi♭ maior" }
  /** Which side of the circle of fifths: sharps, flats, or neither (C major / A minor). */
  circleSide: "sharp" | "flat" | "none";
  accidentalCount: number; // 0–7
}

/**
 * The exact accidental set for one key — the answer key for the full-set
 * key-signature quiz. Order matters (F# C# G# D# A# E# B# / Bb Eb Ab Db Gb Cb Fb).
 */
export interface KeySignatureAccidentals {
  keyId: string;
  accidentalType: "#" | "b" | "none";
  /** In signature order; empty for C major / A minor. */
  accidentals: SpelledNote[];
}

/**
 * A legitimate enharmonic relationship in a key context. These encode why an
 * answer is Close rather than Wrong: same sounding pitch, different spelling.
 */
export interface EnharmonicRule {
  id: string;
  keyId: string;
  /** The spelling this key calls for. */
  correctSpelling: SpelledNote;
  /** A same-pitch spelling students commonly substitute (e.g. D# for Eb). */
  equivalentSpellings: SpelledNote[];
  /** Teaching prompt shown when a Close answer uses one of the equivalents. */
  teachingPrompt: LocalizedText;
}

/** Maps scale degrees (1–7) to spelled notes for one key. */
export interface ScaleDegreeMap {
  keyId: string;
  /** Index 0 = degree 1 (tonic) … index 6 = degree 7. Always 7 entries. */
  degrees: SpelledNote[];
}

// ---------------------------------------------------------------------------
// Note tokens & quizzes
// ---------------------------------------------------------------------------

/**
 * A note token: one selectable note in a note-membership exercise. Tokens are
 * spelled, not just pitched, so the engine can grade spelling separately from
 * sound.
 */
export interface NoteToken {
  id: string;
  note: SpelledNote;
  pitchClass: PitchClass;
  /** Octave for audio playback, e.g. 4 = middle-C octave. */
  octave: number;
}

/** Grading outcome for a note token, three-state — never binary. */
export type NoteTokenResult = "correct" | "close" | "wrong";

export type QuizType =
  | "note_token_membership" // pick the notes that belong to the key
  | "key_signature_full_set" // select ALL accidentals in the key, no extras
  | "scale_degree" // name/place scale degrees
  | "chord_function" // identify chord function (later chapters)
  | "interval_recognition" // Singer: hear an interval, song reference → formal name
  | "missing_note_completion"; // Singer: complete a familiar phrase's missing note by ear

export interface QuizTemplate {
  id: string;
  type: QuizType;
  title: LocalizedText;
  trackIds: TrackId[];
  /** Topic this quiz teaches, for sequencing against a track's learningSequence. */
  topic: LearningTopic;
  keyIds: string[];
  /** Tier-specific parameter overrides (e.g. token counts, time limits). */
  tierParams?: Partial<Record<DifficultyTierId, Record<string, number | string | boolean>>>;
}

// ---------------------------------------------------------------------------
// Scaffolding (three-strike recovery)
// ---------------------------------------------------------------------------

export type ScaffoldStepKind =
  | "prompt" // short teaching prompt (strike 1)
  | "diagnostic" // smaller diagnostic question (strike 2)
  | "sequence"; // full scaffold sequence before re-entry (strike 3)

export interface ScaffoldStep {
  kind: ScaffoldStepKind;
  /** Content id: a prompt string id, diagnostic quiz id, or sequence id. */
  contentId: string;
}

/**
 * A scaffold sequence: the instructional (not punitive) path a player is
 * routed into after strike 3, before re-entering the level.
 */
export interface ScaffoldSequence {
  id: string;
  title: LocalizedText;
  topic: LearningTopic;
  /** Ordered instructional steps (mini-lessons / guided questions). */
  stepIds: string[];
  /** Where the player re-enters after completing the sequence. */
  reentry: "retry_question" | "restart_level_section";
}

// ---------------------------------------------------------------------------
// Audio
// ---------------------------------------------------------------------------

/**
 * Musical context a note sounds against. Notes NEVER play as bare isolated
 * tones — one of these is always active.
 */
export type AudioContextKind = "tonic_drone" | "sustained_pad" | "backing_chord";

export interface AudioCue {
  id: string;
  kind: AudioContextKind;
  keyId: string;
  /** For backing_chord: chord degrees relative to the key, e.g. [1, 3, 5]. */
  chordDegrees?: number[];
  /** Gain 0–1 for the context layer relative to the melody note. */
  contextGain: number;
}

// ---------------------------------------------------------------------------
// Rewards & unlocks
// ---------------------------------------------------------------------------

export type RewardKind = "badge" | "item" | "cosmetic" | "story_beat" | "currency";

export interface Reward {
  id: string;
  kind: RewardKind;
  name: LocalizedText;
  description: LocalizedText;
  amount?: number;
}

/**
 * A harmonic unlock: new musical material (a chord, progression, or key)
 * that becomes available in the world as the player advances.
 */
export interface HarmonicUnlock {
  id: string;
  name: LocalizedText;
  /** What gets unlocked, referenced by id (key, audio cue, chord voicing…). */
  unlocks: { keyIds?: string[]; audioCueIds?: string[]; chordFunctionIds?: string[] };
  requiredChapterId: string;
}

// ---------------------------------------------------------------------------
// Player progress
// ---------------------------------------------------------------------------

export interface QuizAttemptRecord {
  quizTemplateId: string;
  levelId: string;
  timestamp: string; // ISO 8601
  result: "passed" | "failed" | "abandoned";
  /** Per-token/per-answer outcomes, for analytics and scaffolding decisions. */
  answerResults: NoteTokenResult[];
  strikesUsed: number;
  enteredScaffoldSequence: boolean;
}

export interface PlayerProgress {
  playerId: string;
  trackId: TrackId;
  tierId: DifficultyTierId;
  currentChapterId: string;
  currentLevelId: string;
  completedLevelIds: string[];
  completedSideQuestIds: string[];
  earnedRewardIds: string[];
  harmonicUnlockIds: string[];
  /** Keys the player has demonstrated mastery of (per topic). */
  keyMastery: Record<string, Partial<Record<LearningTopic, "learning" | "practicing" | "mastered">>>;
  attemptHistory: QuizAttemptRecord[];
  updatedAt: string; // ISO 8601
}
