/**
 * Shared engine entry point. Everything here is track-agnostic:
 * world/campaign structure, audio, progress tracking, and data loading.
 * Track-specific learning logic lives under src/tracks/.
 */
export * from "./types/index.js";
export * from "./data/loaders.js";
export * from "./i18n/localized-text.js";
export * from "./i18n/language-store.js";
export * from "./i18n/language-select-screen.js";
