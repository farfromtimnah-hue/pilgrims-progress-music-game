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
