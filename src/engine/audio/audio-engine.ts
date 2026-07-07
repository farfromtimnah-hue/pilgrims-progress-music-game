/**
 * AudioEngine — the shared engine's musical-context rule lives here:
 *
 *   A note NEVER sounds in isolation. Every note plays against an active
 *   musical context — a tonic drone, a sustained pad, or the currently
 *   active backing chord. If asked to play a note with no context active,
 *   the engine starts a tonic drone for the active key first.
 *
 * Also provides phrase playback and instant replay of the last note/phrase.
 * All Tone.js specifics live behind AudioBackend (see tone-backend.ts).
 */
import type { AudioCue, Key, NoteToken, ScaleDegreeMap } from "../types/schema.js";
import { frequencyOf } from "../theory/pitch.js";
import type { AudioBackend, VoiceHandle } from "./backend.js";

export interface PhraseNote {
  /** Omitted = a rest: the phrase stays silent for `beats` (the context layer keeps sounding). */
  token?: NoteToken;
  /** Duration in beats. */
  beats: number;
}

const DEFAULT_CONTEXT_GAIN = 0.25;
const MELODY_GAIN = 0.8;

export class AudioEngine {
  private activeContext: { cue: AudioCue; voice: VoiceHandle } | null = null;
  private activeKey: Key | null = null;
  private scaleDegrees: ScaleDegreeMap | null = null;
  private lastPlayback: (() => void) | null = null;

  constructor(private readonly backend: AudioBackend) {}

  /** Must be called from a user gesture before any playback. */
  async start(): Promise<void> {
    await this.backend.start();
  }

  /** Set the active key (and its scale-degree map, needed for backing chords). */
  setKey(key: Key, scaleDegrees: ScaleDegreeMap): void {
    this.activeKey = key;
    this.scaleDegrees = scaleDegrees;
    // A context built on the old key is no longer valid.
    if (this.activeContext) {
      this.activeContext.voice.release();
      this.activeContext = null;
    }
  }

  get hasActiveContext(): boolean {
    return this.activeContext !== null;
  }

  /** Start (or replace) the musical context layer from an audio cue. */
  setContext(cue: AudioCue): void {
    if (!this.activeKey) throw new Error("setContext: no active key — call setKey first");
    if (this.activeContext) this.activeContext.voice.release();

    const voice = this.backend.sustain(
      this.contextFrequencies(cue),
      cue.contextGain ?? DEFAULT_CONTEXT_GAIN,
      cue.kind === "backing_chord" ? "chord" : cue.kind === "sustained_pad" ? "pad" : "drone",
    );
    this.activeContext = { cue, voice };
  }

  /** Stop the context layer (e.g. leaving a question). */
  clearContext(): void {
    this.activeContext?.voice.release();
    this.activeContext = null;
  }

  /**
   * Play one note token — always in context. If no context is active, a
   * tonic drone for the active key is started first so the note is never a
   * bare isolated tone.
   */
  playNote(token: NoteToken, durationSeconds = 1): void {
    this.ensureContext();
    this.backend.playNote(frequencyOf(token.note, token.octave), durationSeconds, 0, MELODY_GAIN);
    this.lastPlayback = () => this.playNote(token, durationSeconds);
  }

  /** Play a phrase of note tokens at a tempo, in context. */
  playPhrase(phrase: PhraseNote[], bpm = 80): void {
    this.ensureContext();
    const secondsPerBeat = 60 / bpm;
    let offset = 0;
    for (const { token, beats } of phrase) {
      const duration = beats * secondsPerBeat;
      if (token) {
        this.backend.playNote(frequencyOf(token.note, token.octave), duration * 0.95, offset, MELODY_GAIN);
      }
      offset += duration;
    }
    this.lastPlayback = () => this.playPhrase(phrase, bpm);
  }

  /** Instantly replay the last note or phrase, in the current context. */
  replay(): void {
    this.lastPlayback?.();
  }

  private ensureContext(): void {
    if (this.activeContext) return;
    if (!this.activeKey) throw new Error("playNote: no active key — call setKey first");
    this.setContext({
      id: `auto-drone-${this.activeKey.id}`,
      kind: "tonic_drone",
      keyId: this.activeKey.id,
      contextGain: DEFAULT_CONTEXT_GAIN,
    });
  }

  private contextFrequencies(cue: AudioCue): number[] {
    const key = this.activeKey!;
    switch (cue.kind) {
      case "tonic_drone":
        // Tonic in two octaves — grounding without implying major/minor.
        return [frequencyOf(key.tonic, 2), frequencyOf(key.tonic, 3)];
      case "sustained_pad":
        // Tonic + fifth pad (degrees 1 and 5).
        return this.degreeFrequencies([1, 5], 3);
      case "backing_chord":
        return this.degreeFrequencies(cue.chordDegrees ?? [1, 3, 5], 3);
    }
  }

  private degreeFrequencies(degrees: number[], baseOctave: number): number[] {
    const key = this.activeKey!;
    if (!this.scaleDegrees) {
      return [frequencyOf(key.tonic, baseOctave)];
    }
    const tonicFreq = frequencyOf(key.tonic, baseOctave);
    return degrees.map((d) => {
      const note = this.scaleDegrees!.degrees[(d - 1) % 7];
      if (!note) return tonicFreq;
      let f = frequencyOf(note, baseOctave);
      // Keep chord tones voiced above the tonic within ~one octave.
      while (f < tonicFreq) f *= 2;
      while (f >= tonicFreq * 2) f /= 2;
      return f;
    });
  }
}
