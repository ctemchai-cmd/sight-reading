import { describe, expect, it } from "vitest";
import { summariseForCoach } from "@/core/assistant/context";
import { FLUENT_RESPONSE_MS } from "@/core/training/fluency";
import { summarisePractice } from "@/core/training/practiceHistory";
import type { CoachSession } from "@/types/assistant";
import type { WeakNoteStat } from "@/types/training";

function session(overrides: Partial<CoachSession> = {}): CoachSession {
  return {
    mode: "reflex",
    completedAt: "2026-09-01T10:00:00.000Z",
    completedTargets: 71,
    accuracy: 0.9,
    medianResponseMs: 1200,
    ...overrides,
  };
}

function stat(midi: number, overrides: Partial<WeakNoteStat> = {}): WeakNoteStat {
  return {
    midi,
    trialCount: 20,
    firstTryCorrectCount: 18,
    incorrectAttemptCount: 2,
    firstTryAccuracy: 0.9,
    averageResponseMs: 1200,
    medianResponseMs: 1200,
    bestResponseMs: 600,
    weakScore: 1,
    ...overrides,
  };
}

const NO_PRACTICE = summarisePractice([]);

describe("coach context", () => {
  it("says there is nothing to describe when nothing has been practised", () => {
    const summary = summariseForCoach([], [], NO_PRACTICE);
    expect(summary).toContain("no recorded practice");
    // The point of the empty case: it must not invite an invented assessment.
    expect(summary).toContain("do not describe their reading");
  });

  it("reports the habit, the totals and each mode separately", () => {
    const sessions = [
      session({ mode: "reflex", completedAt: "2026-09-02T10:00:00.000Z" }),
      session({ mode: "performance", completedAt: "2026-09-01T10:00:00.000Z", medianResponseMs: 900 }),
    ];
    const practice = summarisePractice(sessions.map((each) => each.completedAt), new Date("2026-09-02T12:00:00.000Z"));
    const summary = summariseForCoach(sessions, [stat(60)], practice, new Date("2026-09-02T12:00:00.000Z"));

    expect(summary).toContain("Current streak 2 days");
    expect(summary).toContain("2 sessions, 142 notes");
    expect(summary).toContain("- reflex: 1 sessions");
    expect(summary).toContain("- performance: 1 sessions");
  });

  it("ranks the pitches worst first and names them as notes and MIDI numbers", () => {
    const summary = summariseForCoach(
      [session()],
      [stat(60, { weakScore: 1 }), stat(65, { weakScore: 3, medianResponseMs: 2400 })],
      NO_PRACTICE,
    );
    const weakest = summary.indexOf("F4");
    const strongest = summary.indexOf("C4");
    expect(weakest).toBeGreaterThan(-1);
    expect(weakest).toBeLessThan(strongest);
    expect(summary).toContain("MIDI 65");
  });

  it("lists only the pitches that clear the fluent threshold as read on sight", () => {
    const summary = summariseForCoach(
      [session()],
      [stat(60, { medianResponseMs: FLUENT_RESPONSE_MS - 100 }), stat(62, { medianResponseMs: 2000 })],
      NO_PRACTICE,
    );
    const read = summary.slice(summary.indexOf("Read on sight"));
    expect(read).toContain("C4");
    expect(read).not.toContain("D4");
  });

  it("never carries anything identifying", () => {
    const summary = summariseForCoach([session()], [stat(60)], NO_PRACTICE);
    expect(summary).not.toMatch(/@|email|user[_ ]?id/i);
  });
});
