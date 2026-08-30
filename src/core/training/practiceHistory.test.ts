import { describe, expect, it } from "vitest";
import { summarisePractice } from "@/core/training/practiceHistory";

const NOW = new Date(2026, 7, 30, 18, 0, 0);
const daysAgo = (count: number, hour = 12) =>
  new Date(2026, 7, 30 - count, hour, 0, 0).toISOString();

describe("practice history", () => {
  it("reports nothing for a player who has never finished a session", () => {
    expect(summarisePractice([], NOW)).toEqual({
      currentStreak: 0,
      bestStreak: 0,
      daysThisWeek: 0,
      practisedToday: false,
      lastSevenDays: [false, false, false, false, false, false, false],
    });
  });

  it("counts consecutive days and ignores several sessions in one day", () => {
    const history = summarisePractice([daysAgo(0), daysAgo(0, 20), daysAgo(1), daysAgo(2)], NOW);
    expect(history.currentStreak).toBe(3);
    expect(history.practisedToday).toBe(true);
    expect(history.daysThisWeek).toBe(3);
  });

  it("keeps yesterday's streak alive until the day is missed", () => {
    expect(summarisePractice([daysAgo(1), daysAgo(2)], NOW).currentStreak).toBe(2);
    expect(summarisePractice([daysAgo(2), daysAgo(3)], NOW).currentStreak).toBe(0);
  });

  it("lays the week out oldest first, ending today", () => {
    const history = summarisePractice([daysAgo(0), daysAgo(2), daysAgo(6)], NOW);
    expect(history.lastSevenDays).toEqual([true, false, false, false, true, false, true]);
  });

  it("remembers the best run even after it is broken", () => {
    const history = summarisePractice([daysAgo(0), daysAgo(4), daysAgo(5), daysAgo(6), daysAgo(7)], NOW);
    expect(history.currentStreak).toBe(1);
    expect(history.bestStreak).toBe(4);
    expect(history.daysThisWeek).toBe(4);
  });
});
