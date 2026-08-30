import { describe, expect, it } from "vitest";
import { summarizeTraining } from "@/core/training/scoring";
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
});
