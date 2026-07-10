/**
 * Badge & reward assignment — one shared rule engine, keyed by tier
 * completion of a chapter. The badge model is track-agnostic per the spec:
 * nothing here branches on instrumentalist vs singer; a chapter completed at
 * a tier earns whatever badge reward the DATA declares for that chapter+tier
 * (Beginner crown, Intermediate lantern/scroll, Advanced seal), and the full
 * pilgrimage emblem when all three tiers are complete.
 *
 * Everything is data-driven from the existing entities:
 *   - Reward (kind "badge") carries BadgeCriteria — which chapter, which
 *     tier (or no tier = the all-three-tiers emblem).
 *   - HarmonicUnlock carries requiredChapterId — granted on ADVANCED tier
 *     completion of that chapter (richer harmony is earned through mastery,
 *     not opened on the first tier the player clears).
 *
 * `settleLevelResult` is the piece-1 → piece-2 → piece-3 pipeline in one
 * call: record the level result, then evaluate and grant whatever the
 * completion newly earned.
 */
import type {
  Chapter,
  DifficultyTierId,
  HarmonicUnlock,
  PlayerProgress,
  Reward,
} from "../engine/types/schema.js";
import { hasCompletedLevels } from "./progress.js";
import type { LevelResult } from "./level-flow.js";
import { ProgressStore } from "./progress.js";

export const ALL_TIER_IDS: DifficultyTierId[] = ["beginner", "intermediate", "advanced"];

/** Progress per tier for one player+track, as the rule engine reads it. */
export type ProgressByTier = Partial<Record<DifficultyTierId, PlayerProgress | null>>;

/** True when every level of the chapter is completed in this tier's record. */
export function chapterCompleteAtTier(chapter: Chapter, progress: PlayerProgress | null | undefined): boolean {
  return hasCompletedLevels(
    progress ?? null,
    chapter.levels.map((l) => l.id),
  );
}

export interface EvaluatedGrants {
  rewardIds: string[];
  harmonicUnlockIds: string[];
}

/**
 * Evaluate which rewards and unlocks the player's current chapter progress
 * earns, minus what they already hold. Pure: no store, no clock.
 */
export function evaluateChapterGrants(
  chapter: Chapter,
  rewards: Reward[],
  harmonicUnlocks: HarmonicUnlock[],
  progressByTier: ProgressByTier,
  alreadyEarnedRewardIds: string[],
  alreadyHeldUnlockIds: string[],
): EvaluatedGrants {
  const completeAt = (tierId: DifficultyTierId): boolean =>
    chapterCompleteAtTier(chapter, progressByTier[tierId]);
  const completeAtAll = ALL_TIER_IDS.every(completeAt);
  const completeAtAdvanced = completeAt("advanced");

  const rewardIds = rewards
    .filter((reward) => {
      if (reward.kind !== "badge" || !reward.badge) return false;
      if (reward.badge.chapterId !== chapter.id) return false;
      if (alreadyEarnedRewardIds.includes(reward.id)) return false;
      // The one shared rule: a tier badge needs its tier complete; the
      // tierless badge (pilgrimage emblem) needs all three.
      return reward.badge.tierId ? completeAt(reward.badge.tierId) : completeAtAll;
    })
    .map((r) => r.id);

  const harmonicUnlockIds = harmonicUnlocks
    .filter(
      (u) =>
        u.requiredChapterId === chapter.id &&
        completeAtAdvanced &&
        !alreadyHeldUnlockIds.includes(u.id),
    )
    .map((u) => u.id);

  return { rewardIds, harmonicUnlockIds };
}

export interface SettledLevelResult {
  progress: PlayerProgress;
  newRewardIds: string[];
  newHarmonicUnlockIds: string[];
}

/**
 * The full pipeline for one finished level: fold the result into progress
 * (piece 2), then evaluate and grant badges/unlocks (piece 3). Grants are
 * recorded on the record of the tier whose completion triggered them; the
 * emblem spans tiers, so "does the player hold it" reads across records
 * (ProgressStore.earnedRewardIds).
 */
export function settleLevelResult(
  store: ProgressStore,
  playerId: string,
  result: LevelResult,
  chapter: Chapter,
  rewards: Reward[],
  harmonicUnlocks: HarmonicUnlock[],
): SettledLevelResult {
  let progress = store.recordLevelResult(playerId, result);

  const progressByTier: ProgressByTier = Object.fromEntries(
    ALL_TIER_IDS.map((tierId) => [tierId, store.getProgress(playerId, result.trackId, tierId)]),
  );
  const heldUnlocks = store
    .allForPlayer(playerId)
    .flatMap((r) => r.harmonicUnlockIds)
    .filter((id, i, all) => all.indexOf(id) === i);

  const grants = evaluateChapterGrants(
    chapter,
    rewards,
    harmonicUnlocks,
    progressByTier,
    store.earnedRewardIds(playerId),
    heldUnlocks,
  );

  if (grants.rewardIds.length > 0) {
    progress = store.grantRewards(playerId, result.trackId, result.tierId, grants.rewardIds);
  }
  if (grants.harmonicUnlockIds.length > 0) {
    progress = store.grantHarmonicUnlocks(playerId, result.trackId, result.tierId, grants.harmonicUnlockIds);
  }

  return { progress, newRewardIds: grants.rewardIds, newHarmonicUnlockIds: grants.harmonicUnlockIds };
}
