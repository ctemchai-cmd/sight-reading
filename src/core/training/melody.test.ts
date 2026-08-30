import { describe, expect, it } from "vitest";
import { nextScaleIndex } from "@/core/training/melody";

describe("melodic shape", () => {
  it("keeps steps adjacent and lets leaps travel", () => {
    const spread = (shape: "steps" | "leaps") => {
      const distances = new Set<number>();
      for (let seed = 0; seed < 100; seed += 1) {
        const next = nextScaleIndex(shape, 10, 21, () => seed / 100);
        distances.add(Math.abs(next - 10));
      }
      return [...distances].sort((a, b) => a - b);
    };
    expect(spread("steps")).toEqual([1, 2]);
    expect(Math.max(...spread("leaps"))).toBeGreaterThan(4);
  });

  it("never stands still, so a note is never its own successor", () => {
    for (let seed = 0; seed < 100; seed += 1) {
      expect(nextScaleIndex("thirds", 5, 15, () => seed / 100)).not.toBe(5);
    }
  });

  it("stays inside the range and folds back rather than pinning to an end", () => {
    const atTop = Array.from({ length: 50 }, (_, seed) => nextScaleIndex("leaps", 9, 10, () => seed / 50));
    const atBottom = Array.from({ length: 50 }, (_, seed) => nextScaleIndex("leaps", 0, 10, () => seed / 50));
    expect(atTop.every((index) => index >= 0 && index < 10)).toBe(true);
    expect(atBottom.every((index) => index >= 0 && index < 10)).toBe(true);
    // Folded back inwards instead of stalling on the boundary.
    expect(atTop.every((index) => index < 9)).toBe(true);
    expect(atBottom.every((index) => index > 0)).toBe(true);
  });

  it("copes with a range of one note", () => {
    expect(nextScaleIndex("steps", 0, 1, () => 0.5)).toBe(0);
  });
});
