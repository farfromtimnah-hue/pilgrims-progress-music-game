/**
 * Badge / progress display — reads earned rewards straight from
 * ProgressStore.earnedRewardIds (which reads across every persisted
 * PlayerProgress record for the player), matched against the real Reward
 * data for their bilingual name + badge shape. No hardcoded badge state.
 */
import { display } from "../../engine/i18n/localized-text.js";
import type { BadgeShape } from "../../engine/types/schema.js";
import type { AppContext } from "../context.js";
import { box, clear, heading, paragraph } from "../dom.js";

const BADGE_GLYPH: Record<BadgeShape, string> = {
  crown: "♛",
  lantern_scroll: "🏮",
  seal: "🔏",
  pilgrimage_emblem: "✺",
};

export function renderBadges(root: HTMLElement, ctx: AppContext, onBack: () => void): void {
  clear(root);
  const container = document.createElement("div");
  container.dataset["screen"] = "badges";
  container.appendChild(heading(1, ctx.language === "en" ? "Your Badges" : "Seus Emblemas"));

  const earnedIds = ctx.progress.earnedRewardIds(ctx.playerId);
  const earnedBadges = ctx.data.rewards.filter((r) => r.kind === "badge" && earnedIds.includes(r.id));

  if (earnedBadges.length === 0) {
    container.appendChild(
      paragraph(ctx.language === "en" ? "No badges earned yet — play a level!" : "Nenhum emblema ainda — jogue um nível!"),
    );
  }

  for (const reward of earnedBadges) {
    const glyph = reward.badge ? BADGE_GLYPH[reward.badge.shape] : "";
    container.appendChild(box(paragraph(`${glyph} ${display(reward.name, ctx.language)}`), paragraph(display(reward.description, ctx.language))));
  }

  const unlockedIds = new Set(
    ctx.data.tiers.flatMap((tier) =>
      ["instrumentalist", "singer"].flatMap(
        (trackId) => ctx.progress.getProgress(ctx.playerId, trackId as "instrumentalist" | "singer", tier.id)?.harmonicUnlockIds ?? [],
      ),
    ),
  );
  const unlocked = ctx.data.harmonicUnlocks.filter((u) => unlockedIds.has(u.id));
  if (unlocked.length > 0) {
    container.appendChild(heading(2, ctx.language === "en" ? "Harmonic Unlocks" : "Desbloqueios Harmônicos"));
    for (const unlock of unlocked) {
      container.appendChild(box(paragraph(display(unlock.name, ctx.language))));
    }
  }

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.textContent = ctx.language === "en" ? "Back" : "Voltar";
  backButton.addEventListener("click", onBack);
  container.appendChild(backButton);

  root.appendChild(container);
}
