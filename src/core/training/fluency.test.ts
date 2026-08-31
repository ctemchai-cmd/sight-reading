import { describe, expect, it } from "vitest";
import {
  FLUENT_RESPONSE_MS,
  LABOURED_RESPONSE_MS,
  accuracyFluency,
  fluencyColor,
  responseFluency,
} from "@/core/training/fluency";

describe("reading fluency", () => {
  it("calls a note fluent at the threshold and laboured at the far one", () => {
    expect(responseFluency(FLUENT_RESPONSE_MS)).toBe(1);
    expect(responseFluency(400)).toBe(1); // faster than fluent is still fluent
    expect(responseFluency(LABOURED_RESPONSE_MS)).toBe(0);
    expect(responseFluency(4000)).toBe(0);
    expect(responseFluency(1650)).toBeCloseTo(0.5, 2);
    // No history is not the same as being slow, but it cannot be called fluent.
    expect(responseFluency(0)).toBe(0);
  });

  it("needs near-perfect first tries before accuracy stops holding a note back", () => {
    expect(accuracyFluency(1)).toBe(1);
    expect(accuracyFluency(0.95)).toBe(1);
    expect(accuracyFluency(0.5)).toBe(0);
    expect(accuracyFluency(0)).toBe(0);
    expect(accuracyFluency(0.725)).toBeCloseTo(0.5, 2);
  });

  it("runs red through amber to green rather than fading one colour out", () => {
    expect(fluencyColor(0)).toBe("rgb(239 68 68)");
    expect(fluencyColor(0.5)).toBe("rgb(245 158 11)");
    expect(fluencyColor(1)).toBe("rgb(34 197 94)");
    expect(fluencyColor(1, 0.5)).toBe("rgb(34 197 94 / 0.5)");
  });
});
