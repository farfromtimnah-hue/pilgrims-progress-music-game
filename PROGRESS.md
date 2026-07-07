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
