/**
 * Chapter/level map — one shared world for both tracks (never forked per
 * track). Tier-completion badges (crown / lantern-scroll / seal / full
 * pilgrimage emblem) are read straight from real PlayerProgress records via
 * ProgressStore + the same chapterCompleteAtTier check rewards.ts uses — no
 * hardcoded completion state.
 */
import { display } from "../../engine/i18n/localized-text.js";
import type { BadgeShape, Chapter, DifficultyTierId, TrackId } from "../../engine/types/schema.js";
import { ALL_TIER_IDS, chapterCompleteAtTier } from "../../game/rewards.js";
import type { AppContext } from "../context.js";
import { box, button, clear, heading, paragraph } from "../dom.js";

const BADGE_GLYPH: Record<BadgeShape, string> = {
  crown: "♛",
  lantern_scroll: "🏮",
  seal: "🔏",
  pilgrimage_emblem: "✺",
};

const TIER_SHAPE: Record<DifficultyTierId, BadgeShape> = {
  beginner: "crown",
  intermediate: "lantern_scroll",
  advanced: "seal",
};

function chapterStatusLine(ctx: AppContext, trackId: TrackId, chapter: Chapter): string {
  if (chapter.levels.length === 0) {
    return ctx.language === "en" ? "Not yet authored" : "Ainda não elaborado";
  }
  const glyphs = ALL_TIER_IDS.map((tierId) => {
    const progress = ctx.progress.getProgress(ctx.playerId, trackId, tierId);
    const complete = chapterCompleteAtTier(chapter, progress);
    return complete ? BADGE_GLYPH[TIER_SHAPE[tierId]] : "—";
  });
  const allComplete = ALL_TIER_IDS.every((tierId) =>
    chapterCompleteAtTier(chapter, ctx.progress.getProgress(ctx.playerId, trackId, tierId)),
  );
  if (allComplete) glyphs.push(BADGE_GLYPH.pilgrimage_emblem);
  return glyphs.join(" ");
}

export function renderChapterMap(
  root: HTMLElement,
  ctx: AppContext,
  trackId: TrackId,
  onSelectLevel: (chapter: Chapter, tierId: DifficultyTierId) => void,
): void {
  clear(root);
  const container = document.createElement("div");
  container.dataset["screen"] = "chapter-map";

  container.appendChild(heading(1, ctx.language === "en" ? "The Pilgrim's Road" : "O Caminho do Peregrino"));

  for (const chapter of ctx.data.chapters) {
    const rows = document.createElement("div");
    rows.appendChild(heading(3, `${chapter.order}. ${display(chapter.title, ctx.language)}`));
    rows.appendChild(paragraph(chapterStatusLine(ctx, trackId, chapter)));

    if (chapter.levels.length > 0) {
      for (const tierId of ALL_TIER_IDS) {
        const tier = ctx.data.tiers.find((t) => t.id === tierId)!;
        rows.appendChild(
          button(display(tier.name, ctx.language), () => onSelectLevel(chapter, tierId), {
            "data-chapter": chapter.id,
            "data-tier": tierId,
          }),
        );
      }
    }

    container.appendChild(box(rows));
  }

  root.appendChild(container);
}
