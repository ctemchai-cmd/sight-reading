import { describe, expect, it } from "vitest";
import { getPerformancePage, performancePageLastIndex } from "@/core/training/performance";

describe("performance sheet paging", () => {
  it("keeps the cursor local to a four-measure line", () => {
    const notes = Array.from({ length: 32 }, (_, index) => index);

    expect(getPerformancePage(notes, 15)).toEqual({ notes: notes.slice(0, 16), currentIndex: 15, startIndex: 0 });
    expect(getPerformancePage(notes, 16)).toEqual({ notes: notes.slice(16, 32), currentIndex: 0, startIndex: 16 });
  });

  it("does not generate past the final partial line", () => {
    expect(performancePageLastIndex(16, 25)).toBe(24);
    expect(performancePageLastIndex(16, "endless")).toBe(31);
  });
});
