import { average, median } from "@/core/training/statistics";
import type { TrainingSummary, TrainingTrial, WeakNoteStat } from "@/types/training";

export function calculateWeakNoteStats(trials: TrainingTrial[]): WeakNoteStat[] {
  const grouped = new Map<number, TrainingTrial[]>();
  for (const trial of trials) {
    const group = grouped.get(trial.target.expectedMidi) ?? [];
    group.push(trial);
    grouped.set(trial.target.expectedMidi, group);
  }

  const globalMedian = median(trials.map((trial) => trial.correctResponseMs)) ?? 1;

  return [...grouped.entries()]
    .map(([midi, noteTrials]) => {
      const responseTimes = noteTrials.map((trial) => trial.correctResponseMs);
      const firstTryCorrectCount = noteTrials.filter((trial) => trial.firstTryCorrect).length;
      const incorrectAttemptCount = noteTrials.reduce(
        (sum, trial) => sum + trial.attempts.filter((attempt) => !attempt.correct).length,
        0,
      );
      const firstTryAccuracy = firstTryCorrectCount / noteTrials.length;
      const noteMedian = median(responseTimes) ?? globalMedian;
      const latencyRatio = Math.min(3, Math.max(0.75, noteMedian / globalMedian));
      const weakScore = (1 + 2 * (1 - firstTryAccuracy)) * latencyRatio;

      return {
        midi,
        trialCount: noteTrials.length,
        firstTryCorrectCount,
        incorrectAttemptCount,
        firstTryAccuracy,
        averageResponseMs: average(responseTimes) ?? 0,
        medianResponseMs: noteMedian,
        bestResponseMs: Math.min(...responseTimes),
        weakScore,
      };
    })
    .sort((a, b) => b.weakScore - a.weakScore);
}

export function summarizeTraining(trials: TrainingTrial[]): TrainingSummary {
  const responseTimes = trials.map((trial) => trial.correctResponseMs);
  const firstTryCorrectCount = trials.filter((trial) => trial.firstTryCorrect).length;
  const mistakeCount = trials.reduce(
    (sum, trial) => sum + trial.attempts.filter((attempt) => !attempt.correct).length,
    0,
  );

  return {
    completedTargets: trials.length,
    firstTryCorrectCount,
    accuracy: trials.length === 0 ? 0 : firstTryCorrectCount / trials.length,
    mistakeCount,
    averageResponseMs: average(responseTimes),
    medianResponseMs: median(responseTimes),
    bestResponseMs: responseTimes.length === 0 ? null : Math.min(...responseTimes),
    weakNotes: calculateWeakNoteStats(trials),
  };
}
