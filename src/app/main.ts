/**
 * App entry point — wires the real language gate, track selection, chapter
 * map, level runner, and badge screens together over the real engine
 * singletons (one AudioEngine, one ProgressStore). No mocked data anywhere:
 * every screen reads from loaded content JSON and real PlayerProgress.
 */
import { AudioEngine } from "../engine/audio/audio-engine.js";
import { ToneBackend } from "../engine/audio/tone-backend.js";
import { ensureLanguageSelected } from "../engine/i18n/language-select-screen.js";
import { LocalStorageLanguageBackend } from "../engine/i18n/language-store.js";
import type { Chapter, DifficultyTierId } from "../engine/types/schema.js";
import { buildContext, type AppContext } from "./context.js";
import { loadGameData } from "./data.js";
import { renderBadges } from "./screens/badges.js";
import { renderChapterMap } from "./screens/chapter-map.js";
import { renderLevelRunner } from "./screens/level-runner.js";
import { renderTrackSelect } from "./screens/track-select.js";
import { button, clear, heading } from "./dom.js";

async function main(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) throw new Error("missing #app root");

  const language = await ensureLanguageSelected(new LocalStorageLanguageBackend(), root);
  const data = await loadGameData();

  const audioEngine = new AudioEngine(new ToneBackend());
  let audioStarted = false;
  const ensureAudioStarted = async () => {
    if (!audioStarted) {
      await audioEngine.start();
      audioStarted = true;
    }
  };

  clear(root);
  const startPrompt = document.createElement("div");
  startPrompt.appendChild(heading(2, language === "en" ? "Tap to begin" : "Toque para começar"));
  startPrompt.appendChild(
    button(language === "en" ? "Start" : "Iniciar", async () => {
      await ensureAudioStarted();
      showTrackSelect();
    }),
  );
  root.appendChild(startPrompt);

  function showTrackSelect(): void {
    // Context needs a track before it exists — instrumentalist is the
    // provisional default until the player actually picks one.
    const ctx = buildContext(language, data, audioEngine, "instrumentalist");
    renderTrackSelect(root!, ctx, (trackId) => showChapterMap({ ...ctx, currentTrackId: trackId }));
  }

  function showChapterMap(ctx: AppContext): void {
    renderChapterMap(root!, ctx, ctx.currentTrackId, (chapter, tierId) => showLevel(ctx, chapter, tierId));
    appendNav(ctx, () => showChapterMap(ctx));
  }

  function showLevel(ctx: AppContext, chapter: Chapter, tierId: DifficultyTierId): void {
    renderLevelRunner(root!, ctx, chapter, tierId, () => showChapterMap(ctx));
  }

  function appendNav(ctx: AppContext, onBack: () => void): void {
    const nav = document.createElement("div");
    nav.appendChild(button(ctx.language === "en" ? "Badges" : "Emblemas", () => renderBadges(root!, ctx, onBack)));
    nav.appendChild(
      button(ctx.language === "en" ? "Switch track" : "Trocar trilha", () => {
        renderTrackSelect(root!, ctx, (trackId) => showChapterMap({ ...ctx, currentTrackId: trackId }));
      }),
    );
    root!.appendChild(nav);
  }
}

main().catch((err) => {
  console.error(err);
  const root = document.getElementById("app");
  if (root) root.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
});
