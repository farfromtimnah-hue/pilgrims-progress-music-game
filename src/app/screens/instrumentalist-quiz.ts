/**
 * Key-signature full-set quiz UI: select every accidental in the key and
 * nothing extra (checkboxes over the twelve pitch letters × accidental
 * candidates, not four-option multiple choice), plus the four-step
 * scaffolded recovery flow on a wrong main attempt, in its required order.
 */
import { getKey } from "../../engine/theory/keys.js";
import type { SpelledNote } from "../../engine/types/schema.js";
import type { ChallengeRuntime, LevelEvent } from "../../game/level-flow.js";
import type { AppContext } from "../context.js";
import { box, button, paragraph } from "../dom.js";
import { noteDisplayName } from "./shared.js";

const LETTERS: SpelledNote["letter"][] = ["C", "D", "E", "F", "G", "A", "B"];
const ACCIDENTAL_CANDIDATES: SpelledNote["accidental"][] = ["b", "natural", "#"];

function candidateNotes(): SpelledNote[] {
  const notes: SpelledNote[] = [];
  for (const letter of LETTERS) {
    for (const accidental of ACCIDENTAL_CANDIDATES) notes.push({ letter, accidental });
  }
  return notes;
}

export function renderKeySignatureChallenge(
  ctx: AppContext,
  keyId: string,
  runtime: Extract<ChallengeRuntime, { kind: "key_signature" }>,
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  const built = getKey(keyId);
  const container = box();
  container.appendChild(heading(ctx, built.key.displayName[ctx.language]));

  if (runtime.mode === "main") {
    return renderFullSetPicker(
      ctx,
      container,
      ctx.language === "en" ? "Select every accidental in this key. Nothing extra." : "Selecione todos os acidentes desta tonalidade. Nada a mais.",
      (notes) => dispatch({ type: "submit_full_set", notes }),
    );
  }

  return renderRecoveryStep(ctx, container, built.key.circleSide, runtime.recovery.step, dispatch);
}

function heading(ctx: AppContext, text: string): HTMLElement {
  const h = document.createElement("h3");
  h.textContent = text;
  return h;
}

function renderFullSetPicker(
  ctx: AppContext,
  container: HTMLElement,
  prompt: string,
  onSubmit: (notes: SpelledNote[]) => void,
): HTMLElement {
  container.appendChild(paragraph(prompt));
  const selected = new Set<string>();
  const key = (n: SpelledNote) => `${n.letter}${n.accidental}`;

  const grid = document.createElement("div");
  for (const note of candidateNotes()) {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset["note"] = key(note);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selected.add(key(note));
      else selected.delete(key(note));
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(noteDisplayName(note, ctx.language)));
    grid.appendChild(label);
  }
  container.appendChild(grid);

  container.appendChild(
    button(ctx.language === "en" ? "Submit" : "Enviar", () => {
      const notes = candidateNotes().filter((n) => selected.has(key(n)));
      onSubmit(notes);
    }),
  );
  return container;
}

function renderRecoveryStep(
  ctx: AppContext,
  container: HTMLElement,
  circleSide: "sharp" | "flat" | "none",
  step: "circle_side" | "accidental_count" | "select_set" | "order_set" | "complete",
  dispatch: (event: LevelEvent) => void,
): HTMLElement {
  container.appendChild(
    paragraph(ctx.language === "en" ? "Let's work through it step by step." : "Vamos passo a passo."),
  );

  switch (step) {
    case "circle_side": {
      const options: { side: "sharp" | "flat" | "none"; label: string }[] = [
        { side: "sharp", label: ctx.language === "en" ? "Sharp side" : "Lado dos sustenidos" },
        { side: "flat", label: ctx.language === "en" ? "Flat side" : "Lado dos bemóis" },
        { side: "none", label: ctx.language === "en" ? "Neither (no accidentals)" : "Nenhum acidente" },
      ];
      for (const opt of options) {
        container.appendChild(
          button(opt.label, () =>
            dispatch({ type: "recovery_answer", answer: { step: "circle_side", side: opt.side } }),
          ),
        );
      }
      break;
    }
    case "accidental_count": {
      const row = document.createElement("div");
      for (let count = 0; count <= 7; count++) {
        row.appendChild(
          button(String(count), () =>
            dispatch({ type: "recovery_answer", answer: { step: "accidental_count", count } }),
          ),
        );
      }
      container.appendChild(row);
      break;
    }
    case "select_set":
      renderFullSetPicker(
        ctx,
        container,
        ctx.language === "en" ? "Now select exactly those accidentals." : "Agora selecione exatamente esses acidentes.",
        (notes) => dispatch({ type: "recovery_answer", answer: { step: "select_set", notes } }),
      );
      break;
    case "order_set": {
      container.appendChild(
        paragraph(
          ctx.language === "en"
            ? "Tap the accidentals in signature order (the order will be checked)."
            : "Toque os acidentes na ordem da armadura de clave (a ordem será verificada).",
        ),
      );
      const chosen: SpelledNote[] = [];
      const orderedDisplay = paragraph("");
      const key = (n: SpelledNote) => `${n.letter}${n.accidental}`;
      const candidates = candidateNotes().filter((n) => n.accidental !== "natural");
      const row = document.createElement("div");
      for (const note of candidates) {
        row.appendChild(
          button(noteDisplayName(note, ctx.language), () => {
            if (!chosen.some((c) => key(c) === key(note))) chosen.push(note);
            orderedDisplay.textContent = chosen.map((n) => noteDisplayName(n, ctx.language)).join(" ");
          }),
        );
      }
      container.appendChild(row);
      container.appendChild(orderedDisplay);
      container.appendChild(
        button(ctx.language === "en" ? "Submit order" : "Enviar ordem", () =>
          dispatch({ type: "recovery_answer", answer: { step: "order_set", notes: chosen } }),
        ),
      );
      break;
    }
    case "complete":
      container.appendChild(paragraph(ctx.language === "en" ? "Recovered — nice work." : "Recuperado — bom trabalho."));
      break;
  }
  return container;
}
