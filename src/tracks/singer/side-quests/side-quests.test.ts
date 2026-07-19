import { describe, expect, it } from "vitest";
import { spelled } from "../../../engine/theory/pitch.js";
import type { SpelledNote } from "../../../engine/types/schema.js";
import { analyzeMotion, isParallel, motionBetween } from "../harmony/motion.js";
import type { MelodyNote } from "../missing-note/melodies.js";
import { betterPathReducer, startBetterPathQuest, type BetterPathQuestion } from "./choose-the-better-path.js";
import type { SideQuestEffect } from "./common.js";
import { echoReducer, startEchoQuest, type EchoQuestion } from "./echo-the-guide.js";
import { expectedResolution, finishReducer, startFinishQuest, type FinishQuestion } from "./finish-the-phrase.js";
import { hiddenCompanionReducer, startHiddenCompanionQuest, type HiddenCompanionQuestion } from "./hidden-companion.js";
import { lanternReducer, startLanternQuest, type LanternQuestion } from "./hold-the-lantern.js";
import { dominantMotion, startWalkingQuest, walkingReducer, type WalkingQuestion } from "./walking-beside-the-melody.js";

const n = (letter: string, octave = 4, beats = 1): MelodyNote => ({
  note: spelled(letter as SpelledNote["letter"]),
  octave,
  beats,
});

function fx<T extends SideQuestEffect["type"]>(effects: SideQuestEffect[], type: T) {
  return effects.filter((e): e is Extract<SideQuestEffect, { type: T }> => e.type === type);
}

// ---------------------------------------------------------------------------
// Motion analysis
// ---------------------------------------------------------------------------

describe("motion analysis", () => {
  it("classifies contrary, oblique, similar, and static motion", () => {
    const from = { a: n("E"), b: n("C") };
    expect(motionBetween(from, { a: n("F"), b: n("B", 3) })).toBe("contrary");
    expect(motionBetween(from, { a: n("F"), b: n("C") })).toBe("oblique");
    expect(motionBetween(from, { a: n("F"), b: n("D") })).toBe("similar");
    expect(motionBetween(from, { a: n("E"), b: n("C") })).toBe("static");
  });

  it("detects parallel motion (same direction, same interval) — the block-harmony sound", () => {
    const from = { a: n("E"), b: n("C") };
    expect(isParallel(from, { a: n("F"), b: n("D") })).toBe(true); // parallel 3rds
    expect(isParallel(from, { a: n("G"), b: n("D") })).toBe(false); // similar but interval changes
  });

  it("profiles a passage and finds the dominant motion", () => {
    const melody = [n("C"), n("D"), n("E"), n("F")];
    const companion = [n("C", 3), n("B", 2), n("A", 2), n("G", 2)]; // always opposite
    const profile = analyzeMotion(melody, companion);
    expect(profile.dominant).toBe("contrary");
    expect(profile.counts.contrary).toBe(3);
    expect(profile.parallelCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Echo the Guide
// ---------------------------------------------------------------------------

describe("Echo the Guide", () => {
  const question: EchoQuestion = { id: "echo-1", phrase: [n("C"), n("D"), n("E"), n("D")] };
  const rightEcho = question.phrase.map((p) => ({ note: p.note, octave: p.octave }));
  const wrongEcho = [...rightEcho.slice(0, 3), { note: spelled("F"), octave: 4 }];

  it("starts with a bilingual prompt and plays the phrase", () => {
    const t = startEchoQuest(question);
    expect(fx(t.effects, "prompt")[0]!.text.en).toContain("sing the phrase back");
    expect(fx(t.effects, "prompt")[0]!.text.pt).toContain("cante a frase");
    expect(fx(t.effects, "play_phrase")).toHaveLength(1);
  });

  it("a correct echo completes successfully", () => {
    const t = echoReducer(startEchoQuest(question).state, { type: "submit_echo", pitches: rightEcho }, question);
    expect(t.state.phase).toBe("complete");
    expect(fx(t.effects, "complete")[0]).toMatchObject({ success: true, mistakes: 0 });
  });

  it("the second failure chunks the phrase into halves", () => {
    let t = echoReducer(startEchoQuest(question).state, { type: "submit_echo", pitches: wrongEcho }, question);
    expect(t.state.phase).toBe("echo_full");
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("escute");

    t = echoReducer(t.state, { type: "submit_echo", pitches: wrongEcho }, question);
    expect(t.state.phase).toBe("echo_first_half");
    expect(fx(t.effects, "retry")[0]!.hint.en).toContain("first half");
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("primeira metade");
    // The chunk played is the first half (2 notes).
    expect(fx(t.effects, "play_phrase")[0]!.phrase).toHaveLength(2);
  });

  it("walks halves back up to the full phrase and succeeds", () => {
    const half1 = rightEcho.slice(0, 2);
    const half2 = rightEcho.slice(2);
    let t = echoReducer(
      { phase: "echo_first_half", failuresOnPhase: 0, totalMistakes: 2 },
      { type: "submit_echo", pitches: half1 },
      question,
    );
    expect(t.state.phase).toBe("echo_second_half");
    t = echoReducer(t.state, { type: "submit_echo", pitches: half2 }, question);
    expect(t.state.phase).toBe("echo_full_again");
    t = echoReducer(t.state, { type: "submit_echo", pitches: rightEcho }, question);
    expect(fx(t.effects, "complete")[0]).toMatchObject({ success: true, mistakes: 2 });
  });

  it("two failures on the final full echo end gently as unsuccessful", () => {
    let t = echoReducer(
      { phase: "echo_full_again", failuresOnPhase: 0, totalMistakes: 2 },
      { type: "submit_echo", pitches: wrongEcho },
      question,
    );
    t = echoReducer(t.state, { type: "submit_echo", pitches: wrongEcho }, question);
    expect(t.state.phase).toBe("complete");
    expect(fx(t.effects, "complete")[0]!.success).toBe(false);
    expect(fx(t.effects, "reveal")[0]!.text.pt.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Hold the Lantern
// ---------------------------------------------------------------------------

describe("Hold the Lantern", () => {
  const question: LanternQuestion = {
    id: "lantern-1",
    target: { note: spelled("C"), octave: 4 },
    melody: [n("E"), n("F"), n("G"), n("E")],
    checkpoints: 4,
    allowedDrifts: 1,
  };
  const onTarget = { type: "checkpoint" as const, pitch: { note: spelled("C"), octave: 4 } };
  const drifted = { type: "checkpoint" as const, pitch: { note: spelled("E"), octave: 4 } };

  it("start gives the pitch, then plays the melody against the held note", () => {
    const t = startLanternQuest(question);
    expect(fx(t.effects, "play_phrase")).toHaveLength(1); // the target pitch alone
    expect(fx(t.effects, "play_duet")).toHaveLength(1);
    expect(fx(t.effects, "prompt")[0]!.text.pt).toContain("lanterna");
  });

  it("steady through all checkpoints succeeds", () => {
    let t = startLanternQuest(question);
    for (let i = 0; i < 4; i++) t = lanternReducer(t.state, onTarget, question);
    expect(t.state.phase).toBe("complete");
    expect(fx(t.effects, "complete")[0]).toMatchObject({ success: true, mistakes: 0 });
  });

  it("a drift earns a bilingual hint; too many drifts fail the quest", () => {
    let t = lanternReducer(startLanternQuest(question).state, drifted, question);
    expect(fx(t.effects, "retry")[0]!.hint.en).toContain("find your note");
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("encontre sua nota");
    t = lanternReducer(t.state, drifted, question);
    t = lanternReducer(t.state, onTarget, question);
    t = lanternReducer(t.state, onTarget, question);
    expect(fx(t.effects, "complete")[0]).toMatchObject({ success: false, mistakes: 2 });
  });
});

// ---------------------------------------------------------------------------
// Choose the Better Path
// ---------------------------------------------------------------------------

describe("Choose the Better Path", () => {
  const question: BetterPathQuestion = {
    id: "path-1",
    melody: [n("E"), n("F"), n("G")],
    lineA: [n("C"), n("D"), n("E")], // parallel shadow
    lineB: [n("C"), n("B", 3), n("C")], // independent line
    better: "b",
    explanation: {
      en: "The second companion takes its own steps.",
      pt: "O segundo companheiro dá os próprios passos.",
    },
  };

  it("start plays both duets after a bilingual prompt", () => {
    const t = startBetterPathQuest(question);
    expect(fx(t.effects, "play_duet")).toHaveLength(2);
    expect(fx(t.effects, "prompt")[0]!.text.en).toContain("which one walks more naturally");
    expect(fx(t.effects, "prompt")[0]!.text.pt).toContain("mais natural");
  });

  it("correct pick completes with the explanation", () => {
    const t = betterPathReducer(startBetterPathQuest(question).state, { type: "choose_path", pick: "b" }, question);
    expect(fx(t.effects, "reveal")[0]!.text.pt).toContain("próprios passos");
    expect(fx(t.effects, "complete")[0]!.success).toBe(true);
  });

  it("first wrong pick re-listens; second reveals and completes unsuccessfully", () => {
    let t = betterPathReducer(startBetterPathQuest(question).state, { type: "choose_path", pick: "a" }, question);
    expect(t.state.phase).toBe("choosing");
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("própri");
    expect(fx(t.effects, "play_duet")).toHaveLength(2);
    t = betterPathReducer(t.state, { type: "choose_path", pick: "a" }, question);
    expect(fx(t.effects, "complete")[0]).toMatchObject({ success: false, mistakes: 2 });
    expect(fx(t.effects, "reveal")).toHaveLength(1);
  });

  it("replay_duet emits just the requested companion's duet without changing phase or counting as a pick", () => {
    const started = startBetterPathQuest(question);
    const t = betterPathReducer(started.state, { type: "replay_duet", which: "a" }, question);
    expect(t.state).toEqual(started.state);
    expect(fx(t.effects, "play_duet")).toHaveLength(1);
    expect(t.effects).toHaveLength(1);

    const tb = betterPathReducer(started.state, { type: "replay_duet", which: "b" }, question);
    expect(fx(tb.effects, "play_duet")).toHaveLength(1);
    expect(tb.state).toEqual(started.state);
  });
});

// ---------------------------------------------------------------------------
// Walking Beside the Melody
// ---------------------------------------------------------------------------

describe("Walking Beside the Melody", () => {
  const question: WalkingQuestion = {
    id: "walk-1",
    melody: [n("C"), n("D"), n("E"), n("F")],
    companion: [n("C", 3), n("B", 2), n("A", 2), n("G", 2)],
  };

  it("computes the dominant motion from the voices (contrary here)", () => {
    expect(dominantMotion(question)).toBe("contrary");
  });

  it("naming the dominant motion succeeds", () => {
    const t = walkingReducer(startWalkingQuest(question).state, { type: "choose_motion", motion: "contrary" }, question);
    expect(fx(t.effects, "complete")[0]!.success).toBe(true);
  });

  it("second wrong answer reveals the motion bilingually with a final listen", () => {
    let t = walkingReducer(startWalkingQuest(question).state, { type: "choose_motion", motion: "similar" }, question);
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("voz de baixo");
    t = walkingReducer(t.state, { type: "choose_motion", motion: "oblique" }, question);
    expect(fx(t.effects, "reveal")[0]!.text.en).toContain("opposite directions");
    expect(fx(t.effects, "reveal")[0]!.text.pt).toContain("direções opostas");
    expect(fx(t.effects, "complete")[0]!.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Finish the Phrase
// ---------------------------------------------------------------------------

describe("Finish the Phrase", () => {
  const question: FinishQuestion = {
    id: "finish-1",
    keyId: "C-major",
    phrase: [n("E"), n("D"), n("C"), n("B", 3)], // ends on ti
    options: [
      { note: spelled("C"), octave: 4 },
      { note: spelled("A"), octave: 3 },
      { note: spelled("G"), octave: 3 },
    ],
  };

  it("derives tendency-tone resolutions: ti→do up, re→do down, fa→mi down", () => {
    expect(expectedResolution({ note: spelled("B"), octave: 3 }, "C-major")).toEqual({
      note: spelled("C"),
      octave: 4,
    });
    expect(expectedResolution({ note: spelled("D"), octave: 4 }, "C-major")).toEqual({
      note: spelled("C"),
      octave: 4,
    });
    expect(expectedResolution({ note: spelled("F"), octave: 4 }, "C-major")).toEqual({
      note: spelled("E"),
      octave: 4,
    });
  });

  it("rejects a phrase ending on a restful degree", () => {
    expect(() => expectedResolution({ note: spelled("C"), octave: 4 }, "C-major")).toThrow(/tendency/);
  });

  it("the right resolution plays the settled phrase and succeeds", () => {
    const t = finishReducer(
      startFinishQuest(question).state,
      { type: "choose_pitch", choice: { note: spelled("C"), octave: 4 } },
      question,
    );
    expect(fx(t.effects, "complete")[0]!.success).toBe(true);
    const played = fx(t.effects, "play_phrase")[0]!.phrase;
    expect(played).toHaveLength(question.phrase.length + 1);
  });

  it("a wrong ending is heard, hinted bilingually, then the reveal settles it", () => {
    let t = finishReducer(
      startFinishQuest(question).state,
      { type: "choose_pitch", choice: { note: spelled("A"), octave: 3 } },
      question,
    );
    expect(t.state.phase).toBe("choosing");
    expect(fx(t.effects, "retry")[0]!.hint.en).toContain("arriving home");
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("chegar em casa");
    t = finishReducer(t.state, { type: "choose_pitch", choice: { note: spelled("G"), octave: 3 } }, question);
    expect(fx(t.effects, "complete")[0]!.success).toBe(false);
    expect(fx(t.effects, "reveal")[0]!.text.pt).toContain("descansa");
  });
});

// ---------------------------------------------------------------------------
// Hidden Companion
// ---------------------------------------------------------------------------

describe("Hidden Companion", () => {
  const companion = [n("C"), n("B", 3), n("C")];
  const question: HiddenCompanionQuestion = {
    id: "hidden-1",
    melody: [n("E"), n("F"), n("E")],
    companion,
    options: [[n("E"), n("D"), n("E")], companion, [n("G"), n("A"), n("G")]],
    companionIndex: 1,
  };

  it("start plays the duet with a bilingual prompt", () => {
    const t = startHiddenCompanionQuest(question);
    expect(fx(t.effects, "play_duet")).toHaveLength(1);
    expect(fx(t.effects, "prompt")[0]!.text.pt).toContain("companheiro oculto");
  });

  it("candidate lines can be auditioned alone before choosing", () => {
    const t = hiddenCompanionReducer(startHiddenCompanionQuest(question).state, { type: "audition_line", index: 2 }, question);
    expect(t.state.phase).toBe("listening");
    expect(fx(t.effects, "play_phrase")).toHaveLength(1);
  });

  it("the right line succeeds and the companion sings alone", () => {
    const t = hiddenCompanionReducer(startHiddenCompanionQuest(question).state, { type: "choose_line", index: 1 }, question);
    expect(fx(t.effects, "complete")[0]!.success).toBe(true);
    expect(fx(t.effects, "reveal")[0]!.text.en).toContain("on their own");
    expect(fx(t.effects, "reveal")[0]!.text.pt).toContain("sozinho");
  });

  it("second wrong pick reveals the companion line and completes unsuccessfully", () => {
    let t = hiddenCompanionReducer(startHiddenCompanionQuest(question).state, { type: "choose_line", index: 0 }, question);
    expect(fx(t.effects, "retry")[0]!.hint.pt).toContain("por baixo da melodia");
    t = hiddenCompanionReducer(t.state, { type: "choose_line", index: 2 }, question);
    expect(fx(t.effects, "complete")[0]!.success).toBe(false);
    expect(fx(t.effects, "play_phrase")).toHaveLength(1);
  });
});
