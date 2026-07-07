/**
 * Familiar-song references for interval hearing — the Singer track teaches
 * intervals from songs students already carry in their ears, then attaches
 * the formal name. Every entry must be clearly public domain (or original);
 * no modern copyrighted material.
 *
 * ⚠️ CONTENT NEEDS NICOLE'S REVIEW: which of these melodies her congregation
 * actually knows (especially in Brazil), and the Portuguese titles — see
 * PROGRESS.md. Intervals with no confident public-domain reference (m6, m7,
 * M7, tritone, octave, descending forms other than m2) are deliberately
 * left without entries: they appear only in the direct-identification mode.
 */
import type { LocalizedText } from "../../../engine/i18n/localized-text.js";
import type { IntervalDirection, IntervalId } from "../../../engine/theory/intervals.js";

export interface SongReference {
  id: string;
  intervalId: IntervalId;
  direction: IntervalDirection;
  title: LocalizedText;
  /** Where in the song the interval lives, e.g. "the first two notes". */
  cue: LocalizedText;
  /** Public-domain justification, developer-facing. */
  publicDomainNote: string;
}

export const SONG_REFERENCES: SongReference[] = [
  {
    id: "ref-m2-desc-fur-elise",
    intervalId: "m2",
    direction: "descending",
    title: { en: "Für Elise", pt: "Für Elise" },
    cue: { en: "the first two notes", pt: "as duas primeiras notas" },
    publicDomainNote: "Beethoven, 1810 — public domain.",
  },
  {
    id: "ref-M2-asc-happy-birthday",
    intervalId: "M2",
    direction: "ascending",
    title: { en: "Happy Birthday", pt: "Parabéns pra Você" },
    cue: { en: "“Happy BIRTH-day” — the step up", pt: "“Para-BÉNS” — o passo que sobe" },
    publicDomainNote: "Melody (Good Morning to All, 1893) public domain; US copyright invalidated 2016.",
  },
  {
    id: "ref-m3-asc-brahms-lullaby",
    intervalId: "m3",
    direction: "ascending",
    title: { en: "Brahms' Lullaby", pt: "Acalanto de Brahms" },
    cue: { en: "the first two different notes", pt: "as duas primeiras notas diferentes" },
    publicDomainNote: "Brahms, 1868 — public domain.",
  },
  {
    id: "ref-M3-asc-when-the-saints",
    intervalId: "M3",
    direction: "ascending",
    title: { en: "When the Saints Go Marching In", pt: "Quando os Santos Vêm Marchando" },
    cue: { en: "“Oh when the…” — the first leap", pt: "as duas primeiras notas" },
    publicDomainNote: "Traditional gospel, pre-1923 — public domain.",
  },
  {
    id: "ref-P4-asc-amazing-grace",
    intervalId: "P4",
    direction: "ascending",
    title: { en: "Amazing Grace", pt: "Graça Maravilhosa (Amazing Grace)" },
    cue: { en: "“A-MA-zing” — the opening leap", pt: "o salto inicial da melodia" },
    publicDomainNote: "Tune NEW BRITAIN, 1829 — public domain.",
  },
  {
    id: "ref-P5-asc-twinkle-twinkle",
    intervalId: "P5",
    direction: "ascending",
    title: { en: "Twinkle, Twinkle, Little Star", pt: "Brilha, Brilha, Estrelinha" },
    cue: { en: "“Twinkle TWIN-kle” — the big jump", pt: "“Brilha BRI-lha” — o salto grande" },
    publicDomainNote: "French melody, 1761 — public domain.",
  },
  {
    id: "ref-M6-asc-jingle-bells-verse",
    intervalId: "M6",
    direction: "ascending",
    title: { en: "Jingle Bells (verse)", pt: "Bate o Sino (verso)" },
    cue: { en: "“DASH-ing through the snow” — the opening leap", pt: "o salto no início do verso" },
    publicDomainNote: "Pierpont, 1857 — public domain (verse, not the chorus unison).",
  },
];

export function songReferenceById(id: string): SongReference | undefined {
  return SONG_REFERENCES.find((r) => r.id === id);
}

/** References matching an interval + direction (the "correct" song choices). */
export function referencesFor(intervalId: IntervalId, direction: IntervalDirection): SongReference[] {
  return SONG_REFERENCES.filter((r) => r.intervalId === intervalId && r.direction === direction);
}

/** Intervals that have at least one song reference — eligible for song-hint mode. */
export function intervalsWithSongReferences(): { intervalId: IntervalId; direction: IntervalDirection }[] {
  const seen = new Set<string>();
  return SONG_REFERENCES.filter((r) => {
    const k = `${r.intervalId}:${r.direction}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((r) => ({ intervalId: r.intervalId, direction: r.direction }));
}
