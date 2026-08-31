import { describe, expect, it } from "vitest";
import {
  getPerformancePage,
  gradePerformanceTiming,
  isPerformanceLookaheadWindow,
  performanceBeatProgress,
  performancePageLastIndex,
  startsPerformanceLine,
} from "@/core/training/performance";

describe("performance sheet paging", () => {
  it("keeps the cursor local to a four-measure line", () => {
    const notes = Array.from({ length: 32 }, (_, index) => index);

    expect(getPerformancePage(notes, 15)).toEqual({ notes: notes.slice(0, 16), currentIndex: 15, startIndex: 0 });
    expect(getPerformancePage(notes, 16)).toEqual({ notes: notes.slice(16, 32), currentIndex: 0, startIndex: 16 });
  });

  it("marks the notes that arrive behind a page turn", () => {
    expect(startsPerformanceLine(0)).toBe(false); // the count-in covers the first
    expect(startsPerformanceLine(15)).toBe(false);
    expect(startsPerformanceLine(16)).toBe(true);
    expect(startsPerformanceLine(31)).toBe(false);
    expect(startsPerformanceLine(32)).toBe(true);
  });

  it("does not generate past the final partial line", () => {
    expect(performancePageLastIndex(16, 25)).toBe(24);
    expect(performancePageLastIndex(16, "endless")).toBe(31);
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
