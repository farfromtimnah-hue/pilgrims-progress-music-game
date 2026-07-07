# Pilgrim's Progress Music Game

An educational music game for church music students. Two learner tracks — **Instrumentalist** and **Singer** — share one world/campaign but use different learning logic.

## Architecture

Everything is **data-driven**: chapters, tracks, difficulty tiers, quiz templates, and rewards load from JSON files in `data/`, never hardcoded into components.

```
src/
  engine/            Shared engine (both tracks)
    types/           Core data schema (TypeScript types)
    audio/           Audio engine — notes always sound in musical context
    world/           Story/map: chapters, levels, campaign structure
    progress/        Player progress tracking
    data/            Data loaders + validation for the JSON content files
  tracks/
    instrumentalist/ Instrumentalist-track learning logic
      note-token/    Three-state note result logic (Correct / Close / Wrong)
      scaffold/      Three-strike scaffold state machine
      quizzes/       Key-signature full-set quiz + recovery flow
    singer/          Singer track (stub — built in a later session)
data/
  chapters/          Chapter/level content
  keys/              Key signatures, enharmonic rules, scale-degree maps
  quiz-templates/    Quiz template definitions
```

## Teaching philosophy (Instrumentalist track)

Students learn **key signature → note-in-key membership → scale-degree numbers → chord function**, in that order. Enharmonic spelling is key-contextual: B♯ and F♭ are *correct* spellings in specific keys, not errors — the engine distinguishes "sounds right" from "spelled right for this key."

## Development

```
npm install
npm test        # unit tests (vitest)
npm run typecheck
```

See `PROGRESS.md` for the build log and session handoff notes.
