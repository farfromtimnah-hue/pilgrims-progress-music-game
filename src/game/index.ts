/**
 * Game layer — composes the shared engine with the track modules. This is
 * the "caller" every pure reducer in src/tracks was designed for: level
 * sequencing, progress recording, and reward assignment live here; grading,
 * state machines, and audio stay in the modules that own them.
 */
export * from "./challenges.js";
export * from "./level-flow.js";
export * from "./audio-router.js";
export * from "./progress.js";
