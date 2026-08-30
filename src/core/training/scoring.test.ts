import { describe, expect, it } from "vitest";
import { mergeNoteStats, summarizeTraining, weakNoteStatsFromTotals } from "@/core/training/scoring";
import type { TrainingTrial } from "@/types/training";

function trial(midi: number, response: number, firstTryCorrect: boolean): TrainingTrial {
  const id = `trial-${midi}-${response}`;
  const attempts = firstTryCorrect
    ? [{ id: `${id}-1`, trialId: id, targetMidi: midi, playedMidi: midi, correct: true, firstAttempt: true, responseMs: response, velocity: 90, source: "midi" as const }]
    : [
      { id: `${id}-1`, trialId: id, targetMidi: midi, playedMidi: midi - 1, correct: false, firstAttempt: true, responseMs: 200, velocity: 90, source: "midi" as const },
      { id: `${id}-2`, trialId: id, targetMidi: midi, playedMidi: midi, correct: true, firstAttempt: false, responseMs: response, velocity: 90, source: "midi" as const },
    ];
  return {
    id,
    sequenceIndex: 0,
    target: { id: `target-${id}`, expectedMidi: midi, notation: { letter: "C", accidental: "natural", octave: 4 } },
    shownAtMs: 0,
    completedAtMs: response,
    correctResponseMs: response,
    firstAttemptMs: attempts[0].responseMs,
    firstTryCorrect,
    attempts,
  };
}

describe("training scoring", () => {
  it("uses first attempts for accuracy and correct attempts for response time", () => {
    const summary = summarizeTraining([trial(60, 400, true), trial(62, 1000, false), trial(64, 600, true)]);
    expect(summary.accuracy).toBeCloseTo(2 / 3);
    expect(summary.mistakeCount).toBe(1);
    expect(summary.averageResponseMs).toBeCloseTo(2000 / 3);
    expect(summary.medianResponseMs).toBe(600);
    expect(summary.bestResponseMs).toBe(400);
  });

  it("marks a slow but accurate note as weak", () => {
    const summary = summarizeTraining([trial(60, 300, true), trial(62, 1500, true)]);
    expect(summary.weakNotes[0].midi).toBe(62);
  });

  it("scores accumulated totals so history can rank notes before a session starts", () => {
    const totals = [
      { midi: 60, trialCount: 20, firstTryCorrectCount: 20, incorrectAttemptCount: 0, averageResponseMs: 500, medianResponseMs: 500, bestResponseMs: 400 },
      { midi: 77, trialCount: 20, firstTryCorrectCount: 8, incorrectAttemptCount: 15, averageResponseMs: 1600, medianResponseMs: 1500, bestResponseMs: 900 },
    ];
    const [weakest, strongest] = weakNoteStatsFromTotals(totals);
    expect(weakest.midi).toBe(77);
    expect(strongest.midi).toBe(60);
    expect(weakest.weakScore).toBeGreaterThan(strongest.weakScore * 2);
    expect(weakNoteStatsFromTotals([])).toEqual([]);
  });

  it("lets a session override its history only once it has seen the note enough", () => {
    const history = weakNoteStatsFromTotals([
      { midi: 60, trialCount: 40, firstTryCorrectCount: 12, incorrectAttemptCount: 30, averageResponseMs: 1800, medianResponseMs: 1800, bestResponseMs: 900 },
    ]);
    const nowFluent = { ...history[0], trialCount: 5, firstTryAccuracy: 1, weakScore: 0.8 };
    const barelySeen = { ...history[0], trialCount: 1, firstTryAccuracy: 1, weakScore: 0.8 };

    expect(mergeNoteStats(history, [nowFluent])[0].weakScore).toBe(0.8);
    expect(mergeNoteStats(history, [barelySeen])[0].weakScore).toBe(history[0].weakScore);
    // A note the history has never seen is taken on the session's word.
    expect(mergeNoteStats(history, [{ ...barelySeen, midi: 64 }]).map((stat) => stat.midi).sort()).toEqual([60, 64]);
  });
});
