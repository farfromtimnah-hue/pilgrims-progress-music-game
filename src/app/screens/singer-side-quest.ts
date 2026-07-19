/**
 * Side-quest UI: Echo the Guide and Hold the Lantern, wired end-to-end this
 * session as the pattern the remaining four quests (Choose the Better Path,
 * Walking Beside the Melody, Finish the Phrase, Hidden Companion) will
 * follow in a later session. Both real quests need pitch input from the
 * singer; without microphone pitch-detection in scope yet (per
 * hold-the-lantern.ts's header comment — "the caller's pitch detection
 * reports checkpoints"), this renders an honest press-the-note-you-sang
 * substitute using the same note-button pattern as the rest of the UI, so
 * nothing here is a mocked pass-through — every press is a real event fed
 * to the real reducer.
 */
import { display } from "../../engine/i18n/localized-text.js";
import type { PlacedNote } from "../../engine/theory/intervals.js";
import type { ChallengeRuntime, LevelEffect, LevelEvent } from "../../game/level-flow.js";
import type { SideQuestSpec } from "../../game/challenges.js";
import type { AppContext } from "../context.js";
import { box, button, paragraph } from "../dom.js";
import { noteDisplayName } from "./shared.js";

function uniqueNotesFromPhrase(notes: PlacedNote[]): PlacedNote[] {
  const seen = new Set<string>();
  const out: PlacedNote[] = [];
  for (const n of notes) {
    const key = `${n.note.letter}${n.note.accidental}${n.octave}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(n);
    }
  }
  return out;
}

export function renderSideQuestChallenge(
  ctx: AppContext,
  spec: SideQuestSpec | undefined,
  runtime: Extract<ChallengeRuntime, { kind: "side_quest" }>,
  latestEffects: LevelEffect[],
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  const container = box();
  if (!spec) return container;

  for (const effect of latestEffects) {
    if (effect.type !== "side_quest") continue;
    if (effect.effect.type === "prompt") container.appendChild(paragraph(display(effect.effect.text, ctx.language)));
    if (effect.effect.type === "retry") container.appendChild(paragraph(display(effect.effect.hint, ctx.language)));
    if (effect.effect.type === "reveal") container.appendChild(paragraph(display(effect.effect.text, ctx.language)));
  }

  if (spec.kind === "echo_the_guide") {
    const state = runtime.quest as { phase: string };
    if (state.phase === "complete") {
      container.appendChild(paragraph(ctx.language === "en" ? "Quest complete." : "Desafio concluído."));
      return container;
    }
    container.appendChild(
      paragraph(ctx.language === "en" ? "Sing back the phrase — tap the notes in order:" : "Cante a frase de volta — toque as notas em ordem:"),
    );
    const options = uniqueNotesFromPhrase(spec.question.phrase.map((n) => ({ note: n.note, octave: n.octave })));
    const picked: PlacedNote[] = [];
    const pickedDisplay = paragraph("");
    const row = document.createElement("div");
    for (const option of options) {
      row.appendChild(
        button(noteDisplayName(option.note, ctx.language), () => {
          picked.push(option);
          pickedDisplay.textContent = picked.map((n) => noteDisplayName(n.note, ctx.language)).join(" ");
        }),
      );
    }
    container.appendChild(row);
    container.appendChild(pickedDisplay);
    container.appendChild(
      button(ctx.language === "en" ? "Submit echo" : "Enviar eco", () => {
        dispatch({ type: "side_quest_event", event: { type: "submit_echo", pitches: picked } });
        picked.length = 0;
      }),
    );
    return container;
  }

  if (spec.kind === "hold_the_lantern") {
    const state = runtime.quest as { phase: string; checkpointsSeen: number };
    if (state.phase === "complete") {
      container.appendChild(paragraph(ctx.language === "en" ? "Quest complete." : "Desafio concluído."));
      return container;
    }
    container.appendChild(
      paragraph(
        ctx.language === "en"
          ? `Hold ${noteDisplayName(spec.question.target.note, ctx.language)} — checkpoint ${state.checkpointsSeen + 1} of ${spec.question.checkpoints}.`
          : `Segure ${noteDisplayName(spec.question.target.note, ctx.language)} — verificação ${state.checkpointsSeen + 1} de ${spec.question.checkpoints}.`,
      ),
    );
    container.appendChild(
      button(ctx.language === "en" ? "On the note" : "Na nota", () =>
        dispatch({ type: "side_quest_event", event: { type: "checkpoint", pitch: spec.question.target } }),
      ),
    );
    const scale = uniqueNotesFromPhrase(spec.question.melody.map((n) => ({ note: n.note, octave: n.octave })));
    for (const option of scale) {
      container.appendChild(
        button(noteDisplayName(option.note, ctx.language), () =>
          dispatch({ type: "side_quest_event", event: { type: "checkpoint", pitch: option } }),
        ),
      );
    }
    return container;
  }

  container.appendChild(
    paragraph(
      ctx.language === "en"
        ? "This side quest isn't wired into the UI yet — it plays through the engine's tests, not this screen."
        : "Este desafio ainda não está conectado à interface — ele roda pelos testes do motor, não por esta tela.",
    ),
  );
  return container;
}
