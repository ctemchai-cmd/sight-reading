import { describe, expect, it } from "vitest";
import {
  getPerformancePage,
  gradePerformanceTiming,
  isPerformanceLookaheadWindow,
  performanceBeatProgress,
  performancePageLastIndex,
} from "@/core/training/performance";

describe("performance sheet paging", () => {
  it("shows the line being played and the one after it, cursor on the first", () => {
    const notes = Array.from({ length: 64 }, (_, index) => index);

    expect(getPerformancePage(notes, 15)).toEqual({ notes: notes.slice(0, 32), currentIndex: 15, startIndex: 0 });
    // Crossing a line shifts the window on by one, so what was the lower line —
    // already read — becomes the one being played.
    expect(getPerformancePage(notes, 16)).toEqual({ notes: notes.slice(16, 48), currentIndex: 0, startIndex: 16 });
  });

  it("generates far enough ahead to fill the window, and no further", () => {
    expect(performancePageLastIndex(16, "endless")).toBe(47);
    expect(performancePageLastIndex(0, "endless")).toBe(31);
    // A session that ends mid-window stops at its final note.
    expect(performancePageLastIndex(16, 25)).toBe(24);
  });

  it("grades distance from the beat relative to tempo", () => {
    expect(gradePerformanceTiming(-100, 1_000)).toBe("perfect");
    expect(gradePerformanceTiming(200, 1_000)).toBe("great");
    expect(gradePerformanceTiming(-350, 1_000)).toBe("cool");
    expect(gradePerformanceTiming(500, 1_000)).toBe("bad");
    expect(gradePerformanceTiming(null, 1_000)).toBe("miss");
  });

  it("derives cursor progress from the metronome clock and clamps late frames", () => {
    expect(performanceBeatProgress(1_250, 1_000, 1_000)).toBe(0.25);
    expect(performanceBeatProgress(900, 1_000, 1_000)).toBe(0);
    expect(performanceBeatProgress(2_500, 1_000, 1_000)).toBe(1);
  });

  it("opens the next target after the cursor crosses the midpoint", () => {
    expect(isPerformanceLookaheadWindow(1_499, 2_000, 1_000)).toBe(false);
    expect(isPerformanceLookaheadWindow(1_500, 2_000, 1_000)).toBe(true);
    expect(isPerformanceLookaheadWindow(1_999, 2_000, 1_000)).toBe(true);
    expect(isPerformanceLookaheadWindow(2_000, 2_000, 1_000)).toBe(false);
  });
});
