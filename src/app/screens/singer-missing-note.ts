/**
 * Missing-note melodic completion UI: the phrase already played full, then
 * gapped (level-runner routed those effects to audio before this rendered).
 * A Replay button re-fires the full-then-gapped phrase on demand. Each of
 * the three pitch options has a Preview button (plays that pitch filling
 * the gap, in musical context, without submitting) and a Choose button
 * (commits the answer) — picking one triggers the "with your choice"
 * replay and, if wrong, the correct-phrase replay, then the labeled result.
 */
import { display } from "../../engine/i18n/localized-text.js";
import type { ChallengeRuntime, LevelEffect, LevelEvent } from "../../game/level-flow.js";
import type { Challenge } from "../../game/challenges.js";
import type { AppContext } from "../context.js";
import { box, button, paragraph } from "../dom.js";
import { noteDisplayName } from "./shared.js";

export function renderMissingNoteChallenge(
  ctx: AppContext,
  runtime: Extract<ChallengeRuntime, { kind: "missing_note" }>,
  latestEffects: LevelEffect[],
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  const container = box();

  const result = latestEffects.find((e) => e.type === "missing_note" && e.effect.type === "show_result");
  if (result && result.type === "missing_note" && result.effect.type === "show_result") {
    const prefix = result.effect.correct ? (ctx.language === "en" ? "Correct! " : "Certo! ") : ctx.language === "en" ? "Not quite. " : "Quase. ";
    container.appendChild(paragraph(prefix + display(result.effect.label, ctx.language)));
    return container;
  }

  container.appendChild(
    paragraph(
      ctx.language === "en"
        ? "Which note fills the gap? Listen, then choose."
        : "Qual nota preenche o espaço? Escute e escolha.",
    ),
  );
  if (runtime.quiz.phase === "choosing") {
    container.appendChild(
      button(ctx.language === "en" ? "🔁 Replay phrase" : "🔁 Repetir a frase", () =>
        dispatch({ type: "missing_note_event", event: { type: "replay_phrase" } }),
      ),
    );
  }
  return container;
}

export function renderMissingNoteOptions(
  ctx: AppContext,
  challenge: Extract<Challenge, { kind: "missing_note" }>,
  runtime: Extract<ChallengeRuntime, { kind: "missing_note" }>,
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  const row = document.createElement("div");
  if (runtime.quiz.phase !== "choosing") return row;
  for (const option of challenge.question.options) {
    const optionRow = document.createElement("div");
    optionRow.appendChild(
      button(
        ctx.language === "en" ? `🔊 Preview ${noteDisplayName(option.note, ctx.language)}` : `🔊 Ouvir ${noteDisplayName(option.note, ctx.language)}`,
        () => dispatch({ type: "missing_note_event", event: { type: "preview_option", choice: option } }),
      ),
    );
    optionRow.appendChild(
      button(noteDisplayName(option.note, ctx.language), () =>
        dispatch({ type: "missing_note_event", event: { type: "choose_pitch", choice: option } }),
      ),
    );
    row.appendChild(optionRow);
  }
  return row;
}
