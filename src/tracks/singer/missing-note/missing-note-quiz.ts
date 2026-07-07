/**
 * Missing-note melodic completion — the Singer track's "finish the tune" ear
 * mechanic:
 *
 *   1. a short recognizable phrase plays in full,
 *   2. it replays with ONE note missing (a rest holds its place),
 *   3. the student picks from three pitch options,
 *   4. the phrase replays with their choice filled in — they HEAR the answer —
 *      and if it was wrong, the correct phrase plays after it,
 *   5. the result is labeled with the scale degree, solfège syllable, or
 *      interval name, whichever the question is teaching.
 *
 * Pure reducer, house pattern. All playback effects carry PhraseNote[] for
 * the one AudioEngine's playPhrase (rests supported); no second audio path.
 */
import type { PhraseNote } from "../../../engine/audio/audio-engine.js";
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import { noteNamePt } from "../../../engine/i18n/note-names.js";
import {
  INTERVALS,
  intervalFromSemitones,
  semitonesBetween,
  type PlacedNote,
} from "../../../engine/theory/intervals.js";
import { getKey } from "../../../engine/theory/keys.js";
import { midiOf, noteName, pitchClassOf, sameSpelling } from "../../../engine/theory/pitch.js";
import type { LetterName, NoteToken, SpelledNote } from "../../../engine/types/schema.js";
import { melodyToPhrase, type Melody } from "./melodies.js";

export type ResultLabelKind = "scale_degree" | "solfege" | "interval";

export interface MissingNoteQuestion {
  melody: Melody;
  /** Index into melody.notes of the note removed. */
  gapIndex: number;
  /** Exactly three pitch options, one of them the missing note. */
  options: PlacedNote[];
  /** Which kind of label the reveal teaches. */
  labelKind: ResultLabelKind;
}

// ---------------------------------------------------------------------------
// Phrase builders (fed to AudioEngine.playPhrase by the caller)
// ---------------------------------------------------------------------------

function toToken(note: SpelledNote, octave: number, id: string): NoteToken {
  return { id, note, pitchClass: pitchClassOf(note), octave };
}

export function fullPhrase(melody: Melody): PhraseNote[] {
  return melodyToPhrase(melody.notes, melody.id);
}

/** The phrase with the gap note replaced by a rest of the same length. */
export function gappedPhrase(melody: Melody, gapIndex: number): PhraseNote[] {
  return fullPhrase(melody).map((pn, i) => (i === gapIndex ? { beats: pn.beats } : pn));
}

/** The phrase with the student's chosen pitch filled into the gap. */
export function phraseWithChoice(melody: Melody, gapIndex: number, choice: PlacedNote): PhraseNote[] {
  return fullPhrase(melody).map((pn, i) =>
    i === gapIndex ? { token: toToken(choice.note, choice.octave, `${melody.id}-choice`), beats: pn.beats } : pn,
  );
}

// ---------------------------------------------------------------------------
// Question building — three options: the answer and its two scale neighbours
// ---------------------------------------------------------------------------

const LETTERS: LetterName[] = ["C", "D", "E", "F", "G", "A", "B"];

/** Step one scale degree up or down from a placed in-scale note. */
export function scaleNeighbor(placed: PlacedNote, scale: SpelledNote[], step: 1 | -1): PlacedNote {
  const i = scale.findIndex((s) => sameSpelling(s, placed.note));
  if (i < 0) throw new Error(`Note ${noteName(placed.note)} is not in the scale`);
  const next = scale[(((i + step) % 7) + 7) % 7]!;
  const li = LETTERS.indexOf(placed.note.letter);
  const nli = LETTERS.indexOf(next.letter);
  // Scientific octave increments at C: bump when the letter wraps around B/C.
  const octave = placed.octave + (step === 1 && nli < li ? 1 : step === -1 && nli > li ? -1 : 0);
  return { note: next, octave };
}

/**
 * Build a question with the default option set: the missing note plus its
 * upper and lower scale neighbours, sorted low→high (the UI may shuffle).
 */
export function buildMissingNoteQuestion(
  melody: Melody,
  gapIndex: number,
  labelKind: ResultLabelKind,
): MissingNoteQuestion {
  const gap = melody.notes[gapIndex];
  if (!gap) throw new Error(`gapIndex ${gapIndex} out of range for ${melody.id}`);
  const { scale } = getKey(melody.keyId);
  const correct: PlacedNote = { note: gap.note, octave: gap.octave };
  const options = [scaleNeighbor(correct, scale, -1), correct, scaleNeighbor(correct, scale, 1)].sort(
    (a, b) => midiOf(a.note, a.octave) - midiOf(b.note, b.octave),
  );
  return { melody, gapIndex, options, labelKind };
}

// ---------------------------------------------------------------------------
// Result labeling — scale degree, solfège, or interval, as relevant
// ---------------------------------------------------------------------------

/** Movable-do syllables by scale degree (1–7). */
const MOVABLE_DO = ["do", "re", "mi", "fa", "sol", "la", "ti"] as const;

const ORDINAL_PT = ["1º", "2º", "3º", "4º", "5º", "6º", "7º"] as const;

export function resultLabel(question: MissingNoteQuestion): LocalizedText {
  const { melody, gapIndex, labelKind } = question;
  const gap = melody.notes[gapIndex]!;
  const built = getKey(melody.keyId);
  const degreeIdx = built.scale.findIndex((s) => sameSpelling(s, gap.note));

  const opening = {
    en: `The missing note was ${noteName(gap.note)}`,
    pt: `A nota que faltava era ${noteNamePt(gap.note)}`,
  };

  switch (labelKind) {
    case "scale_degree": {
      if (degreeIdx < 0) throw new Error(`Gap note not in ${melody.keyId} scale`);
      return {
        en: `${opening.en} — scale degree ${degreeIdx + 1} in ${built.key.displayName.en}.`,
        pt: `${opening.pt} — o ${ORDINAL_PT[degreeIdx]} grau em ${built.key.displayName.pt}.`,
      };
    }
    case "solfege": {
      if (degreeIdx < 0) throw new Error(`Gap note not in ${melody.keyId} scale`);
      const syllable = MOVABLE_DO[degreeIdx]!;
      // PT note names already ARE fixed-do solfège; the movable-do syllable is
      // named explicitly so the two systems don't blur. Needs Nicole's review.
      return {
        en: `${opening.en} — sung “${syllable}” in this key.`,
        pt: `${opening.pt} — cantada “${syllable}” no dó móvel desta tonalidade.`,
      };
    }
    case "interval": {
      // Relative to the nearest sounded neighbour: the note before the gap,
      // or the note after when the gap opens the phrase.
      const refIdx = gapIndex > 0 ? gapIndex - 1 : gapIndex + 1;
      const ref = melody.notes[refIdx]!;
      const semis = semitonesBetween({ note: ref.note, octave: ref.octave }, { note: gap.note, octave: gap.octave });
      const intervalId = intervalFromSemitones(semis);
      if (!intervalId) throw new Error(`No simple interval between gap and neighbour in ${melody.id}`);
      const name = INTERVALS[intervalId].name;
      const relation =
        gapIndex > 0
          ? { en: "the note before", pt: "a nota anterior" }
          : { en: "the note after", pt: "a nota seguinte" };
      const direction =
        semis === 0
          ? { en: `the same pitch as ${relation.en}`, pt: `a mesma altura que ${relation.pt}` }
          : semis > 0
            ? { en: `a ${name.en} up from ${relation.en}`, pt: `uma ${name.pt} acima de ${relation.pt}` }
            : { en: `a ${name.en} down from ${relation.en}`, pt: `uma ${name.pt} abaixo de ${relation.pt}` };
      return {
        en: `${opening.en} — ${direction.en}.`,
        pt: `${opening.pt} — ${direction.pt}.`,
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Quiz flow
// ---------------------------------------------------------------------------

export type MissingNotePhase = "choosing" | "complete";

export interface MissingNoteState {
  phase: MissingNotePhase;
}

export type MissingNoteEvent = { type: "choose_pitch"; choice: PlacedNote };

export type MissingNoteEffect =
  | { type: "play_phrase"; which: "full" | "gapped" | "with_choice" | "correct"; phrase: PhraseNote[] }
  | { type: "show_result"; correct: boolean; label: LocalizedText }
  | { type: "complete"; correct: boolean };

export interface MissingNoteTransition {
  state: MissingNoteState;
  effects: MissingNoteEffect[];
}

/** Begin: play the full phrase, then the gapped version. */
export function startMissingNoteQuiz(question: MissingNoteQuestion): MissingNoteTransition {
  return {
    state: { phase: "choosing" },
    effects: [
      { type: "play_phrase", which: "full", phrase: fullPhrase(question.melody) },
      { type: "play_phrase", which: "gapped", phrase: gappedPhrase(question.melody, question.gapIndex) },
    ],
  };
}

export function missingNoteReducer(
  state: MissingNoteState,
  event: MissingNoteEvent,
  question: MissingNoteQuestion,
): MissingNoteTransition {
  if (state.phase !== "choosing" || event.type !== "choose_pitch") return { state, effects: [] };

  const gap = question.melody.notes[question.gapIndex]!;
  // Singers are graded on the sounding pitch they chose, octave included.
  const correct =
    midiOf(event.choice.note, event.choice.octave) === midiOf(gap.note, gap.octave);

  const effects: MissingNoteEffect[] = [
    {
      type: "play_phrase",
      which: "with_choice",
      phrase: phraseWithChoice(question.melody, question.gapIndex, event.choice),
    },
  ];
  if (!correct) {
    // Hear the wrong version, then the right one — the contrast is the lesson.
    effects.push({ type: "play_phrase", which: "correct", phrase: fullPhrase(question.melody) });
  }
  effects.push(
    { type: "show_result", correct, label: resultLabel(question) },
    { type: "complete", correct },
  );

  return { state: { phase: "complete" }, effects };
}
