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
