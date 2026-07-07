/**
 * Harmony-line naturalness judgment — given two candidate harmony lines
 * against a melody, decide which is the "more natural" companion.
 *
 * This is the most subjective call in the game, so the reasoning is explicit
 * and the scoring refuses to guess when the rules don't separate the lines.
 *
 * WHAT "NATURAL" MEANS HERE (per the Singer-track goal: natural moving,
 * independent lines over block harmony):
 *
 *   1. INDEPENDENCE — a companion takes its own steps. Contrary motion is
 *      rewarded most, oblique motion (holding while the melody moves) next.
 *      Plain similar motion is neutral: moving the same way sometimes is
 *      normal singing.
 *   2. NOT A SHADOW — parallel motion (similar motion keeping the same
 *      generic interval, e.g. an unbroken chain of 3rds) is the signature of
 *      block harmony and is penalized per step. One or two parallel steps
 *      are a mild cost; a line that is MOSTLY parallel gets an extra
 *      shadow penalty, because that line has no life of its own.
 *   3. SINGABLE — natural lines mostly move by step. Leaps larger than a
 *      3rd cost a little; larger than a 5th cost more (hard to pitch while
 *      someone else sings the tune).
 *   4. CONSONANT — the companion shouldn't fight the melody: sounding
 *      seconds, sevenths, and the tritone against the melody are penalized.
 *      The perfect 4th is treated as consonant here — strict two-voice
 *      counterpoint calls it a dissonance, but in congregational harmony
 *      singing it is unremarkable. (Judgment call, flagged in PROGRESS.md.)
 *
 * The weights below are a pedagogical judgment, not acoustics. They are
 * deliberately coarse; what matters is the ORDER of concerns (independence
 * over everything, then singability, then consonance). If two lines land
 * within MARGIN_TOO_CLOSE of each other, the verdict is "too_close_to_call"
 * and question building fails loudly — content where the answer isn't
 * clearly derivable must be re-authored or hand-answered by Nicole, never
 * silently guessed by the engine.
 */
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import { midiOf } from "../../../engine/theory/pitch.js";
import type { MelodyNote } from "../missing-note/melodies.js";
import type { BetterPathQuestion } from "../side-quests/choose-the-better-path.js";
import { analyzeMotion, isParallel, type MotionProfile } from "./motion.js";

// --- Weights (see header for rationale; every value is a judgment call) ----
const WEIGHTS = {
  contraryStep: 2,
  obliqueStep: 1,
  similarStep: 0,
  staticStep: 0,
  parallelStep: -2,
  /** Extra penalty when more than half the steps are parallel: a shadow. */
  shadowLine: -4,
  /** Line's own leap of a 4th or 5th (6–7 semitones). */
  leap: -1,
  /** Line's own leap larger than a 5th. */
  bigLeap: -2,
  dissonantVertical: -2,
} as const;

/** Verdicts closer than this are not decidable from the rules. */
export const MARGIN_TOO_CLOSE = 2;

/** Interval classes (semitones mod 12) that fight the melody. P4 excluded — see header. */
const DISSONANT_CLASSES = new Set([1, 2, 6, 10, 11]);

export interface LineAssessment {
  score: number;
  motion: MotionProfile;
  parallelSteps: number;
  isShadow: boolean;
  leaps: number;
  bigLeaps: number;
  dissonantVerticals: number;
}

const midi = (n: MelodyNote) => midiOf(n.note, n.octave);

/** Score one candidate line against the melody. Voices must align note-for-note. */
export function assessLine(melody: MelodyNote[], line: MelodyNote[]): LineAssessment {
  const motion = analyzeMotion(melody, line);
  const steps = melody.length - 1;

  let parallelSteps = 0;
  let leaps = 0;
  let bigLeaps = 0;
  for (let i = 1; i < melody.length; i++) {
    const from = { a: melody[i - 1]!, b: line[i - 1]! };
    const to = { a: melody[i]!, b: line[i]! };
    if (isParallel(from, to)) parallelSteps++;
    const leapSize = Math.abs(midi(line[i]!) - midi(line[i - 1]!));
    if (leapSize > 7) bigLeaps++;
    else if (leapSize > 5) leaps++;
  }

  let dissonantVerticals = 0;
  for (let i = 0; i < melody.length; i++) {
    const cls = ((midi(melody[i]!) - midi(line[i]!)) % 12 + 12) % 12;
    if (DISSONANT_CLASSES.has(cls)) dissonantVerticals++;
  }

  const isShadow = parallelSteps > steps / 2;

  const score =
    motion.counts.contrary * WEIGHTS.contraryStep +
    motion.counts.oblique * WEIGHTS.obliqueStep +
    motion.counts.similar * WEIGHTS.similarStep +
    motion.counts.static * WEIGHTS.staticStep +
    parallelSteps * WEIGHTS.parallelStep +
    (isShadow ? WEIGHTS.shadowLine : 0) +
    leaps * WEIGHTS.leap +
    bigLeaps * WEIGHTS.bigLeap +
    dissonantVerticals * WEIGHTS.dissonantVertical;

  return { score, motion, parallelSteps, isShadow, leaps, bigLeaps, dissonantVerticals };
}

export type HarmonyVerdict =
  | { verdict: "a" | "b"; margin: number; a: LineAssessment; b: LineAssessment; explanation: LocalizedText }
  | { verdict: "too_close_to_call"; margin: number; a: LineAssessment; b: LineAssessment };

/** Compare two candidate lines. Refuses to pick when the rules can't separate them. */
export function judgeHarmonyLines(
  melody: MelodyNote[],
  lineA: MelodyNote[],
  lineB: MelodyNote[],
): HarmonyVerdict {
  const a = assessLine(melody, lineA);
  const b = assessLine(melody, lineB);
  const margin = Math.abs(a.score - b.score);
  if (margin < MARGIN_TOO_CLOSE) return { verdict: "too_close_to_call", margin, a, b };

  const verdict = a.score > b.score ? "a" : "b";
  const winner = verdict === "a" ? a : b;
  const loser = verdict === "a" ? b : a;
  return { verdict, margin, a, b, explanation: buildExplanation(winner, loser) };
}

/**
 * Say WHY the winner is more natural, from the factors that actually
 * separated the lines — strongest differentiator first, at most two reasons.
 */
function buildExplanation(winner: LineAssessment, loser: LineAssessment): LocalizedText {
  const reasons: LocalizedText[] = [];

  if (loser.parallelSteps > winner.parallelSteps) {
    reasons.push({
      en: "the other line copies the melody's every step at the same distance — block harmony",
      pt: "a outra linha copia cada passo da melodia à mesma distância — harmonia em bloco",
    });
  }
  const winnerIndependent = winner.motion.counts.contrary + winner.motion.counts.oblique;
  const loserIndependent = loser.motion.counts.contrary + loser.motion.counts.oblique;
  if (winnerIndependent > loserIndependent) {
    reasons.push({
      en: "it takes its own steps — moving against the melody or holding while it moves",
      pt: "ela dá os próprios passos — andando contra a melodia ou segurando enquanto ela anda",
    });
  }
  if (loser.dissonantVerticals > winner.dissonantVerticals) {
    reasons.push({
      en: "it agrees with the melody instead of clashing against it",
      pt: "ela combina com a melodia em vez de brigar com ela",
    });
  }
  if (loser.leaps + loser.bigLeaps > winner.leaps + winner.bigLeaps) {
    reasons.push({
      en: "it moves in small, singable steps",
      pt: "ela anda em passos pequenos, fáceis de cantar",
    });
  }

  const picked = reasons.slice(0, 2);
  if (picked.length === 0) {
    // Scores separated but no single factor did — fall back to the principle.
    picked.push({
      en: "it walks beside the melody as its own line",
      pt: "ela caminha ao lado da melodia como uma linha própria",
    });
  }
  const join = (lang: "en" | "pt") => picked.map((r) => r[lang]).join(lang === "en" ? ", and " : ", e ");
  return {
    en: `This companion is more natural: ${join("en")}.`,
    pt: `Esse companheiro é mais natural: ${join("pt")}.`,
  };
}

/**
 * Build a Choose-the-Better-Path question from content. THROWS when the
 * judgment is too close to call — un-derivable content must be fixed by a
 * human, not shipped with a guessed answer.
 */
export function buildBetterPathQuestion(
  id: string,
  melody: MelodyNote[],
  lineA: MelodyNote[],
  lineB: MelodyNote[],
): BetterPathQuestion {
  const judged = judgeHarmonyLines(melody, lineA, lineB);
  if (judged.verdict === "too_close_to_call") {
    throw new Error(
      `Harmony question "${id}": lines are too close to call (margin ${judged.margin} < ${MARGIN_TOO_CLOSE}). ` +
        `Re-author one line to be clearly more natural, or author the answer by hand.`,
    );
  }
  return {
    id,
    melody,
    lineA,
    lineB,
    better: judged.verdict,
    explanation: judged.explanation,
  };
}
