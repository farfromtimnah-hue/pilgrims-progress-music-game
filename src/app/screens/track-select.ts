/**
 * Track-selection screen: shown after language choice, before the shared
 * chapter map. Only lists tracks the data marks `enabled` — the Singer track
 * flips on once its content is real (it is, as of this session's Chapter 1
 * authoring), but the flag stays data-driven, not hardcoded here.
 */
import { display } from "../../engine/i18n/localized-text.js";
import type { Track, TrackId } from "../../engine/types/schema.js";
import type { AppContext } from "../context.js";
import { box, clear, heading, paragraph } from "../dom.js";

export function renderTrackSelect(root: HTMLElement, ctx: AppContext, onChoose: (trackId: TrackId) => void): void {
  clear(root);
  const container = document.createElement("div");
  container.dataset["screen"] = "track-select";

  const title = ctx.language === "en" ? "Choose your track" : "Escolha sua trilha";
  container.appendChild(heading(1, title));

  const tracks: Track[] = ctx.data.tracks;
  for (const track of tracks) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !track.enabled;
    button.dataset["track"] = track.id;
    button.textContent = `${display(track.name, ctx.language)}${track.enabled ? "" : " (—)"}`;
    button.addEventListener("click", () => onChoose(track.id));
    container.appendChild(box(button, paragraph(display(track.description, ctx.language))));
  }

  root.appendChild(container);
}
