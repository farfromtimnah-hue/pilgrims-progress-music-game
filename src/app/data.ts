/**
 * App-level data loading — the one place the UI layer turns content JSON
 * into typed engine entities. Uses the existing loadJson (fetch-based)
 * loader; nothing here is hardcoded game state, only file paths.
 */
import { loadJson } from "../engine/data/loaders.js";
import type {
  Chapter,
  DifficultyTier,
  HarmonicUnlock,
  QuizTemplate,
  Reward,
  Track,
} from "../engine/types/schema.js";

const CHAPTER_IDS = ["01", "02", "03", "04", "05", "06", "07", "08"] as const;

export interface GameData {
  tracks: Track[];
  tiers: DifficultyTier[];
  chapters: Chapter[];
  templates: Record<string, QuizTemplate>;
  rewards: Reward[];
  harmonicUnlocks: HarmonicUnlock[];
}

export async function loadGameData(): Promise<GameData> {
  const [tracksFile, tiersFile, chapters, noteTokenTemplate, keySignatureTemplate, rewardsFile, unlocksFile] =
    await Promise.all([
      loadJson<{ tracks: Track[] }>("/data/tracks.json"),
      loadJson<{ tiers: DifficultyTier[] }>("/data/difficulty-tiers.json"),
      Promise.all(CHAPTER_IDS.map((id) => loadJson<Chapter>(`/data/chapters/chapter-${id}.json`))),
      loadJson<QuizTemplate>("/data/quiz-templates/note-token-basic.json"),
      loadJson<QuizTemplate>("/data/quiz-templates/key-signature-full-set.json"),
      loadJson<{ rewards: Reward[] }>("/data/rewards/chapter-01-rewards.json"),
      loadJson<{ harmonicUnlocks: HarmonicUnlock[] }>("/data/harmonic-unlocks/chapter-01-unlocks.json"),
    ]);

  return {
    tracks: tracksFile.tracks,
    tiers: tiersFile.tiers,
    chapters: chapters.sort((a, b) => a.order - b.order),
    templates: {
      [noteTokenTemplate.id]: noteTokenTemplate,
      [keySignatureTemplate.id]: keySignatureTemplate,
    },
    rewards: rewardsFile.rewards,
    harmonicUnlocks: unlocksFile.harmonicUnlocks,
  };
}
