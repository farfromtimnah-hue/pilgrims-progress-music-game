/**
 * Level runner — the one screen that plays any level, any track, by driving
 * the real level-flow orchestrator (startLevel / levelFlowReducer) and
 * rendering whichever challenge is currently active. No grading or audio
 * logic lives here; every button just dispatches a LevelEvent and re-renders
 * from the resulting state + effects, exactly as the orchestrator's header
 * comment describes for its caller.
 *
 * Audio-then-judge ordering is respected throughout: playback effects are
 * routed to the ONE AudioEngine before any grading feedback is shown, never
 * after.
 */
import { display, type LocalizedText } from "../../engine/i18n/localized-text.js";
import { getKey } from "../../engine/theory/keys.js";
import type { DifficultyTierId, SpelledNote } from "../../engine/types/schema.js";
import type { Chapter } from "../../engine/types/schema.js";
import { routeEffectsToAudio } from "../../game/audio-router.js";
import { buildChallengeSequence, type Challenge } from "../../game/challenges.js";
import {
  levelFlowReducer,
  startLevel,
  type LevelEffect,
  type LevelEvent,
  type LevelFlowState,
  type LevelPlan,
  type LevelResult,
} from "../../game/level-flow.js";
import { settleLevelResult } from "../../game/rewards.js";
import { materializeChapter01 } from "../../content/chapter-01.js";
import { buildNoteTokenSet } from "../../tracks/instrumentalist/note-token/token-set.js";
import type { AppContext } from "../context.js";
import { box, button, clear, heading, paragraph } from "../dom.js";
import { renderKeySignatureChallenge } from "./instrumentalist-quiz.js";
import { renderNoteTokenChallenge } from "./instrumentalist-note-token.js";
import { renderIntervalChallenge, renderIntervalOptions } from "./singer-interval.js";
import { renderMissingNoteChallenge, renderMissingNoteOptions } from "./singer-missing-note.js";
import { renderSideQuestChallenge } from "./singer-side-quest.js";
import { hashSeed } from "./shared.js";

const TOKEN_COUNT_BY_TIER: Record<DifficultyTierId, number> = { beginner: 6, intermediate: 8, advanced: 10 };

function buildPlan(ctx: AppContext, chapter: Chapter, tierId: DifficultyTierId): LevelPlan {
  const level = chapter.levels[0];
  if (!level) throw new Error(`Chapter ${chapter.id} has no levels — not yet authored`);
  const tier = ctx.data.tiers.find((t) => t.id === tierId)!;
  const trackId = ctx.currentTrackId;

  const challenges: Challenge[] =
    chapter.id === "ch01"
      ? buildChallengeSequence(level, (ref) => materializeChapter01(ref, trackId, tierId, ctx.data.templates))
      : [];

  return {
    chapterId: chapter.id,
    levelId: level.id,
    trackId,
    tier,
    testsNotationPrecision: chapter.testsNotationPrecision,
    challenges,
  };
}

export function renderLevelRunner(
  root: HTMLElement,
  ctx: AppContext,
  chapter: Chapter,
  tierId: DifficultyTierId,
  onDone: (result: LevelResult) => void,
): void {
  const plan = buildPlan(ctx, chapter, tierId);
  const started = startLevel(plan);
  let state: LevelFlowState = started.state;

  routeEffectsToAudio(ctx.audio, started.effects);
  renderFrame(root, ctx, plan, state, started.effects, dispatch);

  function dispatch(event: LevelEvent): void {
    const t = levelFlowReducer(state, event, plan);
    state = t.state;
    routeEffectsToAudio(ctx.audio, t.effects);

    const completeEffect = t.effects.find((e) => e.type === "level_complete");
    if (completeEffect && completeEffect.type === "level_complete") {
      const settled = settleLevelResult(
        ctx.progress,
        ctx.playerId,
        completeEffect.result,
        chapter,
        ctx.data.rewards,
        ctx.data.harmonicUnlocks,
      );
      // A quest finishing as the level's last challenge still owes the player
      // its reveal text (e.g. Choose the Better Path's explanation) — carry it
      // onto the completion screen instead of swallowing it with the frame.
      const finalReveals = t.effects.flatMap((e) =>
        e.type === "side_quest" && e.effect.type === "reveal" ? [e.effect.text] : [],
      );
      renderCompletion(root, ctx, completeEffect.result, settled.newRewardIds, settled.newHarmonicUnlockIds, finalReveals, () =>
        onDone(completeEffect.result),
      );
      return;
    }
    renderFrame(root, ctx, plan, state, t.effects, dispatch);
  }
}

function renderCompletion(
  root: HTMLElement,
  ctx: AppContext,
  result: LevelResult,
  newRewardIds: string[],
  newHarmonicUnlockIds: string[],
  finalReveals: LocalizedText[],
  onContinue: () => void,
): void {
  clear(root);
  const container = document.createElement("div");
  container.dataset["screen"] = "level-complete";
  for (const reveal of finalReveals) container.appendChild(paragraph(display(reveal, ctx.language)));
  const outcomeText =
    result.outcome === "passed"
      ? ctx.language === "en"
        ? "Level complete!"
        : "Nível concluído!"
      : ctx.language === "en"
        ? "Not this time — try again."
        : "Não desta vez — tente de novo.";
  container.appendChild(heading(2, outcomeText));
  container.appendChild(
    paragraph(
      ctx.language === "en"
        ? `Attempts: ${result.totalAttempts}, strikes: ${result.strikesUsed}, close calls: ${result.closeCallCount}`
        : `Tentativas: ${result.totalAttempts}, erros: ${result.strikesUsed}, quase: ${result.closeCallCount}`,
    ),
  );
  if (newRewardIds.length > 0) {
    const names = newRewardIds
      .map((id) => ctx.data.rewards.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => !!r)
      .map((r) => display(r.name, ctx.language));
    container.appendChild(paragraph((ctx.language === "en" ? "New badges: " : "Novos emblemas: ") + names.join(", ")));
  }
  if (newHarmonicUnlockIds.length > 0) {
    const names = newHarmonicUnlockIds
      .map((id) => ctx.data.harmonicUnlocks.find((u) => u.id === id))
      .filter((u): u is NonNullable<typeof u> => !!u)
      .map((u) => display(u.name, ctx.language));
    container.appendChild(
      paragraph((ctx.language === "en" ? "New harmonic unlock: " : "Novo desbloqueio harmônico: ") + names.join(", ")),
    );
  }
  container.appendChild(button(ctx.language === "en" ? "Continue" : "Continuar", onContinue));
  root.appendChild(container);
}

function renderFrame(
  root: HTMLElement,
  ctx: AppContext,
  plan: LevelPlan,
  state: LevelFlowState,
  latestEffects: LevelEffect[],
  dispatch: (event: LevelEvent) => void,
): void {
  clear(root);
  const container = document.createElement("div");
  container.dataset["screen"] = "level-runner";
  container.appendChild(
    heading(2, `${display(plan.tier.name, ctx.language)} — ${display(ctx.data.chapters.find((c) => c.id === plan.chapterId)!.title, ctx.language)}`),
  );

  if (state.phase !== "running" || !state.runtime) {
    root.appendChild(container);
    return;
  }
  const challenge = plan.challenges[state.challengeIndex]!;
  container.appendChild(paragraph(`${state.challengeIndex + 1} / ${plan.challenges.length}`));

  const replayButton = button(ctx.language === "en" ? "🔁 Replay sound" : "🔁 Repetir som", () =>
    ctx.audio.replay(),
  );
  container.appendChild(replayButton);

  switch (state.runtime.kind) {
    case "note_token": {
      const built = getKey(challenge.kind === "note_token" ? challenge.keyId : "C-major");
      const tierId = plan.tier.id;
      const tokens = buildNoteTokenSet(built, TOKEN_COUNT_BY_TIER[tierId], hashSeed(plan.levelId + tierId));
      container.appendChild(
        renderNoteTokenChallenge(ctx, tokens, state.runtime, latestEffects, (note: SpelledNote) =>
          dispatch({ type: "answer_note", note }),
        ),
      );
      // Strike-machine paused phases need their own follow-up events.
      if (state.runtime.strike.phase === "diagnostic") {
        container.appendChild(
          box(
            paragraph(ctx.language === "en" ? "Quick check — same key, one note:" : "Verificação rápida — mesma tonalidade, uma nota:"),
            button(ctx.language === "en" ? "I got it right" : "Acertei", () =>
              dispatch({ type: "diagnostic_answered", correct: true }),
            ),
            button(ctx.language === "en" ? "I got it wrong" : "Errei", () =>
              dispatch({ type: "diagnostic_answered", correct: false }),
            ),
          ),
        );
      }
      if (state.runtime.strike.phase === "scaffold") {
        container.appendChild(
          box(
            paragraph(
              ctx.language === "en"
                ? "Scaffold sequence (placeholder mini-lesson) — mark complete to continue."
                : "Sequência de apoio (mini-lição provisória) — marque como concluída para continuar.",
            ),
            button(ctx.language === "en" ? "Done" : "Concluído", () => dispatch({ type: "scaffold_completed" })),
          ),
        );
      }
      break;
    }
    case "key_signature": {
      const keyId = challenge.kind === "key_signature" ? challenge.keyId : "C-major";
      container.appendChild(renderKeySignatureChallenge(ctx, keyId, state.runtime, dispatch));
      break;
    }
    case "interval":
      container.appendChild(renderIntervalChallenge(ctx, state.runtime, latestEffects, dispatch));
      if (challenge.kind === "interval") {
        container.appendChild(renderIntervalOptions(ctx, challenge, state.runtime, dispatch));
      }
      break;
    case "missing_note":
      container.appendChild(renderMissingNoteChallenge(ctx, state.runtime, latestEffects, dispatch));
      if (challenge.kind === "missing_note") {
        container.appendChild(renderMissingNoteOptions(ctx, challenge, state.runtime, dispatch));
      }
      break;
    case "side_quest":
      container.appendChild(
        renderSideQuestChallenge(ctx, challenge.kind === "side_quest" ? challenge.quest : undefined, state.runtime, latestEffects, dispatch),
      );
      break;
  }

  root.appendChild(container);
}

