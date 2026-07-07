/**
 * Three-strike scaffold state machine — instructional, not punitive.
 *
 *   strike 1 → damage + a short teaching prompt, keep playing
 *   strike 2 → pause and ask a smaller diagnostic question
 *   strike 3 → route into a scaffold sequence, then re-enter the question
 *
 * Pure reducer, no UI coupling: (state, event) → { state, effects }. The
 * caller (game loop / UI layer) interprets effects; this module never
 * touches audio, rendering, or persistence. Answers are fed in only after
 * tier policy has decided they count as mistakes (see note-token/grade.ts),
 * so e.g. a Beginner Close answer never reaches this machine.
 */

export type StrikePhase =
  | "answering" // normal play
  | "diagnostic" // paused on the smaller diagnostic question (after strike 2)
  | "scaffold"; // routed into a scaffold sequence (after strike 3)

export interface StrikeState {
  phase: StrikePhase;
  strikes: 0 | 1 | 2 | 3;
}

export const INITIAL_STRIKE_STATE: StrikeState = { phase: "answering", strikes: 0 };

export type StrikeEvent =
  | { type: "mistake" } // an answer that counts as a mistake under tier policy
  | { type: "correct" } // a correct answer
  | { type: "diagnostic_answered"; correct: boolean }
  | { type: "scaffold_completed" };

export type StrikeEffect =
  | { type: "apply_damage" }
  | { type: "show_short_prompt" } // strike 1
  | { type: "pause_for_diagnostic" } // strike 2
  | { type: "enter_scaffold_sequence" } // strike 3
  | { type: "reenter_question" } // resume normal play
  | { type: "clear_strikes" };

export interface StrikeTransition {
  state: StrikeState;
  effects: StrikeEffect[];
}

export function strikeReducer(state: StrikeState, event: StrikeEvent): StrikeTransition {
  switch (state.phase) {
    case "answering":
      if (event.type === "correct") {
        // Recovery: a correct answer clears accumulated strikes.
        return state.strikes === 0
          ? { state, effects: [] }
          : { state: { phase: "answering", strikes: 0 }, effects: [{ type: "clear_strikes" }] };
      }
      if (event.type === "mistake") {
        switch (state.strikes) {
          case 0:
            return {
              state: { phase: "answering", strikes: 1 },
              effects: [{ type: "apply_damage" }, { type: "show_short_prompt" }],
            };
          case 1:
            return {
              state: { phase: "diagnostic", strikes: 2 },
              effects: [{ type: "pause_for_diagnostic" }],
            };
          default:
            // Third (or later) mistake: scaffold, not more damage.
            return {
              state: { phase: "scaffold", strikes: 3 },
              effects: [{ type: "enter_scaffold_sequence" }],
            };
        }
      }
      return { state, effects: [] };

    case "diagnostic":
      if (event.type === "diagnostic_answered") {
        if (event.correct) {
          // Diagnostic passed: resume the real question; strikes stay at 2
          // so the next real mistake routes into the scaffold sequence.
          return {
            state: { phase: "answering", strikes: 2 },
            effects: [{ type: "reenter_question" }],
          };
        }
        // Diagnostic failed: the gap is real — go straight to the scaffold.
        return {
          state: { phase: "scaffold", strikes: 3 },
          effects: [{ type: "enter_scaffold_sequence" }],
        };
      }
      return { state, effects: [] };

    case "scaffold":
      if (event.type === "scaffold_completed") {
        // Fresh start after instruction — strikes cleared, back to the question.
        return {
          state: { phase: "answering", strikes: 0 },
          effects: [{ type: "clear_strikes" }, { type: "reenter_question" }],
        };
      }
      return { state, effects: [] };
  }
}
