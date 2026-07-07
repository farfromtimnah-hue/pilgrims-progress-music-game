import { describe, expect, it } from "vitest";
import type { Key, NoteToken, ScaleDegreeMap } from "../types/schema.js";
import { pitchClassOf, spelled } from "../theory/pitch.js";
import type { AudioBackend, VoiceHandle } from "./backend.js";
import { AudioEngine } from "./audio-engine.js";

/** Silent fake backend that records what would have sounded. */
class FakeBackend implements AudioBackend {
  sustains: { frequencies: number[]; timbre: string; released: boolean }[] = [];
  notes: { frequency: number; startOffsetSeconds: number }[] = [];

  async start(): Promise<void> {}

  sustain(frequencies: number[], _gain: number, timbre: "drone" | "pad" | "chord"): VoiceHandle {
    const record = { frequencies, timbre, released: false };
    this.sustains.push(record);
    return { release: () => (record.released = true) };
  }

  playNote(frequency: number, _duration: number, startOffsetSeconds: number): void {
    this.notes.push({ frequency, startOffsetSeconds });
  }

  now(): number {
    return 0;
  }

  get activeSustainCount(): number {
    return this.sustains.filter((s) => !s.released).length;
  }
}

const C_MAJOR: Key = {
  id: "C-major",
  tonic: spelled("C"),
  mode: "major",
  displayName: { en: "C major", pt: "Dó maior" },
  circleSide: "none",
  accidentalCount: 0,
};

const C_MAJOR_DEGREES: ScaleDegreeMap = {
  keyId: "C-major",
  degrees: ["C", "D", "E", "F", "G", "A", "B"].map((l) => spelled(l as never)),
};

function token(letter: "C" | "D" | "E" | "F" | "G" | "A" | "B", octave = 4): NoteToken {
  return { id: `t-${letter}${octave}`, note: spelled(letter), pitchClass: pitchClassOf(spelled(letter)), octave };
}

function makeEngine() {
  const backend = new FakeBackend();
  const engine = new AudioEngine(backend);
  engine.setKey(C_MAJOR, C_MAJOR_DEGREES);
  return { backend, engine };
}

describe("AudioEngine — never plays a note in isolation", () => {
  it("auto-starts a tonic drone if playNote is called with no context", () => {
    const { backend, engine } = makeEngine();
    expect(engine.hasActiveContext).toBe(false);
    engine.playNote(token("E"));
    expect(engine.hasActiveContext).toBe(true);
    expect(backend.activeSustainCount).toBe(1);
    expect(backend.sustains[0]!.timbre).toBe("drone");
    expect(backend.notes).toHaveLength(1);
  });

  it("plays against an explicitly set backing chord without adding a drone", () => {
    const { backend, engine } = makeEngine();
    engine.setContext({ id: "cue1", kind: "backing_chord", keyId: "C-major", chordDegrees: [1, 3, 5], contextGain: 0.3 });
    engine.playNote(token("G"));
    expect(backend.sustains).toHaveLength(1);
    expect(backend.sustains[0]!.timbre).toBe("chord");
    expect(backend.sustains[0]!.frequencies).toHaveLength(3);
  });

  it("replacing the context releases the previous layer", () => {
    const { backend, engine } = makeEngine();
    engine.setContext({ id: "cue1", kind: "tonic_drone", keyId: "C-major", contextGain: 0.25 });
    engine.setContext({ id: "cue2", kind: "sustained_pad", keyId: "C-major", contextGain: 0.25 });
    expect(backend.activeSustainCount).toBe(1);
    expect(backend.sustains[0]!.released).toBe(true);
  });

  it("changing key drops the stale context", () => {
    const { backend, engine } = makeEngine();
    engine.setContext({ id: "cue1", kind: "tonic_drone", keyId: "C-major", contextGain: 0.25 });
    engine.setKey(
      { ...C_MAJOR, id: "G-major", tonic: spelled("G"), displayName: { en: "G major", pt: "Sol maior" }, circleSide: "sharp", accidentalCount: 1 },
      { keyId: "G-major", degrees: ["G", "A", "B", "C", "D", "E"].map((l) => spelled(l as never)).concat([spelled("F", "#")]) },
    );
    expect(engine.hasActiveContext).toBe(false);
    expect(backend.activeSustainCount).toBe(0);
  });
});

describe("AudioEngine — phrases and replay", () => {
  it("schedules phrase notes at successive offsets", () => {
    const { backend, engine } = makeEngine();
    engine.playPhrase(
      [
        { token: token("C"), beats: 1 },
        { token: token("D"), beats: 1 },
        { token: token("E"), beats: 2 },
      ],
      60, // 1 beat = 1 s
    );
    expect(backend.notes.map((n) => n.startOffsetSeconds)).toEqual([0, 1, 2]);
  });

  it("a rest (no token) keeps time silently — later notes stay on the grid", () => {
    const { backend, engine } = makeEngine();
    engine.playPhrase(
      [
        { token: token("C"), beats: 1 },
        { beats: 1 }, // rest
        { token: token("E"), beats: 1 },
      ],
      60,
    );
    expect(backend.notes).toHaveLength(2);
    expect(backend.notes.map((n) => n.startOffsetSeconds)).toEqual([0, 2]);
  });

  it("replay() re-triggers the last phrase", () => {
    const { backend, engine } = makeEngine();
    engine.playPhrase([{ token: token("C"), beats: 1 }]);
    engine.replay();
    expect(backend.notes).toHaveLength(2);
  });

  it("replay() re-triggers the last single note", () => {
    const { backend, engine } = makeEngine();
    engine.playNote(token("A"));
    engine.replay();
    expect(backend.notes).toHaveLength(2);
    expect(backend.notes[0]!.frequency).toBeCloseTo(440);
  });
});
