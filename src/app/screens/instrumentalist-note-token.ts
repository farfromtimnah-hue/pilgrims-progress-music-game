/**
 * Note-token challenge UI: pick notes that belong to the key. Every token is
 * a real button graded through judgeAnswer (via level-flow's dispatch), not
 * multiple choice — the token set itself is the full pool of candidates,
 * and picking one submits it immediately for three-state grading.
 */
import type { NoteToken, SpelledNote } from "../../engine/types/schema.js";
import type { ChallengeRuntime, LevelEffect } from "../../game/level-flow.js";
import { display } from "../../engine/i18n/localized-text.js";
import { box, button, paragraph } from "../dom.js";
import { noteDisplayName } from "./shared.js";
import type { AppContext } from "../context.js";

export function renderNoteTokenChallenge(
  ctx: AppContext,
  tokens: NoteToken[],
  runtime: Extract<ChallengeRuntime, { kind: "note_token" }>,
  latestEffects: LevelEffect[],
  onAnswer: (note: SpelledNote) => void,
): HTMLElement {
  const container = box();
  container.appendChild(
    paragraph(
      ctx.language === "en"
        ? `Tap the notes that belong to this key. Correct so far: ${runtime.correctCount}`
        : `Toque nas notas que pertencem a esta tonalidade. Certas até agora: ${runtime.correctCount}`,
    ),
  );

  const disabled = runtime.strike.phase !== "answering";
  const row = document.createElement("div");
  for (const token of tokens) {
    const b = button(noteDisplayName(token.note, ctx.language), () => onAnswer(token.note), {
      "data-token": token.id,
    });
    b.disabled = disabled;
    row.appendChild(b);
  }
  container.appendChild(row);

  const feedback = latestEffects.find((e) => e.type === "feedback");
  if (feedback && feedback.type === "feedback" && feedback.feedback.kind !== "none") {
    const message =
      feedback.feedback.kind === "affirm"
        ? ctx.language === "en"
          ? "Correct!"
          : "Certo!"
        : display(feedback.feedback.message, ctx.language);
    container.appendChild(paragraph(message));
  }

  const strikeEffect = latestEffects.find((e) => e.type === "strike");
  if (strikeEffect && strikeEffect.type === "strike" && strikeEffect.effect.type === "show_short_prompt") {
    container.appendChild(
      paragraph(ctx.language === "en" ? "Not quite — listen again against the drone." : "Quase — escute de novo com o bordão."),
    );
  }

  return container;
}
