/**
 * Audio routing — interprets level-flow effects against the ONE AudioEngine.
 * Every playback effect the underlying quiz/side-quest modules emit carries
 * PhraseNote[] (or voices of them); this router just hands them to the
 * engine, which enforces the never-a-bare-note context rule itself.
 */
import type { AudioEngine } from "../engine/audio/audio-engine.js";
import { getKey } from "../engine/theory/keys.js";
import type { LevelEffect } from "./level-flow.js";

export function routeEffectToAudio(engine: AudioEngine, effect: LevelEffect, bpm = 80): void {
  switch (effect.type) {
    case "set_key": {
      const built = getKey(effect.keyId);
      engine.setKey(built.key, built.scaleDegreeMap);
      return;
    }
    case "interval": {
      if (effect.effect.type === "play_interval") engine.playPhrase(effect.effect.phrase, bpm);
      return;
    }
    case "missing_note": {
      if (effect.effect.type === "play_phrase") engine.playPhrase(effect.effect.phrase, bpm);
      return;
    }
    case "side_quest": {
      if (effect.effect.type === "play_phrase") engine.playPhrase(effect.effect.phrase, bpm);
      else if (effect.effect.type === "play_duet") engine.playPhrases(effect.effect.voices, bpm);
      return;
    }
    default:
      return; // non-audio effect — the UI layer's concern
  }
}

export function routeEffectsToAudio(engine: AudioEngine, effects: LevelEffect[], bpm = 80): void {
  for (const effect of effects) routeEffectToAudio(engine, effect, bpm);
}
