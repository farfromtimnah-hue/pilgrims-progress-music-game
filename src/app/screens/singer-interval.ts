/**
 * Interval-recognition quiz UI: song-hint mode asks "which song does this
 * sound like", then reveals or asks for the formal name; direct mode names
 * the interval straight from the sound. The audio always plays before any
 * choice is offered — the reducer's `play_interval` effect fires before
 * this renders any buttons.
 */
import { display } from "../../engine/i18n/localized-text.js";
import { INTERVALS, type IntervalId } from "../../engine/theory/intervals.js";
import type { ChallengeRuntime, LevelEffect, LevelEvent } from "../../game/level-flow.js";
import type { Challenge } from "../../game/challenges.js";
import type { AppContext } from "../context.js";
import { box, button, paragraph } from "../dom.js";

export function renderIntervalChallenge(
  ctx: AppContext,
  runtime: Extract<ChallengeRuntime, { kind: "interval" }>,
  latestEffects: LevelEffect[],
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  const container = box();

  const retry = latestEffects.find((e) => e.type === "interval" && e.effect.type === "retry");
  if (retry && retry.type === "interval" && retry.effect.type === "retry") {
    container.appendChild(paragraph(display(retry.effect.hint, ctx.language)));
  }
  const reveal = latestEffects.find((e) => e.type === "interval" && e.effect.type === "reveal_interval_name");
  if (reveal && reveal.type === "interval" && reveal.effect.type === "reveal_interval_name") {
    container.appendChild(paragraph(display(reveal.effect.name, ctx.language)));
  }

  if (runtime.quiz.phase === "song_choice") {
    container.appendChild(
      paragraph(ctx.language === "en" ? "Which song does that sound like?" : "Com qual música isso se parece?"),
    );
    // Song options are carried on the challenge, not the runtime state — the
    // caller (level-runner) passes the same challenge object each render.
    container.appendChild(paragraph(ctx.language === "en" ? "(song options rendered below)" : "(opções de música abaixo)"));
  } else if (runtime.quiz.phase === "name_choice") {
    container.appendChild(
      paragraph(ctx.language === "en" ? "What's the formal name of this interval?" : "Qual o nome formal deste intervalo?"),
    );
  } else {
    container.appendChild(paragraph(ctx.language === "en" ? "Nice ear!" : "Bom ouvido!"));
  }

  return container;
}

/** Song-choice and name-choice option buttons, built from the real challenge content. */
export function renderIntervalOptions(
  ctx: AppContext,
  challenge: Extract<Challenge, { kind: "interval" }>,
  runtime: Extract<ChallengeRuntime, { kind: "interval" }>,
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  const row = document.createElement("div");
  if (runtime.quiz.phase === "song_choice") {
    for (const ref of challenge.question.songOptions) {
      row.appendChild(
        button(display(ref.title, ctx.language), () =>
          dispatch({ type: "interval_event", event: { type: "choose_song", songReferenceId: ref.id } }),
        ),
      );
    }
  } else if (runtime.quiz.phase === "name_choice") {
    for (const id of challenge.question.nameOptions) {
      const intervalId = id as IntervalId;
      row.appendChild(
        button(display(INTERVALS[intervalId].name, ctx.language), () =>
          dispatch({ type: "interval_event", event: { type: "choose_name", intervalId } }),
        ),
      );
    }
  }
  return row;
}
