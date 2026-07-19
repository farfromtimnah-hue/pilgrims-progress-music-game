# PROGRESS

Build log and session handoff notes for the Pilgrim's Progress Music Game.

---

## 2026-07-07 — Piece 1: Project scaffold

**What was built**
- Repo created: `farfromtimnah-hue/pilgrims-progress-music-game` (public, HTTPS remote), matching the Music-Practice setup.
- Folder structure separating shared engine from track-specific code:
  - `src/engine/` — types, audio, world (story/map), progress, data loaders
  - `src/tracks/instrumentalist/` — note-token logic, scaffold state machine, quizzes
  - `src/tracks/singer/` — intentionally an empty stub (later session)
  - `data/` — JSON content: tracks, difficulty tiers, chapters, keys, quiz templates
- TypeScript (strict, ES2022) + Vitest for tests; Tone.js added as the audio dependency (decision documented under piece 3).
- Sample data files (`tracks.json`, `difficulty-tiers.json`, `chapters/chapter-01.json`) proving the data-driven shape: chapters, tracks, tiers, quiz types, and rewards are referenced by ID from data, never baked into code.

**Decisions made that weren't explicit**
- No UI framework or bundler (Vite/React) added yet — this session is engine-only, so the project is a plain TypeScript library with tests. A UI session can add Vite on top without restructuring.
- `data/` lives at the repo root (not inside `src/`) so content editing never touches code, and loaders in `src/engine/data/` are the single entry point for content.
- Difficulty-tier Close-answer policy is expressed in data (`closeAnswerPolicy` field) rather than hardcoded per mode.

**Open questions for Nicole**
- Should chapter/level content eventually be authored in JSON directly, or would you prefer a spreadsheet → JSON export pipeline?
- Confirm the three tier names (Beginner / Intermediate / Advanced) are the terms you use with students.

**Read first next session**
- `README.md` for the architecture map, then `src/engine/types/schema.ts` for the data schema.

---

## 2026-07-07 — Piece 2: Core data schema

**What was built**
- `src/engine/types/schema.ts`: full TypeScript schema covering tracks, difficulty_tiers, chapters, levels, keys, note_tokens, quiz_templates, scaffold_sequences, side_quests, audio_cues, harmonic_unlocks, rewards, player_progress, key_signature_accidentals, enharmonic_rules, and scale_degree_maps.
- Two-axis pitch model at the core: `PitchClass` (0–11, the "sounds right" axis) is separate from `SpelledNote` (letter + accidental, the "spelled right for this key" axis). Every note token carries both, so grading can distinguish enharmonic Close answers from Wrong ones.

**Decisions made that weren't explicit**
- Accidentals support double-sharp/double-flat (`##`/`bb`) so theoretical spellings stay representable even if early chapters never use them.
- `EnharmonicRule` carries its own `teachingPrompt` string per key context, so corrective prompts are content, not code.
- `KeySignatureAccidentals.accidentals` is an *ordered* array (F#–C#–G#… / Bb–Eb–Ab…) so the optional step 4 of the recovery flow (ordering) can be graded from the same data.
- `QuizAttemptRecord` stores per-answer three-state results and strike counts — enough for later analytics on where students stall, without designing an analytics system now.
- `HarmonicUnlock.unlocks` is a bag of id lists (keys, audio cues, chord functions) rather than one polymorphic type — simpler to author in JSON.

**Open questions for Nicole**
- Should minor keys appear from the start, or are early chapters major-only? (Schema supports both.)
- Is "currency" a reward type you actually want, or should rewards stay badge/item/story only?

**Read first next session**
- `src/engine/types/schema.ts` top-of-file comment — it explains the two-axis pitch-spelling model everything else builds on.

---

## 2026-07-07 — Piece 3: Audio engine

**What was built**
- `src/engine/theory/pitch.ts`: shared pitch math — spelled note → pitch class / MIDI / frequency, enharmonic comparison, note naming. Used by both audio and (next piece) grading.
- `src/engine/audio/`:
  - `audio-engine.ts` — `AudioEngine`, which enforces the core rule: **a note never sounds in isolation**. If `playNote` is called with no context active, it auto-starts a tonic drone for the active key. Supports tonic drone, sustained pad (1+5), and backing chord (degrees from the key's scale-degree map) contexts, phrase playback at a tempo, and instant `replay()` of the last note or phrase.
  - `backend.ts` — a small `AudioBackend` interface; the engine's musical rules are unit-tested against a silent fake backend (no browser needed).
  - `tone-backend.ts` — the real Tone.js implementation.
- 13 passing tests, including "auto-drone when no context" and "octave follows the letter: B#3 sounds like C4, Cb4 sounds like B3."

**Audio library decision: Tone.js (over raw Web Audio API)**
Tone.js gives polyphonic synths with proper envelopes, sample-accurate scheduling, and a maintained cross-browser layer. The always-on context requirement means sustained drone/pad/chord layers with clean attack/release fades — hand-rolling that in raw Web Audio means managing oscillator + gain-node lifecycles per voice for no pedagogical gain. Tone.js is isolated behind `AudioBackend`, so swapping to raw Web Audio (or samples) later touches one file.

**Decisions made that weren't explicit**
- Tonic drone voices the tonic in two octaves only (no third), so the drone doesn't pre-answer major/minor questions.
- Backing-chord tones are auto-voiced within one octave above the tonic — keeps data authoring simple (`chordDegrees: [1,3,5]`).
- Scientific-pitch octave convention: the octave belongs to the letter (B♯3 sounds like C4). Tests pin this down since it's the classic enharmonic-octave bug.
- Changing key clears the active context (a C-major drone must not persist into a G-major question).

**Open questions for Nicole**
- Synth timbres are placeholders (sine drone, triangle pad, sawtooth chord). Do you eventually want sampled piano/organ sounds instead? (The backend interface supports swapping without touching game logic.)
- Default phrase tempo is 80 BPM — is that right for your students?

**Read first next session**
- `src/engine/audio/audio-engine.ts` header comment for the context rule, then its test file for the expected behaviors.

---

## 2026-07-07 — Piece 4: Instrumentalist note-token logic + three-strike scaffold

**What was built**
- `src/engine/theory/keys.ts`: key/scale generator — spells any major or natural-minor scale from tonic + mode using the consecutive-letter rule, and derives the key signature (canonical F♯-C♯-G♯… / B♭-E♭-A♭… order), scale-degree map, and circle side. All 15 standard major keys generate correctly, including C♯ major (with E♯, B♯) and C♭ major (with F♭, C♭).
- `src/tracks/instrumentalist/note-token/grade.ts`: three-state grading. **correct** = in key and spelled the key's way; **close** = same sounding pitch, wrong spelling (returns the spelling the key calls for); **wrong** = pitch not in the key. `judgeAnswer` applies the tier policy on Close: Beginner neutral, Intermediate teaching prompt, Advanced counts it as a real mistake only when the chapter's `testsNotationPrecision` flag is set.
- `src/tracks/instrumentalist/scaffold/strike-machine.ts`: three-strike machine as a pure reducer `(state, event) → {state, effects}` — zero UI coupling. Strike 1 = damage + short prompt; strike 2 = pause + smaller diagnostic question; strike 3 = scaffold sequence, then re-entry with strikes cleared.
- 33 new tests (46 total), covering all the enharmonic edge cases: B♯/E♯ correct in C♯ major, C♭/F♭ correct in C♭ major, C natural graded Close in C♯ major with B♯ as the expected spelling, B♯ graded Close (not correct) in C major.

**Decisions made that weren't explicit**
- Keys are *generated* from theory rules rather than hand-authored in JSON — hand-typed accidental tables are where enharmonic bugs come from. Content files reference keys by id (e.g. `"Eb-major"`); `getKey()` resolves them.
- A Close answer that tier policy treats as non-mistake (Beginner/Intermediate) never reaches the strike machine — grading decides *what it was*, policy decides *what it costs*, the machine only counts real mistakes.
- Correct answers clear accumulated strikes (recovery is rewarded); damage applies only on strike 1 — strikes 2 and 3 pause/teach instead of stacking more damage, per the "instructional, not punitive" brief.
- Failing the strike-2 diagnostic escalates straight into the scaffold sequence (the gap is confirmed); passing it resumes at 2 strikes, so the next real mistake scaffolds.
- Minor scales are natural minor for now; harmonic/melodic variants can be added as new `KeyMode`s when chord-function chapters need them.

**Open questions for Nicole**
- Should strikes reset between questions within a level, or persist across the level? (Currently the machine is instantiated per question-context; the caller decides its lifetime.)
- On strike 2, should the diagnostic question always be about the key signature (per the pedagogy order), or vary by quiz topic?

**Read first next session**
- `src/tracks/instrumentalist/note-token/grade.ts` header comment, then `strike-machine.ts` — the two are composed by feeding `judgeAnswer(...).countsAsMistake` into the reducer.

---

## 2026-07-07 — Piece 5: Key-signature quiz (full-set selection + scaffolded recovery)

**What was built**
- `src/tracks/instrumentalist/quizzes/key-signature-quiz.ts`:
  - `gradeFullSet` — full-set selection grading: the answer must contain every accidental in the key and nothing extra, order-insensitive. Reports `missing`, `extras`, and `wrongSpellings` (extras enharmonic to a missing accidental, e.g. G♭ selected where E major needs F♯) so feedback can target the actual misunderstanding.
  - `recoveryReducer` — the scaffolded recovery flow as a pure reducer, in the exact required order: (1) which side of the circle, sharp or flat; (2) how many; (3) select the actual set; (4) optional naming/ordering step. Wrong answers retry the current step with an escalating-hint counter; step hints are content strings emitted as effects, never rendered here.
  - `gradeMainAttempt` — orchestrates: correct set passes, anything else enters recovery at step 1.
- Quiz-template data files (`data/quiz-templates/`) wiring the quiz types into chapter data, including `includeOrderStep` turned on via `tierParams` for Advanced.
- 15 new tests (61 total): exact-set pass in any order, incomplete set fails, over-selection fails, enharmonic wrong-spelling hint at step 3, flat-key walk (A♭ major), C-major short-circuit, ordering step.

**Decisions made that weren't explicit**
- Step 4 (ordering) is data-driven per tier via `tierParams.advanced.includeOrderStep` rather than always-on — Beginner/Intermediate complete recovery at step 3.
- "Side of the circle" accepts a third answer, `none`, so C major / A minor can use the same flow; a correct `none` completes recovery immediately (there is nothing to count or select).
- Step-3 selection reuses `gradeFullSet`, so the enharmonic wrong-spelling detection works inside recovery too, and the hint names the correct spelling for the key.
- Ordering is graded against the canonical accidental order generated in `keys.ts` (F♯ C♯ G♯ D♯ A♯ E♯ B♯ / B♭ E♭ A♭ D♭ G♭ C♭ F♭).
- The recovery flow does not interact with the three-strike machine — recovery *is* the scaffold for this quiz type. If you want a failed main attempt to also feed the strike counter, that's a one-line change in the (future) game loop.

**Open questions for Nicole**
- After completing recovery, should the student re-attempt the same key's full set to "seal" it, or move on? (Currently the flow just reports completion; the caller decides.)
- Should the step-4 ordering task also be its own standalone quiz type for Advanced drills?

**Read first next session**
- `src/tracks/instrumentalist/quizzes/key-signature-quiz.ts` — the header comment explains the full-set rationale and the recovery order.
- Suggested next build: the game-loop layer that composes quiz graders + strike machine + audio engine per level, then Singer-track logic or narrative content.

---

## 2026-07-07 — Bilingual retrofit, Piece 1: LocalizedText + forced language choice

**What was built**
- `src/engine/i18n/localized-text.ts`: `LocalizedText { en, pt }` and `display(text, lang)` — the Directory-app pattern adapted to TypeScript: every user-facing string carries both languages, and the active language is resolved at *read* time, never at data-authoring time. No fallback language.
- `src/engine/i18n/language-store.ts`: language-choice persistence with **no default** — `getStoredLanguage` returns `null` until an explicit EN/PT choice exists, and a corrupt stored value reads as "no choice," never as a default.
- `src/engine/i18n/language-select-screen.ts`: `ensureLanguageSelected(backend, root)` — the one deliberate UI exception in this engine-only project. If no choice is persisted it renders two unstyled buttons ("English" / "Português", each labelled in its own language) and resolves only on a click; game content must `await` it before loading anything.
- 10 new tests (71 total), including "gate does not resolve without a click" and "corrupt value ≠ default." `happy-dom` added as a dev dependency for the one DOM test.

**Decisions made that weren't explicit**
- **Persistence approach**: checked first, per the brief — nothing in this project persists anything yet (`src/engine/progress/` is an empty stub; `PlayerProgress` is schema-only). So there was no existing storage call to copy. The project's established pattern for external concerns is the audio one — `AudioBackend` interface + real `ToneBackend` + silent fake for tests — so language storage mirrors it exactly: `LanguageStorageBackend` interface, `LocalStorageLanguageBackend` (browser `localStorage`, key `ppmg.language`), `InMemoryLanguageBackend` for tests. When player progress gets persisted later it should adopt this same shape.
- The choice-screen button labels are plain strings, not `LocalizedText` — this screen is the one surface shown *before* a language exists, so each option is labelled in its own language.
- `Language` is exactly `"en" | "pt"`; adding a language later means widening the union and letting the compiler point at every `LocalizedText`.

**Open questions for Nicole**
- Should the language choice be changeable later from a settings surface, or is once-per-device fine? (`storeLanguage` supports overwriting; nothing exposes it yet.)

**Read first next session**
- `src/engine/i18n/localized-text.ts` — the header comment states the read-time-resolution rule everything else follows.

---

## 2026-07-07 — Bilingual retrofit, Piece 2: every user-facing string is now LocalizedText

**What was built**
- `src/engine/i18n/note-names.ts`: localized note naming for display text. English keeps letter names (E♭, B♯); Portuguese uses fixed-do solfège (Mi♭, Si♯), the standard in Brazilian music education. Display-only — ids, the schema, and all pitch math stay on letter names.
- `src/engine/types/schema.ts`: every user-facing string field is now `LocalizedText` — `Track.name/description`, `DifficultyTier.name/description`, `Chapter.title`, `SideQuest.title/description`, `Key.displayName`, `EnharmonicRule.teachingPrompt`, `QuizTemplate.title`, `ScaffoldSequence.title`, `Reward.name/description`, `HarmonicUnlock.name`. Ids and enum values stay plain strings.
- `src/engine/theory/keys.ts`: generated `displayName` is now bilingual (e.g. `{ en: "E♭ major", pt: "Mi♭ maior" }`).
- `src/tracks/instrumentalist/note-token/grade.ts`: both feedback messages (wrong-note prompt, Close-answer teaching prompt) build `{ en, pt }` at grading time; `display()` resolves later.
- `src/tracks/instrumentalist/quizzes/key-signature-quiz.ts`: all recovery hints (circle side, count, select-set incl. the enharmonic wrong-spelling hint, ordering mnemonics) are `LocalizedText`; the ordering mnemonics use letter names in EN and solfège in PT.
- All five data JSON files retrofitted to `{ "en": …, "pt": … }` for names/titles/descriptions.
- Strike machine untouched — it emits typed effects only, no user-facing strings. Audio engine and pitch math untouched, per scope.

**Decisions made that weren't explicit**
- **PT note names use fixed-do solfège** (Dó Ré Mi Fá Sol Lá Si) rather than letter names, since that is how Brazilian children are taught note names. Letter names still appear everywhere internal (ids like `"Eb-major"`, schema, tests). ⚠️ This is a pedagogy decision Nicole must confirm — see checklist below.
- "Close" as a grading-state label is rendered "Quase" in tier descriptions — chosen over "Próxima" as more natural for kids ("quase!" = "almost!"). Needs review.
- "Drone" translated as "bordão" (the sustained-tone sense, as in viola caipira drone strings). Needs review — "nota pedal" is the alternative.
- Developer-facing `throw new Error` messages stay English-only; they never reach players.
- Feedback messages are built in both languages at grading time (cheap string interpolation), and the caller resolves with `display()` — exactly the Directory pattern: no language decision is baked into stored/emitted data.

**⚠️ PT strings needing native-speaker review before ship (checklist for Nicole)**
None of the Portuguese below has been reviewed by a native speaker. For a children's education product every one needs sign-off:

*Global / pedagogical decisions first:*
- [ ] **Note names: solfège (Dó, Ré, Mi…) vs letter names (C, D, E…) in PT?** Everything below assumes solfège. If your students read cifra letter names, `src/engine/i18n/note-names.ts` is the one file to change.
- [ ] "tonalidade" for *key* — correct term, but confirm it's what you say with students (vs "tom").
- [ ] "armadura de clave" for *key signature*.
- [ ] "acidentes" for *accidentals*; "sustenidos"/"bemóis" for sharps/flats.
- [ ] "bordão" for *drone* (alternative: "nota pedal") — `grade.ts`.
- [ ] "Quase" as the child-facing word for the Close grading state — `difficulty-tiers.json`.

*Per-file strings:*
- [ ] `data/tracks.json` — "Instrumentista"; "Cantor" (does it need "Cantor(a)"/"Cantora"?); both track descriptions.
- [ ] `data/difficulty-tiers.json` — "Iniciante" / "Intermediário" / "Avançado" + all three descriptions.
- [ ] `data/chapters/chapter-01.json` — placeholder chapter title.
- [ ] `data/quiz-templates/key-signature-full-set.json` — "Selecione todos os acidentes da tonalidade".
- [ ] `data/quiz-templates/note-token-basic.json` — "Escolha as notas que pertencem a esta tonalidade".
- [ ] `grade.ts` wrong-note prompt — "… não está nesta tonalidade. Escute de novo com o bordão."
- [ ] `grade.ts` Close teaching prompt — "… soa certo, mas nesta tonalidade essa altura se escreve …. Confira a armadura de clave." (Is "altura" (pitch) too technical for kids? "essa nota" may read better.)
- [ ] `key-signature-quiz.ts` circle-side hint — "Pense no círculo das quintas: … fica do lado dos sustenidos ou do lado dos bemóis?"
- [ ] `key-signature-quiz.ts` count hint — "… tem sustenidos — conte de novo pelo círculo."
- [ ] `key-signature-quiz.ts` select-set hint — "Você já sabe o lado e a quantidade (…) — agora escolha exatamente esses sustenidos." + enharmonic hint "Cuidado: nesta tonalidade essa altura se escreve …, e não …."
- [ ] `key-signature-quiz.ts` ordering mnemonics — "Os sustenidos entram em quintas: Fá Dó Sol Ré Lá Mi Si." / "Os bemóis entram em quartas: Si Mi Lá Ré Sol Dó Fá."
- [ ] `keys.ts` key display names — "maior"/"menor" with solfège tonic (e.g. "Mi♭ maior").

**Open questions for Nicole**
- The solfège-vs-letters question above is the big one — it decides how notes appear in every PT hint.

**Read first next session**
- `src/engine/i18n/note-names.ts`, then the checklist above.

---

## 2026-07-07 — Bilingual retrofit, Piece 3: bilingual test coverage

**What was built**
- `src/engine/i18n/note-names.test.ts`: pins the PT solfège mapping (all seven syllables, accidental symbols incl. 𝄪/𝄫) and `localizedNoteName` pairs.
- `keys.test.ts`: bilingual display names asserted ("E♭ major" / "Mi♭ maior", "C♯ minor" / "Dó♯ menor").
- `grade.test.ts`: the teaching prompt and the wrong-note prompt are asserted in BOTH languages, with note names localized per language (D♯/E♭ in EN, Ré♯/Mi♭ in PT) and the key vocabulary present ("key signature" / "armadura de clave").
- `key-signature-quiz.test.ts`: the enharmonic wrong-spelling hint asserted in both languages (F♯/G♭ vs Fá♯/Sol♭); new tests that hints name the key per language and that the ordering mnemonics use letters in EN and solfège in PT.
- Full suite: **79 tests, all passing**; typecheck clean. Nothing English-only broke — every pre-existing behavioral test still passes unchanged except where it asserted on string content, which now asserts on `.en` (same expectation) plus `.pt`.

**Decisions made that weren't explicit**
- Tests assert `contains` on the load-bearing words (note names, "armadura de clave") rather than full-sentence equality, so native-speaker wording fixes to the PT strings won't break tests unless they change the musical content.

**Open questions for Nicole**
- None new — the piece-2 PT review checklist is the actionable list.

**Read first next session**
- The piece-2 **PT review checklist** above (unshipped until reviewed), then `src/engine/i18n/localized-text.ts`.
- Suggested next build: Singer track (now safe to build bilingual-first), or the game-loop layer. Any new user-facing string MUST be authored as `LocalizedText` from the start — the schema now enforces it.

---

## 2026-07-07 — Singer piece 1: interval recognition via song references

**What was built**
- `src/engine/theory/intervals.ts` (shared theory, not singer-only): the 13 simple intervals with bilingual names, `semitonesBetween`, `intervalFromSemitones`, and `transposeByInterval` — spelled transposition (letter-step rule) so played intervals keep the same two-axis spelling discipline as the rest of the engine.
- `src/tracks/singer/intervals/song-references.ts`: familiar-song reference content, each entry with bilingual title + cue and an explicit public-domain note. Current set: m2↓ Für Elise, M2↑ Happy Birthday/Parabéns pra Você, m3↑ Brahms' Lullaby, M3↑ When the Saints, P4↑ Amazing Grace, P5↑ Twinkle Twinkle/Brilha Brilha Estrelinha, M6↑ Jingle Bells verse.
- `src/tracks/singer/intervals/interval-quiz.ts`: pure reducer in the house `(state, event) → {state, effects}` pattern. Early mode `song_hint`: interval plays → student picks the matching familiar song → formal name is **revealed** (Beginner) or **asked for** (Intermediate) via `formalNameStep`. Later mode `direct`: no song step — hear it, name it. Playback goes through the ONE audio engine: the `play_interval` effect carries a `PhraseNote[]` for `AudioEngine.playPhrase` (context rule included for free — the interval never sounds bare). Every wrong answer replays the interval.
- 21 new tests (100 total), hints/reveals asserted in BOTH languages.
- `QuizType` extended with `"interval_recognition"`.

**Decisions made that weren't explicit**
- **Interval identity = sounding distance** (semitones), not spelling, because singers grade what they hear; the module header documents that spelling-aware quality (A4 vs d5) can layer on later for notation chapters without changing this.
- Intervals with no confident public-domain reference (m6, m7, M7, tritone, octave, most descending forms) have NO song entry and are **direct-mode-only** — famous references for those (Star Trek m7, "Maria" tritone, "Over the Rainbow" octave) are all still copyrighted, and I would not invent fake familiarity.
- A wrong formal name in song-hint mode hints back to the song the student already matched ("same distance as the start of …") — the song stays the anchor until direct mode removes it.
- Song choices are graded by interval+direction match, so two songs sharing an interval are both correct answers.

**Open questions for Nicole**
- **Song list needs your review hardest of anything here**: which of these melodies do YOUR students/congregation actually know — especially in Brazil? Swap-in suggestions welcome; entries are data in one file.
- Should hymns from your own repertoire replace the secular folk references? (Amazing Grace and When the Saints are already church-adjacent.)

**⚠️ New PT strings for native-speaker review (same checklist standard)**
- [ ] Interval names: "uníssono", "segunda menor/maior", "terça menor/maior", "quarta justa", "trítono", "quinta justa", "sexta menor/maior", "sétima menor/maior", "oitava" — `intervals.ts`.
- [ ] Song titles in PT: "Parabéns pra Você", "Acalanto de Brahms", "Quando os Santos Vêm Marchando", "Graça Maravilhosa (Amazing Grace)" (uncertain — what does your congregation call it?), "Brilha, Brilha, Estrelinha", "Bate o Sino (verso)" (uncertain — is the Brazilian "Bate o Sino" verse melody the same as the Jingle Bells verse? If not, this cue is wrong in PT) — `song-references.ts`.
- [ ] Song cues, e.g. "“Para-BÉNS” — o passo que sobe", "o salto inicial da melodia" — `song-references.ts`.
- [ ] Quiz hints: "Escute de novo e cante o começo de cada música na cabeça — qual delas começa com esse som?"; "Essa não. É a mesma distância do começo de … — escute mais uma vez."; "…a distância é um passo, um salto pequeno ou um salto grande?"; reveal line "Os músicos chamam essa distância de …" — `interval-quiz.ts`.

**Read first next session**
- `src/tracks/singer/intervals/interval-quiz.ts` header comment (the two modes), then `song-references.ts` for the public-domain rule.

---

## 2026-07-07 — Singer piece 2: missing-note melodic completion

**What was built**
- `src/engine/audio/audio-engine.ts`: minimal extension — `PhraseNote.token` is now optional; no token = a rest that keeps time silently (the context layer keeps sounding). This is the ONE audio system growing a feature, not a second one. Test pins that later notes stay on the beat grid across a rest.
- `src/tracks/singer/missing-note/melodies.ts`: four public-domain melodies authored as spelled notes in a home key, each with a bilingual title and an explicit public-domain note: Twinkle Twinkle / Brilha Brilha Estrelinha (1761), Ode to Joy / Hino à Alegria (Beethoven 1824), When the Saints (traditional, pre-1923), Amazing Grace (NEW BRITAIN, 1829).
- `src/tracks/singer/missing-note/missing-note-quiz.ts`: the mechanic as a pure reducer. Flow: full phrase plays → replays with one note gapped (rest) → three pitch options (the answer plus its two scale neighbours by default, via `buildMissingNoteQuestion`) → the phrase replays WITH the student's choice — they hear their answer in context — and if wrong, the correct phrase plays right after (the contrast is the lesson) → result labeled per the question's `labelKind`: scale degree ("scale degree 5 in C major" / "o 5º grau em Dó maior"), solfège (movable-do syllable), or interval ("a perfect 5th up from the note before" / "uma quinta justa acima da nota anterior").
- 15 new tests (115 total); every label kind asserted in both languages.
- `QuizType` extended with `"missing_note_completion"`.

**Decisions made that weren't explicit**
- **"Phrase replays correctly with the choice"** in the spec was ambiguous — replay *the correct phrase* vs *replay with the player's choice*. I implemented: always replay with the player's choice (hearing your own answer in context is the ear-training payoff), and additionally replay the correct phrase when the choice was wrong. If you meant something else, it's a two-line change in `missingNoteReducer`.
- Grading is by **sounding pitch, octave included** — singers answer with their ear, so a right pitch-class in the wrong octave is wrong (they'd sing the wrong note).
- Distractors default to the two **scale neighbours** of the answer (one step up/down in the key) — close enough to require real hearing, diatonic so nothing sounds obviously alien. Options come sorted low→high; shuffling is the UI's job.
- A gap at the start of a phrase labels its interval against the note AFTER it, since there is no note before.
- One choice per question, no retry loop — the mechanic teaches through the replay + label, and repetition comes from more questions, not grinding one. Easy to add a retry mode later if you want it.

**Open questions for Nicole**
- **Movable-do vs fixed-do for the solfège label in PT** — this matters more here than anywhere: PT note names already ARE fixed-do syllables, so the PT solfège label currently says the syllable is "no dó móvel" to keep the systems distinct. If your students don't use movable do, the `solfege` label kind may be redundant in PT (the scale-degree label may be the right default there).
- Melody familiarity: are these four melodies known to your students? Should hymns from your congregation's repertoire be added? (They're data in one file; adding one is ~15 lines.)
- Amazing Grace rhythm is simplified (3/4 feel approximated in beats) — good enough for a gap-hearing exercise, or should it match the hymnal rhythm exactly?

**⚠️ New PT strings for native-speaker review (same checklist standard)**
- [ ] Melody titles: "Hino à Alegria", "Brilha, Brilha, Estrelinha", "Quando os Santos Vêm Marchando", "Graça Maravilhosa (Amazing Grace)" — `melodies.ts`.
- [ ] Result labels: "A nota que faltava era … — o Nº grau em …"; "… — cantada “…” no dó móvel desta tonalidade."; "… — uma … acima/abaixo de a nota anterior/a nota seguinte." (grammar check needed: "acima de a nota" should likely contract to "acima da nota" — currently built by template, flag for wording pass) — `missing-note-quiz.ts`.

**Read first next session**
- `src/tracks/singer/missing-note/missing-note-quiz.ts` header (the five-step flow), then `melodies.ts` for the public-domain rule.

---

## 2026-07-07 — Singer piece 3: six counterpoint-oriented side quests

**What was built**
- `src/engine/audio/audio-engine.ts`: second minimal extension — `playPhrases(voices, bpm)` plays several phrase voices simultaneously (melody + companion line), still in context, still one audio system. `replay()` re-triggers all voices.
- `src/tracks/singer/harmony/motion.ts`: two-voice motion vocabulary shared by piece 3 and (next) piece 4 — `motionBetween` (contrary/oblique/similar/static), `isParallel` (similar motion keeping the same GENERIC/letter interval — so diatonic parallel 3rds count as parallel even when the key alternates major and minor thirds; a test caught the naive same-semitone version being wrong), `analyzeMotion` (per-passage counts + dominant motion).
- `src/tracks/singer/side-quests/` — all six quests as pure reducers in the exact strike-machine pattern (`(state, event) → {state, effects}`, typed effects, zero UI/audio coupling), sharing one `SideQuestEffect` union in `common.ts`:
  - **Echo the Guide** (`echo-the-guide.ts`): hear a phrase, echo it back (pitch sequence, octave included). Failure 1 = replay; failure 2 = chunk into halves, echo each, then the whole. Two failures on the final full echo end gently as unsuccessful with a farewell replay.
  - **Hold the Lantern** (`hold-the-lantern.ts`): hold one pitch while the melody moves. The caller's pitch detection reports checkpoints; the machine counts drifts against `allowedDrifts`, hinting on each drift ("find your note again; it's still there underneath").
  - **Choose the Better Path** (`choose-the-better-path.ts`): hear the melody with harmony line A, then with line B; pick the more natural companion. Which IS better comes from piece 4's judgment at build time — this machine takes `better` + `explanation` as inputs. Wrong pick 1 = hint + both duets again; wrong pick 2 = reveal explanation, unsuccessful.
  - **Walking Beside the Melody** (`walking-beside-the-melody.ts`): name how the companion moves (contrary/oblique/similar), graded against `analyzeMotion`'s dominant motion — the answer is computed from the actual voices, never hand-authored where it could drift from the audio.
  - **Finish the Phrase** (`finish-the-phrase.ts`): a phrase stops on a tendency tone; pick where it wants to go. `expectedResolution` derives the answer from the classic rules (7→1 up, 2→1 down, 4→3 down, 6→5 down) and THROWS on a phrase ending on a restful degree — a content error, not a guess. A wrong ending is played (you hear the un-rest) before the retry.
  - **Hidden Companion** (`hidden-companion.ts`): a duet plays; identify which candidate line was the inner companion. Candidates can be auditioned alone before choosing; success/final reveal plays the companion alone.
- 26 new tests (141 total), all prompts/hints/reveals asserted in both languages.

**Decisions made that weren't explicit**
- All six share the retry discipline from the rest of the game: one hint + re-listen, then a reveal that TEACHES (play the right thing) rather than just "wrong" — instructional, not punitive, matching the strike-machine philosophy without literally reusing it (side quests are one-question experiences; the three-strike machine is for level questions).
- `isParallel` uses generic (letter) intervals, not semitones — see above; this feeds directly into piece 4's block-harmony detection.
- Hold the Lantern grades what the pitch-detection layer REPORTS; microphone/pitch-tracking is a UI-session concern behind the same event boundary as everything else.
- Quest kinds are a `SingerSideQuestKind` union in the track module, not in the engine schema — the schema's `SideQuest` stays track-agnostic and references content by id.

**Open questions for Nicole**
- Hold the Lantern assumes some pitch-detection capability eventually (mic input). If that's out of scope for the app, the same machine works with a "press and hold while singing" honor-system UI — but say which so the UI session builds the right thing.
- Echo the Guide compares exact octave. For mixed voices (kids vs adults singing an octave apart) should octave-equivalent echoes count? One-line change if so.
- The lantern/companion story framing ("hold the lantern", "hidden companion") — does it fit your Pilgrim's Progress chapter narration, or should quest prompts be re-themed?

**⚠️ New PT strings for native-speaker review (same checklist standard)**
- [ ] Echo: "Escute o guia e depois cante a frase de volta, igualzinha." (is "igualzinha" the right register?); "Vamos por partes — cante só a primeira metade."; "Agora a segunda metade."; "Agora a frase inteira."; "Quase — escute mais uma vez."; "Aqui está mais uma vez — vamos repetir esse caminho depois." — `echo-the-guide.ts`.
- [ ] Lantern: "Esta é a sua nota — segure a lanterna firme enquanto a melodia caminha ao seu redor."; "A melodia te levou junto — encontre sua nota de novo; ela continua ali embaixo." — `hold-the-lantern.ts`.
- [ ] Better Path: "Dois companheiros se oferecem para caminhar com a melodia…"; "…o companheiro dá os próprios passos, ou copia cada movimento da melodia?" — `choose-the-better-path.ts`.
- [ ] Walking: motion names "andando em direções opostas" / "uma voz parada enquanto a outra anda" / "andando juntas na mesma direção" / "as duas vozes paradas"; hint "Acompanhe só a voz de baixo com a mão…" — `walking-beside-the-melody.ts`.
- [ ] Finish: "A frase para antes de chegar em casa. Para onde ela quer ir?"; "Isso soou como chegar em casa, ou como parar na porta?"; "É para cá que ela estava se inclinando — ouça como descansa." — `finish-the-phrase.ts`.
- [ ] Hidden Companion: "Alguém está cantando junto, escondido dentro da música…"; "Escute por baixo da melodia — a linha do companheiro é mais discreta, mas tem o próprio desenho."; "Aqui está ele sozinho." — `hidden-companion.ts`.

**Read first next session**
- `src/tracks/singer/side-quests/common.ts` (the shared effect union), then any one quest file — they all follow the same shape.

---

## 2026-07-07 — Singer piece 4: harmony-line naturalness judgment

**What was built**
- `src/tracks/singer/harmony/naturalness.ts`:
  - `assessLine(melody, line)` — scores one candidate harmony line against the melody on four documented concerns, in priority order: **independence** (contrary +2, oblique +1 per step; plain similar neutral), **not-a-shadow** (each parallel step −2, plus a −4 shadow penalty when more than half the steps are parallel — that line has no life of its own), **singability** (line's own leaps: 4th/5th −1, bigger −2), **consonance** (sounding 2nds/7ths/tritone against the melody −2 each).
  - `judgeHarmonyLines(melody, lineA, lineB)` — compares the two assessments. If the margin is below `MARGIN_TOO_CLOSE` (2), the verdict is `"too_close_to_call"` — the engine REFUSES to guess. Otherwise it returns the winner plus a bilingual explanation built from the factors that actually separated the lines (at most two reasons, strongest first — e.g. "the other line copies the melody's every step at the same distance — block harmony").
  - `buildBetterPathQuestion(...)` — the bridge to piece 3's Choose the Better Path quest: judges the lines and THROWS on too-close content, so an un-derivable question can never ship with a silently guessed answer.
- 9 new tests (**150 total, all passing**; typecheck clean): block-parallel vs independent line, shadow detection, dissonance counting, bilingual explanation, symmetry (swapping lines swaps the verdict), the too-close refusal, and the loud throw at question-build time.

**⚠️ JUDGMENT CALLS FOR NICOLE TO REVIEW (this piece is the subjective one)**
The rules implement "natural = moving/independent over block harmony" as stated in the spec, but these specifics were NOT derivable from stated rules and are my judgment:
1. **The weights themselves** (+2 contrary / +1 oblique / −2 parallel step / −4 shadow / −1 & −2 leaps / −2 dissonance). The ORDER of concerns is per your spec; the numbers are pedagogical guesses. They live in one `WEIGHTS` table at the top of `naturalness.ts`.
2. **Plain similar motion scores 0, not negative** — voices moving the same direction with changing intervals is normal, healthy part-singing; only PARALLEL similar motion (same generic interval kept) reads as block harmony. If you'd rather nudge students away from similar motion generally, `similarStep` is the knob.
3. **The perfect 4th is treated as consonant** against the melody. Strict two-voice counterpoint calls it a dissonance; congregational harmony doesn't hear it that way. Flip it by adding 5 to `DISSONANT_CLASSES` if you disagree.
4. **`MARGIN_TOO_CLOSE = 2`** — how different two lines must score before the engine will call one "better." Raise it and more content gets flagged for your hand-authoring; lower it and the engine decides more (and guesses more).
5. **Shadow threshold**: a line is a "shadow" when MORE THAN HALF its steps are parallel. A hymn alto that parallels for 3 of 8 steps is fine; 5 of 8 is a block.
None of these can make the engine call a genuinely ambiguous pair — that case throws at content-build time and lands on your desk by design.

**Decisions made that weren't explicit**
- Explanations are generated from the actual assessment (the factors that separated the lines), not canned per question — so they stay honest when content changes, and they're the same text shown by the Better Path quest on success or reveal.
- Voices must align note-for-note (same note count); rhythmic independence (suspensions, passing tones against held notes) is future work and flagged as such rather than half-modeled.

**⚠️ New PT strings for native-speaker review (same checklist standard)**
- [ ] Explanation fragments: "Esse companheiro é mais natural: …"; "a outra linha copia cada passo da melodia à mesma distância — harmonia em bloco" (is "harmonia em bloco" the term you'd use with students?); "ela dá os próprios passos — andando contra a melodia ou segurando enquanto ela anda"; "ela combina com a melodia em vez de brigar com ela"; "ela anda em passos pequenos, fáceis de cantar"; "ela caminha ao lado da melodia como uma linha própria" — `naturalness.ts`.

**Open questions for Nicole**
- The five judgment calls above, especially the P4 consonance call and the weights.
- Do you want a small hand-authored answer override in content (a `betterOverride` field) for pairs you judge differently from the engine, or should disagreements always be resolved by retuning the weights?

**Read first next session**
- `src/tracks/singer/harmony/naturalness.ts` header comment — it states the four concerns and every judgment call, then `motion.ts` for the parallel-motion definition (generic/letter intervals, not semitones).
- Suggested next build: the game-loop layer composing quiz reducers + strike machine + audio engine per level; or Singer content authoring (interval question sets, harmony-line pairs) once Nicole reviews the song list and judgment calls.

---

## 2026-07-10 — Level flow, Piece 1: the level-flow orchestrator (`src/game/`)

**What was built**
- New `src/game/` layer — the "caller" every pure reducer in `src/tracks` was designed for. It contains NO grading, state-machine, or audio logic; it imports and orchestrates the committed modules.
- `src/game/challenges.ts`:
  - `Challenge` union — the five playable challenge kinds: `note_token`, `key_signature` (instrumentalist), `interval`, `missing_note`, `side_quest` (singer). Each kind points at its owning module.
  - A uniform side-quest adapter (`startSideQuest` / `reduceSideQuest`) over the six real singer reducers, so the orchestrator routes one opaque event stream instead of six type-specific ones.
  - `ChallengeMaterializer` — the hook that turns a level's content refs (quiz template ids / side-quest ids) into concrete challenge instances; `materializeInstrumentalistTemplate` covers the two existing instrumentalist template types from their JSON, and `buildChallengeSequence` walks a level's refs (templates first, then side quests), skipping refs the materializer maps to null (other track's content).
- `src/game/level-flow.ts`: `startLevel(plan)` + `levelFlowReducer(state, event, plan)` — one shared entry point regardless of track. Routes `answer_note` → `judgeAnswer` + `strikeReducer`; `submit_full_set`/`recovery_answer` → `gradeMainAttempt`/`recoveryReducer`; singer events → the real quiz/side-quest reducers. Emits tagged effects (feedback, strike, recovery, playback passthroughs) and finally `level_complete` with a `LevelResult`: outcome (passed/failed/abandoned), strikesUsed, closeCallCount, totalAttempts, enteredScaffoldSequence, and per-challenge `ChallengeResult`s (incl. three-state `answerResults` ready for the progress attempt history).
- `src/game/audio-router.ts`: `routeEffectsToAudio(engine, effects)` — maps forwarded playback effects (`play_interval`, `play_phrase`, `play_duet`, `set_key`) onto the ONE `AudioEngine`.
- 7 integration tests (157 total, all passing; typecheck clean) proving REAL modules end-to-end: an instrumentalist level built from the actual `chapter-01.json` + template JSON (Close answer produces grade.ts's bilingual teaching prompt; wrong answers walk strikes 1→2→3 through the real machine incl. diagnostic and scaffold; failed full-set enters the real recovery flow), and a singer level (real song references, `buildMissingNoteQuestion`, `buildBetterPathQuestion` — naturalness.ts picks the winner), plus the real `AudioEngine` over a silent backend confirming the auto-context rule fires during a level.

**Decisions made that weren't explicit**
- **Pass rule**: a level is passed when every challenge completes successfully. The instrumentalist scaffolding path (strikes, diagnostic, scaffold sequence, key-signature recovery) is instructional, not a gate — working through it still passes; what it cost is recorded. Singer one-shot challenges (missing note, side quests) CAN complete unsuccessfully, which fails the level for that run — replays are cheap and re-completion is piece 2's job.
- **Time vs attempts**: the reducer is pure (no clock), so the result records attempts/mistakes; wall-clock timing, if ever wanted, is the caller's to measure and piece 2 stamps timestamps at persistence time.
- Note-token challenge completes after N correct picks (`requiredCorrect` = half the template's `tokenCount`, since roughly half a mixed token set is in-key); actual token-set generation is content-authoring work for a future session and slots into the materializer.
- Strike/recovery lifetime: one strike machine per note-token challenge, one recovery flow per key-signature challenge — this fixes the piece-4 open question "per question or per level" at per-challenge, revisable in one place (`initialRuntime`).
- Answers submitted while the strike machine is paused (diagnostic/scaffold phases) are ignored, not graded — the pause is real.
- `key_signature` completing via recovery still counts as succeeded (recovery IS the scaffold for that quiz type, per piece 5's notes), with `usedRecovery: true` recorded.

**Open questions for Nicole**
- Should a singer level failed by one unsuccessful side quest be replayable from that challenge, or from the level start? (Currently: the whole level replays; the orchestrator could resume mid-level if you want.)
- Is "half of tokenCount" the right number of correct picks for the note-token quiz, or should the count be its own tier param?

**Read first next session**
- `src/game/level-flow.ts` header comment (the pass rule and what's delegated where), then `challenges.ts` for the materializer hook content sessions will fill.

---

## 2026-07-10 — Level flow, Piece 2: player progress tracking

**What was built**
- `src/game/progress.ts`:
  - `applyLevelResult(existing, playerId, result, timestamp)` — the pure fold from a level-flow `LevelResult` into the schema's `PlayerProgress` entity. One record per (player, track, tier), since the schema carries `trackId`/`tierId` on the record; per-tier completion of the same level lives in separate records, which is exactly what piece 3's emblem check needs. Each `ChallengeResult` becomes a `QuizAttemptRecord` (three-state answerResults, strikesUsed, enteredScaffoldSequence) so the analytics hooks designed in the schema session are actually fed.
  - `ProgressStore` — persistence over a `ProgressStorageBackend` (browser `LocalStorageProgressBackend`, key `ppmg.progress.<playerId>`; `InMemoryProgressBackend` for tests), exactly the pattern language-store established and its header comment promised progress would adopt. Also `grantRewards` / `grantHarmonicUnlocks` (both idempotent) for piece 3, and `earnedRewardIds(playerId)` across all of a player's records.
- 7 tests (164 total, all passing; typecheck clean). The LevelResults in the tests come from actually running the level flow over the real missing-note quiz — not hand-built fixtures.

**Decisions made that weren't explicit**
- **Re-completion semantics**: `completedLevelIds` behaves as a set (replaying a passed tier is a no-op there), `attemptHistory` always appends (it's history — replays enrich it). Nothing is ever removed or rewritten, so prior progress can't be corrupted by replay.
- A **failed or abandoned** run appends attempt records but never touches `completedLevelIds`.
- All of a player's records persist as ONE JSON blob per player (not one key per tier) so a record update is atomic and `allForPlayer` needs no key enumeration.
- Corrupt stored JSON (unparseable or wrong shape) reads as "no progress" — same no-default rule as the language store — and the next write starts clean.
- The store takes an injectable `now()` clock (defaults to `Date.now` ISO); the pure core takes timestamps as parameters, keeping the fold testable and deterministic.
- `applyLevelResult` throws when handed a record whose track/tier doesn't match the result — a mismatched fold is a programming error, not data to merge.

**Open questions for Nicole**
- `keyMastery` (per-key learning/practicing/mastered) is still untouched — what should promote a key from "practicing" to "mastered"? (Suggest: deferred until real chapter content exists to define exposure counts.)
- Is one shared device profile per player id fine for now, or will kids share a tablet enough that profile switching UI needs to come earlier?

**Read first next session**
- `src/game/progress.ts` header comment (record-per-track+tier shape and re-completion semantics).

---

## 2026-07-10 — Level flow, Piece 3: badge & reward assignment

**What was built**
- Schema: `Reward` grew an optional `badge?: BadgeCriteria` field (`shape` crown / lantern_scroll / seal / pilgrimage_emblem, `chapterId`, optional `tierId`) — badge criteria are DATA on the existing rewards entity, not code. No tier ↔ badge mapping is hardcoded anywhere.
- `src/game/rewards.ts`:
  - `evaluateChapterGrants(chapter, rewards, harmonicUnlocks, progressByTier, alreadyEarned, alreadyHeld)` — the one shared, track-agnostic rule engine, keyed by tier completion: a badge with a `tierId` is earned when every level of its chapter is complete at that tier; a badge with NO tier (the pilgrimage emblem) is earned when the chapter is complete at all three tiers. Harmonic unlocks with `requiredChapterId` open on the FIRST tier completion of that chapter. Pure — no store, no clock.
  - `settleLevelResult(store, playerId, result, chapter, rewards, unlocks)` — the piece 1→2→3 pipeline in one call: fold the LevelResult into progress, evaluate grants, and record them (idempotently) on the tier record whose completion triggered them.
- Sample data proving the shape: `data/rewards/chapter-01-rewards.json` (four ch01 badges, bilingual names) and `data/harmonic-unlocks/chapter-01-unlocks.json`.
- 5 tests (169 total, all passing; typecheck clean), including the required full-chapter badge-assignment test: chapter 1's real level played through the real level flow at all three tiers → crown, then lantern/scroll, then seal + emblem together on the third completion; re-completion grants nothing twice; the singer track earns the same badges from the same rules; a failed level earns nothing.

**Decisions made that weren't explicit**
- Tier badges are per **chapter**-at-tier (complete every level of the chapter at that tier), matching "a full pilgrimage emblem for mastering all three on a chapter" — the emblem is the same rule with all three tiers required. If Nicole wants per-LEVEL badges too, that's new criteria data, not new code.
- **Harmonic unlocks open on first tier completion** of their chapter (any tier) — new musical material shouldn't wait for full mastery. One-line change in `evaluateChapterGrants` if the design wants Advanced-gated unlocks.
- Grants are recorded on the progress record of the tier that triggered them; "does the player hold X" reads across records via `ProgressStore.earnedRewardIds`, since the emblem inherently spans tiers.
- The `shape` field is iconography metadata for the future UI; the rule engine keys only on chapterId + tierId presence, so shapes can be re-themed freely in data.
- Badges are track-agnostic by construction (nothing in the engine reads trackId): a singer completing ch01 and an instrumentalist completing ch01 earn the same badge ids. If Nicole wants per-track badge variants later, that's again criteria data.

**Open questions for Nicole**
- Should the pilgrimage emblem require the three tiers on the SAME track (current behavior reads per-track records for the played track), or should a chapter mastered partly on each track ever combine? (Currently: same track only.)
- Do rewards other than badges (items, story beats) also key off tier completion, or off single-level completion? The engine handles badges only until real reward content exists.

**Read first next session**
- `src/game/rewards.ts` header comment, then `data/rewards/chapter-01-rewards.json` for the criteria shape.
- Suggested next build: real chapter/level content authoring (song choices + naturalness weight tuning with Nicole), or the UI session on top of `src/game/` — `settleLevelResult` is the single call a UI needs after a level ends.

---

## 2026-07-10 — Harmonic unlocks now gated on Advanced tier completion

**What changed**
- `src/game/rewards.ts` (`evaluateChapterGrants`): harmonic unlocks with `requiredChapterId` now open only when their chapter is complete at the **Advanced** tier — previously they opened on the FIRST tier completion of the chapter (any tier). This was the exact one-line design lever called out in the Piece 3 entry (`completeAtAny` → `completeAt("advanced")`), plus the header comment.
- `src/game/rewards.test.ts`: the tier-progression test now asserts no unlock on Beginner or Intermediate completion and `unlock-ch01-sustained-pad` arriving with the Advanced seal + emblem. No other tests touched (the pure `evaluateChapterGrants` test already completes all three tiers; storage-layer unlock tests in `progress.test.ts` are grant-mechanics only).

**Why**
- Design decision confirmed by Nicole: richer harmony should be **earned through mastery**, not given early — harmonic unlocks require Advanced tier completion of their chapter, not first-tier completion. Badge criteria (crown/lantern/seal/emblem) are unchanged.

**State**
- 169 tests passing (18 files).

---

## 2026-07-18 — Placeholder UI, first playable build (all screens + Chapter 1 content)

This is the first session with an actual UI. Per the session brief, it is
deliberately visually bare (unstyled boxes, labels, basic layout) — every
screen is logically complete and backed by real engine/game-loop calls, with
zero mocked data or fake progress state. Verified by driving the real app in
a real (headless) browser end-to-end, not just unit tests — see "How this
was verified" below.

**What was built**

*UI tooling*
- Added Vite (`vite.config.ts`, `index.html`, `npm run dev` / `app:build` /
  `app:preview`) on top of the existing plain-TypeScript project, exactly as
  piece 1's PROGRESS.md note predicted ("a UI session can add Vite on top
  without restructuring"). No React/framework — the UI follows the house
  style already set by `language-select-screen.ts`: plain `document.createElement`
  calls, no CSS.
- `data-public/data` is a symlink to the repo-root `/data` directory so the
  existing `fetch`-based `loadJson` loader (untouched) works unchanged in
  dev and production builds — content JSON is served, not bundled, so
  editing a data file doesn't require a rebuild.
- `src/app/` is a new top-level layer (alongside `engine`, `game`, `tracks`)
  containing only UI: DOM helpers (`dom.ts`), the app context threading the
  real engine singletons (`context.ts` — one `AudioEngine`, one
  `ProgressStore`, the chosen language), data loading (`data.ts`), and one
  screen module per concern under `src/app/screens/`.

*Screens (`src/app/screens/`)*
- `track-select.ts` — lists tracks from data, disables any with
  `enabled: false` (none are, now — see below).
- `chapter-map.ts` — one shared map for both tracks (never forked), all 8
  chapters, tier badges read live via `chapterCompleteAtTier` (the same
  function `rewards.ts` uses) against real `ProgressStore` records — no
  hardcoded completion state anywhere.
- `level-runner.ts` — the one screen that plays any level: drives
  `startLevel` / `levelFlowReducer` directly, routes every effect through
  `routeEffectsToAudio` before rendering any grading feedback (audio-then-
  judge order preserved), and dispatches to per-challenge-kind renderers.
  On `level_complete` it calls the real `settleLevelResult` and shows
  whatever badges/unlocks were actually granted.
- `instrumentalist-note-token.ts` — real token buttons (see token-set.ts
  below), each press submits `answer_note` and is graded by the real
  `judgeAnswer`; strike-machine diagnostic/scaffold pauses render their own
  follow-up UI and disable the token buttons while paused.
- `instrumentalist-quiz.ts` — the full-set key-signature quiz as a
  checkbox grid over all 21 candidate spellings (7 letters × {♭, ♮, ♯}) —
  select-all, not four-option multiple choice, per the non-negotiable — plus
  all four recovery steps (circle side → count → select set → order) in
  their required order, each driven by the real `recoveryReducer`.
- `singer-interval.ts` — song-hint and name-choice buttons built from the
  challenge's real `songOptions`/`nameOptions` content, not hardcoded lists.
- `singer-missing-note.ts` — the three real pitch options from
  `buildMissingNoteQuestion`, labeled result on completion.
- `singer-side-quest.ts` — **Echo the Guide** and **Hold the Lantern**
  wired fully (see below); the other four quest kinds render an honest
  "not wired into the UI yet" message rather than a fake pass-through.
- `badges.ts` — reads `ProgressStore.earnedRewardIds` and harmonic-unlock
  ids straight from persisted records, matched against real `Reward` /
  `HarmonicUnlock` data for display text and badge glyph.

*Instrumentalist note-token content generation*
- New `src/tracks/instrumentalist/note-token/token-set.ts`
  (`buildNoteTokenSet`) — the piece-1 level-flow PROGRESS.md note flagged
  actual token-set generation as unbuilt ("content-authoring work for a
  future session and slots into the materializer"); this is that work.
  Deterministic (seeded PRNG) so a level's displayed tokens are stable
  within a session, roughly half in-key / half out-of-key, correctness
  verified against the real `gradeNoteToken`. 5 new tests.

*Chapter 1 real content authoring (`src/content/chapter-01.ts`)*
- Chapter 1 got its real title ("City of Destruction" / "Cidade da
  Destruição") replacing the piece-1 placeholder, and its `keyIds` fixed
  from the never-consumed placeholder `["C", "G", "F"]` to the real,
  resolvable id `["C-major"]` (the chapter's one focus key, per the
  session brief — "at least one key").
- **Instrumentalist**: existing `note-token-basic` / `key-signature-full-set`
  templates now render for real via `token-set.ts` + the existing quiz
  modules — no new data schema needed, this piece was UI + token
  generation.
- **Singer**: authored directly in code (`chapter-01.ts`), following the
  exact pattern the level-flow integration tests already established
  (content data in `song-references.ts` / `melodies.ts`, per-chapter
  question objects built in a chapter module — singer content is not
  generic JSON-templated the way instrumentalist content is, by design of
  the existing materializer):
  - Up/down hearing: ascending M2 (Happy Birthday) and descending m2
    (Für Elise), Beginner reveals the formal name after the song step.
  - A P5-up reference question (Twinkle Twinkle) as the chapter's second
    interval-reference content, Intermediate+ asks for the name.
  - Missing-note completion on Twinkle Twinkle (already-authored public-domain
    melody), gap at note index 2 (the leap from C up to G).
  - **Echo the Guide** and **Hold the Lantern** — the first two of the six
    side quests — wired fully end-to-end with real Chapter 1 phrases in C
    major, as the pattern the remaining four (Choose the Better Path,
    Walking Beside the Melody, Finish the Phrase, Hidden Companion) will
    follow in a later content session. Neither quest has real microphone
    pitch-detection input available yet (out of scope, per
    `hold-the-lantern.ts`'s own header comment), so their UI substitutes an
    honest "press the note you'd sing" button flow over the same
    real reducers — no mocked completion, every press is a genuine event.
  - All Chapter 1 refs materialize through one `materializeChapter01`
    function: instrumentalist refs still resolve via the generic
    `materializeInstrumentalistTemplate`; singer refs resolve to the
    content above. This is the proof pattern for chapters 2–8: a future
    session repeats this file's shape.
  - Chapter 1's single level now carries both tracks' content refs in one
    `Level` (`quizTemplateIds` + `sideQuestIds`), not two levels — the
    materializer already skips refs that resolve to `null` for the current
    track, so one shared level structure serves both tracks without
    forking anything. (This replaced an earlier two-level draft that broke
    the existing chapter-completion tests, which assume one level per
    chapter for chapter 1 — see "Judgment calls" below.)
- `data/tracks.json`: Singer flipped from `enabled: false` to `true` now
  that it has real Chapter 1 content and a working UI.
- `data/chapters/chapter-02.json` … `chapter-08.json` — new placeholder
  chapters (id, real narrative title, `order`, empty `levels: []`) so the
  map screen can render the full 8-chapter road (City of Destruction →
  Evangelist's Road → Slough of Despond → Wicket-Gate → Interpreter's
  House → Hill Difficulty → Palace Beautiful → Final Road) with chapters
  2–8 correctly showing "Not yet authored" and no playable tier buttons.
  **Caution for whoever authors chapter 2+:** an empty `levels: []` reads
  as vacuously "complete at every tier" by `hasCompletedLevels`/
  `chapterCompleteAtTier` (`.every()` over zero levels is `true`) — this is
  harmless today because the UI never offers tier buttons for an empty
  chapter, but the first content session for chapter 2 should add at least
  one real level before anything could touch its badge logic.

*Reward/progress UI*
- Fully wired to `src/game/rewards.ts` and `ProgressStore` — verified live
  (see below) that completing a level grants exactly the real
  `evaluateChapterGrants` output (Chapter 1 Crown on Beginner completion,
  on both tracks, since badges are track-agnostic by design) and persists
  it to `localStorage` such that the chapter map and badges screen
  reflect it after a page-level navigation.

**betterOverride — not built, and here's the actual disagreement check**
The standing rule was: build `betterOverride` only if authoring real
content surfaces a disagreement with `naturalness.ts`'s verdict. This
session's singer content used **Echo the Guide** and **Hold the Lantern**
only (per the "wire the first two side quests" scope) — neither calls
`judgeHarmonyLines` / `buildBetterPathQuestion`, so no naturalness
judgment was exercised against new content this session, and no
disagreement could have surfaced. `betterOverride` stays unbuilt. The next
session that authors **Choose the Better Path** content for Chapter 1 (or
later chapters) is the one that will actually hit this decision point.

**How this was verified**
Beyond the unit/integration test suite, the actual app was driven in a
real headless Chromium browser (Playwright, installed for this session)
against the Vite dev server for both the golden path and real engine
edge cases:
- Language gate → track select → chapter map → full instrumentalist level
  (note-token + key-signature-full-set) → level-complete screen showing
  the real "Chapter 1 Crown" grant → chapter map showing the crown glyph
  persisted → badges screen listing it. Zero console errors throughout.
- Full singer level: interval (song-hint, reveal mode) → missing-note →
  Echo the Guide → Hold the Lantern → level-complete, same Crown badge
  granted on the singer track (proving badges are genuinely track-agnostic
  end-to-end, not just in the pure rule-engine tests). Zero console errors.
- An early test run accidentally exercised a real *wrong* answer path
  (a mis-targeted click) and correctly triggered the strike machine's
  diagnostic pause, disabling the note-token buttons until the diagnostic
  was answered — confirming the UI's disabled-state handling isn't
  cosmetic, it's driven by real `StrikeState.phase`.
- `npx vite build` (production bundle) succeeds: 1009 modules, no errors.

**Judgment calls made that weren't explicit**
- Chapter 1's content lives in one `Level` with both tracks' refs mixed
  together (materializer skips what doesn't apply), not one level per
  track — chosen because the non-negotiable says "both tracks share one
  world/map," and the existing `chapterCompleteAtTier` badge logic keys on
  *every level of the chapter*, so splitting into two levels would have
  required either duplicating levels per track (badges checking the wrong
  track's level) or changing the badge rule engine — out of scope this
  session. This was actually discovered by breaking existing tests
  (`rewards.test.ts`) with an initial two-level draft, then fixing forward.
- The four side quests not wired to real UI this session render an honest
  in-app message rather than being silently omitted from `singer-side-quest.ts`
  — so if content authoring adds them to a chapter's `sideQuestIds` before
  their UI is built, the failure mode is visible in-app, not silent.
- Echo the Guide / Hold the Lantern UI substitutes tap-the-note-you-sang
  buttons for real microphone pitch input, since pitch detection is out of
  scope (flagged as a future UI concern back in the Singer piece 3 entry).
  Every tap is still a real `submit_echo` / `checkpoint` event into the
  real reducer — nothing about quest completion is faked, only the input
  method is a placeholder.
- Player identity: a random UUID is minted once into `localStorage`
  (`ppmg.playerId`) on first launch — there is no login/profile UI yet, so
  "the player" is just whoever has this browser/device, matching the
  progress-store piece's own open question ("one shared device profile per
  player id fine for now").

**Open questions for Nicole**
- Profile switching UI (multiple players on one device) is still
  unaddressed — flagged back in the progress-tracking piece, still true.
- The four side quests without real UI (Choose the Better Path, Walking
  Beside the Melody, Finish the Phrase, Hidden Companion) need their own
  UI pass; Choose the Better Path is also the one most likely to finally
  trigger the `betterOverride` decision once its content is authored.
- Microphone pitch-detection input for Echo the Guide / Hold the Lantern
  is still unbuilt; today's tap-the-note substitute is a reasonable
  placeholder but not what ships.

**What's left for chapters 2–8**
Chapters 2–8 exist in data as placeholders only (title + order, zero
levels) — no content, no keys, no quiz templates, no side quests. To
author chapter 2+ following this session's pattern:
1. Pick the chapter's focus key(s) and add a `Level` with real
   `quizTemplateIds` (instrumentalist — reuse or add quiz-template JSON)
   and singer content (extend a `src/content/chapter-0N.ts` module
   following `chapter-01.ts`'s shape) to the chapter's data file.
2. Add matching reward/harmonic-unlock JSON files
   (`data/rewards/chapter-0N-rewards.json`, etc.) with the four badge
   criteria (crown/lantern-scroll/seal/emblem) — copy chapter 1's shape.
3. If singer content for that chapter uses Choose the Better Path,
   run `judgeHarmonyLines` on the candidate lines during authoring — if it
   throws (too close to call) or its verdict disagrees with your own
   judgment, that's the trigger to finally build `betterOverride`.
4. No UI changes should be needed — every screen already reads chapters,
   templates, rewards, and unlocks from data/content modules, not
   hardcoded per-chapter code.

**State**
- 179 tests passing (20 files), typecheck clean, production Vite build
  succeeds, full app driven end-to-end in a real headless browser with
  zero console errors on both tracks.

---

## 2026-07-19 — Three more side quests wired to UI: Walking Beside the Melody, Finish the Phrase, Hidden Companion

**What was built**
- `src/app/screens/singer-side-quest.ts`: three new UI blocks following the
  exact Echo the Guide / Hold the Lantern pattern established last session —
  each renders real buttons for the quest's real options and dispatches real
  events into the real reducer, no mocked completion.
  - **Walking Beside the Melody**: three motion-name buttons (contrary/
    oblique/similar), labels pulled from the reducer's own `MOTION_NAMES`
    map (imported, not re-typed) so the UI text can never drift from what
    the grader actually means by each name.
  - **Finish the Phrase**: one button per offered pitch option (the real
    `question.options`, including the derived correct resolution).
  - **Hidden Companion**: for each candidate line, an "Audition line N"
    button (dispatches `audition_line`, never completes the quest) plus a
    "Choose line N" button (dispatches `choose_line`).
  - All three needed no new architecture — `play_phrase`/`play_duet` audio
    for these quests already routes through the existing
    `routeEffectsToAudio` at the level-runner layer (built for Echo/Lantern
    last session); this session's UI work was purely: render prompt/retry/
    reveal text (already handled generically at the top of the function) and
    wire buttons to real events.
- `src/content/chapter-01.ts`: real Chapter 1 content for the three quests,
  same C-major world as the existing Echo/Lantern content, each authored so
  the real grading logic (not hand-picked answers) lands on the intended
  correct answer:
  - **Walking**: melody climbs C4-D4-E4-F4 while the companion descends
    C4-B3-A3-G3 — four contrary steps, so `analyzeMotion`'s dominant motion
    is genuinely "contrary" (verified directly against the real
    `dominantMotion` helper before shipping, not asserted by inspection).
  - **Finish the Phrase**: phrase G4-A4-B4 stops on B4 (scale degree 7,
    "ti"), so `expectedResolution`'s classic tendency-tone rule (7→1) really
    does derive C5 as the answer; options offered are C5 (correct) plus A4
    and G4 decoys a step either side.
  - **Hidden Companion**: melody E4-F4-G4-E4 with a real stepwise companion
    line C4-D4-E4-C4 at `companionIndex: 1`, alongside a leaping decoy and a
    static (repeated-note) decoy — chosen to be clearly distinguishable by
    ear (leap vs. step vs. stillness), not near-misses.
  - `materializeChapter01` and `data/chapters/chapter-01.json`'s
    `sideQuestIds` extended so these three actually appear in the real
    Chapter 1 level (was 2 side quests, now 5 — Choose the Better Path is
    the sixth and remains out of scope for this session, handled
    separately).

**Decisions made that weren't explicit**
- Content correctness (which motion is dominant, what the tendency tone
  resolves to, which candidate is the real companion) was verified by
  running the actual engine functions (`analyzeMotion`/`dominantMotion`,
  `expectedResolution`) against the authored notes before committing them,
  not just by eyeballing the music theory — the same discipline
  `finish-the-phrase.ts`'s header comment calls for ("the expected
  resolution comes from the classic tendency-tone rules, not
  hand-authoring, so content stays honest").
- `MOTION_NAMES` is imported directly from `walking-beside-the-melody.ts`
  into the UI file rather than re-authored as parallel button-label strings
  — one bilingual source for what each motion name means, following the
  same avoid-string-duplication discipline as the rest of the UI (reusing
  `noteDisplayName`, etc.).

**How this was verified**
- New `src/app/screens/singer-side-quest.newquests.test.ts` (happy-dom):
  drives the REAL `startLevel`/`levelFlowReducer` orchestrator with each new
  quest as the level's only challenge, renders with the real
  `renderSideQuestChallenge`, clicks real DOM buttons, and asserts the real
  reducer's `complete`/`retry` effects fire and `state.phase` actually
  transitions — not a mocked pass-through. Covers: Walking's correct-pick
  completion, Walking's wrong-pick retry-hint-then-complete path, Finish's
  correct-resolution completion, and Hidden Companion's audition-doesn't-
  complete / choose-does-complete distinction.
- A manual real-browser (Playwright/Chromium) pass hit an unrelated
  pre-existing UI quirk in Echo the Guide's note-picker (a single click
  sometimes double-registers a pick in the DOM when driven immediately after
  a screen transition) that made scripted end-to-end browser clicking
  through the whole level unreliable; this is in code untouched this
  session (Echo the Guide's picker, singer-missing-note.ts's transition),
  not in anything built here, and is flagged below rather than chased down,
  since the happy-dom tests above already exercise the real reducer/UI
  wiring this session was scoped to build.
- Full test suite + typecheck run clean (see State below).

**Open questions for Nicole**
- The Echo the Guide double-click quirk noticed during manual browser
  testing (see above) should get a real investigation in a UI-focused
  session — it didn't block this session's scope but is worth a look before
  the picker ships to real students on real devices.
- Choose the Better Path (the sixth and last side quest) is still unwired —
  a separate concurrent session's scope, not touched here.

**State**
- 183 tests passing (21 files; 179 prior + 4 new), typecheck clean.
