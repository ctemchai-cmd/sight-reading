import { describe, expect, it } from "vitest";
import { DEFAULT_VELOCITY, velocityFromKeyPosition, velocityToGain } from "@/core/audio/velocity";

describe("velocity to gain", () => {
  it("spans silence to full scale without ever being silent", () => {
    expect(velocityToGain(127)).toBeCloseTo(1, 5);
    expect(velocityToGain(1)).toBeGreaterThan(0);
    expect(velocityToGain(0)).toBeGreaterThan(0);
  });

  it("rises with velocity", () => {
    const gains = [1, 32, 64, 96, 127].map(velocityToGain);
    expect(gains).toEqual([...gains].sort((a, b) => a - b));
  });

  // Passing velocity/127 straight through put a mezzo-piano note at four fifths
  // of full scale, so soft and hard playing sounded nearly the same.
  it("keeps a middling touch well below full scale", () => {
    expect(velocityToGain(64)).toBeLessThan(0.4);
  });

  it("clamps input from outside the MIDI range", () => {
    expect(velocityToGain(999)).toBeLessThanOrEqual(1);
    expect(velocityToGain(-5)).toBeGreaterThanOrEqual(0);
  });
});

describe("velocity from where the key was struck", () => {
  it("is louder further down the key, as leverage would make it", () => {
    expect(velocityFromKeyPosition(95, 100)).toBeGreaterThan(velocityFromKeyPosition(5, 100));
  });

  it("stays inside the MIDI range at either end", () => {
    for (const y of [-50, 0, 50, 100, 400]) {
      const velocity = velocityFromKeyPosition(y, 100);
      expect(velocity).toBeGreaterThan(0);
      expect(velocity).toBeLessThanOrEqual(127);
    }
  });

  // jsdom, and a browser before layout, both report a zero-height key.
  it("falls back rather than dividing by a height it does not have", () => {
    expect(velocityFromKeyPosition(10, 0)).toBe(DEFAULT_VELOCITY);
    expect(velocityFromKeyPosition(Number.NaN, 100)).toBe(DEFAULT_VELOCITY);
  });
});
