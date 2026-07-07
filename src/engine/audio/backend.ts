/**
 * Audio backend interface. The AudioEngine enforces the musical rules
 * (context always active, phrase scheduling, replay); the backend only makes
 * sound. This keeps the engine unit-testable with a silent fake backend and
 * lets the Tone.js implementation stay thin.
 */

export interface VoiceHandle {
  /** Fade out and release this voice. */
  release(fadeSeconds?: number): void;
}

export interface AudioBackend {
  /** Must be called from a user gesture in browsers before any sound. */
  start(): Promise<void>;

  /** Sustain a set of frequencies indefinitely (drone / pad / chord layer). */
  sustain(frequencies: number[], gain: number, timbre: "drone" | "pad" | "chord"): VoiceHandle;

  /** Play one melodic note for a duration, at an offset from now (seconds). */
  playNote(frequency: number, durationSeconds: number, startOffsetSeconds: number, gain: number): void;

  /** Current backend time in seconds (for scheduling). */
  now(): number;
}
