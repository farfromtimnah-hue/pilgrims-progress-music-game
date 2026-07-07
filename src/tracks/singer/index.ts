/**
 * Singer track — harmony-by-ear learning logic.
 *
 * Shares the world/campaign and the shared engine with the Instrumentalist
 * track but teaches by ear, not by written theory: song-referenced interval
 * hearing, melodic completion, and counterpoint-oriented side quests.
 * Nothing here imports from tracks/instrumentalist.
 */
export const SINGER_TRACK_ID = "singer";

export * from "./intervals/interval-quiz.js";
export * from "./intervals/song-references.js";
export * from "./missing-note/melodies.js";
export * from "./missing-note/missing-note-quiz.js";
export * from "./harmony/motion.js";
export * from "./side-quests/common.js";
export * from "./side-quests/echo-the-guide.js";
export * from "./side-quests/hold-the-lantern.js";
export * from "./side-quests/choose-the-better-path.js";
export * from "./side-quests/walking-beside-the-melody.js";
export * from "./side-quests/finish-the-phrase.js";
export * from "./side-quests/hidden-companion.js";
