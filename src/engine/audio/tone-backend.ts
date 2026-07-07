/**
 * Tone.js implementation of AudioBackend.
 *
 * Why Tone.js over raw Web Audio (decision recorded in PROGRESS.md piece 3):
 * built-in polyphonic synths with envelopes, sample-accurate scheduling, and
 * a maintained cross-browser layer — we get pads/drones/chords without hand
 * -rolling oscillator + gain-node lifecycles.
 */
import * as Tone from "tone";
import type { AudioBackend, VoiceHandle } from "./backend.js";

function synthFor(timbre: "drone" | "pad" | "chord"): Tone.PolySynth {
  switch (timbre) {
    case "drone":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.8, decay: 0, sustain: 1, release: 1.5 },
      }).toDestination();
    case "pad":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 1.2, decay: 0.3, sustain: 0.8, release: 2 },
      }).toDestination();
    case "chord":
      return new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sawtooth" },
        envelope: { attack: 0.05, decay: 0.4, sustain: 0.6, release: 1 },
      }).toDestination();
  }
}

export class ToneBackend implements AudioBackend {
  private melodySynth: Tone.PolySynth | null = null;

  async start(): Promise<void> {
    await Tone.start();
  }

  sustain(frequencies: number[], gain: number, timbre: "drone" | "pad" | "chord"): VoiceHandle {
    const synth = synthFor(timbre);
    synth.volume.value = Tone.gainToDb(gain);
    synth.triggerAttack(frequencies);
    return {
      release: (fadeSeconds = 1) => {
        synth.releaseAll();
        setTimeout(() => synth.dispose(), (fadeSeconds + 2) * 1000);
      },
    };
  }

  playNote(frequency: number, durationSeconds: number, startOffsetSeconds: number, gain: number): void {
    if (!this.melodySynth) {
      this.melodySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.4 },
      }).toDestination();
    }
    this.melodySynth.volume.value = Tone.gainToDb(gain);
    this.melodySynth.triggerAttackRelease(frequency, durationSeconds, Tone.now() + startOffsetSeconds);
  }

  now(): number {
    return Tone.now();
  }
}
