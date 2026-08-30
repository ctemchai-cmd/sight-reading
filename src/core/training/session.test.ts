import { describe, expect, it } from "vitest";
import { applyInputToTrial, createOpenTrial } from "@/core/training/session";

describe("training trial timing", () => {
  it("does not reset the original timer after an incorrect input", () => {
    const target = { id: "target", expectedMidi: 69, notation: { letter: "A" as const, accidental: "natural" as const, octave: 4 } };
    const open = createOpenTrial(target, 0, 1000);
    const wrong = applyInputToTrial(open, { midi: 67, velocity: 80, source: "midi", occurredAtMs: 1600 });
    expect(wrong.attempt.responseMs).toBe(600);
    expect(wrong.completed).toBeNull();
    const correct = applyInputToTrial(wrong.trial, { midi: 69, velocity: 80, source: "midi", occurredAtMs: 2100 });
    expect(correct.completed?.correctResponseMs).toBe(1100);
    expect(correct.completed?.firstAttemptMs).toBe(600);
    expect(correct.completed?.firstTryCorrect).toBe(false);
  });
});
