/**
 * App-wide context: the real engine singletons every screen shares. Built
 * once in main.ts, threaded through screen functions as a parameter —
 * exactly one AudioEngine, one ProgressStore, one language, per the
 * engine's own rules (never a second audio path, never mocked progress).
 */
import { AudioEngine } from "../engine/audio/audio-engine.js";
import type { Language } from "../engine/i18n/localized-text.js";
import type { TrackId } from "../engine/types/schema.js";
import { ProgressStore, LocalStorageProgressBackend } from "../game/progress.js";
import type { GameData } from "./data.js";

export const PLAYER_ID_STORAGE_KEY = "ppmg.playerId";

function ensurePlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_STORAGE_KEY);
  if (existing) return existing;
  const id = `player-${crypto.randomUUID()}`;
  localStorage.setItem(PLAYER_ID_STORAGE_KEY, id);
  return id;
}

export interface AppContext {
  language: Language;
  playerId: string;
  audio: AudioEngine;
  progress: ProgressStore;
  data: GameData;
  /** Set once the player picks a track; the level runner needs it to materialize content. */
  currentTrackId: TrackId;
}

export function buildContext(language: Language, data: GameData, audio: AudioEngine, trackId: TrackId): AppContext {
  return {
    language,
    playerId: ensurePlayerId(),
    audio,
    progress: new ProgressStore(new LocalStorageProgressBackend()),
    data,
    currentTrackId: trackId,
  };
}
