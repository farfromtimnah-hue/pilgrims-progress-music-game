/**
 * Player progress tracking — records level-flow results into the schema's
 * PlayerProgress entity.
 *
 * Shape: one PlayerProgress record per (player, track, tier) — the schema
 * carries trackId and tierId on the record, so per-tier completion of the
 * same level lives in separate records and the pilgrimage-emblem check
 * (piece 3) reads across a player's records.
 *
 * Re-completion is safe by construction: completedLevelIds is a set (adding
 * an already-passed level is a no-op), while attemptHistory is history and
 * every run appends — replaying a passed tier enriches history without
 * duplicating or corrupting completion state.
 *
 * Persistence follows the established backend pattern (AudioBackend,
 * LanguageStorageBackend): a narrow interface, a browser localStorage
 * implementation, and an in-memory fake for tests. A corrupt stored blob
 * reads as "no progress," never as a crash or a half-record.
 */
import type {
  DifficultyTierId,
  PlayerProgress,
  QuizAttemptRecord,
  TrackId,
} from "../engine/types/schema.js";
import type { ChallengeResult, LevelResult } from "./level-flow.js";

// ---------------------------------------------------------------------------
// Pure core: fold a LevelResult into a PlayerProgress record
// ---------------------------------------------------------------------------

function emptyProgress(
  playerId: string,
  trackId: TrackId,
  tierId: DifficultyTierId,
  chapterId: string,
  levelId: string,
  timestamp: string,
): PlayerProgress {
  return {
    playerId,
    trackId,
    tierId,
    currentChapterId: chapterId,
    currentLevelId: levelId,
    completedLevelIds: [],
    completedSideQuestIds: [],
    earnedRewardIds: [],
    harmonicUnlockIds: [],
    keyMastery: {},
    attemptHistory: [],
    updatedAt: timestamp,
  };
}

function toAttemptRecord(
  challenge: ChallengeResult,
  result: LevelResult,
  timestamp: string,
): QuizAttemptRecord {
  return {
    quizTemplateId: challenge.challengeId,
    levelId: result.levelId,
    timestamp,
    result:
      result.outcome === "abandoned" ? "abandoned" : challenge.succeeded ? "passed" : "failed",
    answerResults: challenge.answerResults,
    strikesUsed: challenge.kind === "note_token" ? challenge.mistakes : 0,
    enteredScaffoldSequence: challenge.enteredScaffold,
  };
}

/**
 * Fold one level result into the player's record for that track+tier
 * (creating it if absent). Pure — the timestamp is a parameter.
 */
export function applyLevelResult(
  existing: PlayerProgress | null,
  playerId: string,
  result: LevelResult,
  timestamp: string,
): PlayerProgress {
  const base =
    existing ??
    emptyProgress(playerId, result.trackId, result.tierId, result.chapterId, result.levelId, timestamp);
  if (existing && (existing.trackId !== result.trackId || existing.tierId !== result.tierId)) {
    throw new Error(
      `Progress record is for ${existing.trackId}/${existing.tierId}, result is for ${result.trackId}/${result.tierId}`,
    );
  }

  const completedLevelIds =
    result.outcome === "passed" && !base.completedLevelIds.includes(result.levelId)
      ? [...base.completedLevelIds, result.levelId]
      : base.completedLevelIds;

  return {
    ...base,
    currentChapterId: result.chapterId,
    currentLevelId: result.levelId,
    completedLevelIds,
    attemptHistory: [
      ...base.attemptHistory,
      ...result.challengeResults.map((c) => toAttemptRecord(c, result, timestamp)),
    ],
    updatedAt: timestamp,
  };
}

/** True when the record shows every one of the given levels completed. */
export function hasCompletedLevels(progress: PlayerProgress | null, levelIds: string[]): boolean {
  if (!progress) return false;
  return levelIds.every((id) => progress.completedLevelIds.includes(id));
}

// ---------------------------------------------------------------------------
// Persistence backend
// ---------------------------------------------------------------------------

export const PROGRESS_STORAGE_KEY_PREFIX = "ppmg.progress.";

export interface ProgressStorageBackend {
  read(playerId: string): string | null;
  write(playerId: string, value: string): void;
}

/** Browser persistence via window.localStorage, one blob per player. */
export class LocalStorageProgressBackend implements ProgressStorageBackend {
  read(playerId: string): string | null {
    return localStorage.getItem(PROGRESS_STORAGE_KEY_PREFIX + playerId);
  }
  write(playerId: string, value: string): void {
    localStorage.setItem(PROGRESS_STORAGE_KEY_PREFIX + playerId, value);
  }
}

/** Test/fake persistence, mirroring InMemoryLanguageBackend. */
export class InMemoryProgressBackend implements ProgressStorageBackend {
  private values = new Map<string, string>();
  read(playerId: string): string | null {
    return this.values.get(playerId) ?? null;
  }
  write(playerId: string, value: string): void {
    this.values.set(playerId, value);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface PlayerBlob {
  records: PlayerProgress[];
}

function isPlayerBlob(value: unknown): value is PlayerBlob {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as PlayerBlob).records) &&
    (value as PlayerBlob).records.every(
      (r) => typeof r === "object" && r !== null && typeof r.playerId === "string",
    )
  );
}

export class ProgressStore {
  constructor(
    private readonly backend: ProgressStorageBackend,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  /** All records for a player (one per track+tier played). Corrupt data reads as none. */
  allForPlayer(playerId: string): PlayerProgress[] {
    const raw = this.backend.read(playerId);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPlayerBlob(parsed) ? parsed.records : [];
    } catch {
      return [];
    }
  }

  getProgress(playerId: string, trackId: TrackId, tierId: DifficultyTierId): PlayerProgress | null {
    return (
      this.allForPlayer(playerId).find((r) => r.trackId === trackId && r.tierId === tierId) ?? null
    );
  }

  /** Fold a level result into the matching record and persist. Returns the updated record. */
  recordLevelResult(playerId: string, result: LevelResult): PlayerProgress {
    const updated = applyLevelResult(
      this.getProgress(playerId, result.trackId, result.tierId),
      playerId,
      result,
      this.now(),
    );
    this.saveRecord(playerId, updated);
    return updated;
  }

  /** Add rewards to a record, without duplicates (piece 3 calls this). */
  grantRewards(
    playerId: string,
    trackId: TrackId,
    tierId: DifficultyTierId,
    rewardIds: string[],
  ): PlayerProgress {
    const record = this.getProgress(playerId, trackId, tierId);
    if (!record) throw new Error(`No progress record for ${playerId} ${trackId}/${tierId}`);
    const added = rewardIds.filter((id) => !record.earnedRewardIds.includes(id));
    if (added.length === 0) return record;
    const updated: PlayerProgress = {
      ...record,
      earnedRewardIds: [...record.earnedRewardIds, ...added],
      updatedAt: this.now(),
    };
    this.saveRecord(playerId, updated);
    return updated;
  }

  /** Add harmonic unlocks to a record, without duplicates (piece 3 calls this). */
  grantHarmonicUnlocks(
    playerId: string,
    trackId: TrackId,
    tierId: DifficultyTierId,
    unlockIds: string[],
  ): PlayerProgress {
    const record = this.getProgress(playerId, trackId, tierId);
    if (!record) throw new Error(`No progress record for ${playerId} ${trackId}/${tierId}`);
    const added = unlockIds.filter((id) => !record.harmonicUnlockIds.includes(id));
    if (added.length === 0) return record;
    const updated: PlayerProgress = {
      ...record,
      harmonicUnlockIds: [...record.harmonicUnlockIds, ...added],
      updatedAt: this.now(),
    };
    this.saveRecord(playerId, updated);
    return updated;
  }

  /** Reward ids earned across every record (tier badges live per tier; emblems span tiers). */
  earnedRewardIds(playerId: string): string[] {
    const seen = new Set<string>();
    for (const record of this.allForPlayer(playerId)) {
      for (const id of record.earnedRewardIds) seen.add(id);
    }
    return [...seen];
  }

  private saveRecord(playerId: string, record: PlayerProgress): void {
    const records = this.allForPlayer(playerId).filter(
      (r) => !(r.trackId === record.trackId && r.tierId === record.tierId),
    );
    records.push(record);
    this.backend.write(playerId, JSON.stringify({ records } satisfies PlayerBlob));
  }
}
