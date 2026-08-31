import { average, median } from "@/core/training/statistics";
import { PERFORMANCE_TIMING_GRADE_ORDER } from "@/core/training/performance";
import type { PerformanceTimingGrade, TrainingSummary, TrainingTrial, WeakNoteStat } from "@/types/training";

/** How much of a session a note needs before its own score outranks its history. */
const SESSION_CONFIDENCE_TRIALS = 3;

/** Response times of the notes that were actually played. */
function timings(trials: TrainingTrial[]): number[] {
  return trials.map((trial) => trial.correctResponseMs).filter((ms): ms is number => ms !== null);
}

export function calculateWeakNoteStats(trials: TrainingTrial[]): WeakNoteStat[] {
  const grouped = new Map<number, TrainingTrial[]>();
  for (const trial of trials) {
    const group = grouped.get(trial.target.expectedMidi) ?? [];
    group.push(trial);
    grouped.set(trial.target.expectedMidi, group);
  }

  const globalMedian = median(timings(trials)) ?? 1;

  return [...grouped.entries()]
    .map(([midi, noteTrials]) => {
      const responseTimes = timings(noteTrials);
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
        bestResponseMs: responseTimes.length ? Math.min(...responseTimes) : 0,
        weakScore,
      };
    })
    .sort((a, b) => b.weakScore - a.weakScore);
}

export function summarizeTraining(trials: TrainingTrial[]): TrainingSummary {
  const responseTimes = timings(trials);
  const firstTryCorrectCount = trials.filter((trial) => trial.firstTryCorrect).length;
  const mistakeCount = trials.reduce(
    (sum, trial) => sum + trial.attempts.filter((attempt) => !attempt.correct).length,
    0,
  );
  const timingGrades = Object.fromEntries(
    PERFORMANCE_TIMING_GRADE_ORDER.map((grade) => [
      grade,
      trials.filter((trial) => trial.timingGrade === grade).length,
    ]),
  ) as Record<PerformanceTimingGrade, number>;
  const hasTimingGrades = PERFORMANCE_TIMING_GRADE_ORDER.some((grade) => timingGrades[grade] > 0);

  return {
    completedTargets: trials.length,
    missedCount: trials.filter((trial) => trial.correctResponseMs === null).length,
    firstTryCorrectCount,
    accuracy: trials.length === 0 ? 0 : firstTryCorrectCount / trials.length,
    mistakeCount,
    averageResponseMs: average(responseTimes),
    medianResponseMs: median(responseTimes),
    bestResponseMs: responseTimes.length === 0 ? null : Math.min(...responseTimes),
    ...(hasTimingGrades ? { timingGrades } : {}),
    weakNotes: calculateWeakNoteStats(trials),
  };
}

/** Per-note running totals, as they are kept between sessions. */
export interface NoteTotals {
  midi: number;
  trialCount: number;
  firstTryCorrectCount: number;
  incorrectAttemptCount: number;
  averageResponseMs: number;
  medianResponseMs: number;
  bestResponseMs: number;
}

/**
 * Scores accumulated totals the same way a single session is scored. Only the
 * per-note medians survive between sessions, so the reference point is the
 * median of those rather than of every response ever given — close enough to
 * rank notes against each other, which is all the weighting needs.
 */
export function weakNoteStatsFromTotals(totals: NoteTotals[]): WeakNoteStat[] {
  const scored = totals.filter((note) => note.trialCount > 0);
  const globalMedian = median(scored.map((note) => note.medianResponseMs)) ?? 1;

  return scored
    .map((note) => {
      const firstTryAccuracy = note.firstTryCorrectCount / note.trialCount;
      const latencyRatio = Math.min(3, Math.max(0.75, note.medianResponseMs / (globalMedian || 1)));
      return {
        ...note,
        firstTryAccuracy,
        weakScore: (1 + 2 * (1 - firstTryAccuracy)) * latencyRatio,
      };
    })
    .sort((a, b) => b.weakScore - a.weakScore);
}

/**
 * History says where the weak spots are before a session has any evidence of
 * its own; the session takes over for a note once it has seen it enough times
 * to disagree.
 */
export function mergeNoteStats(history: WeakNoteStat[], session: WeakNoteStat[]): WeakNoteStat[] {
  const merged = new Map(history.map((stat) => [stat.midi, stat]));
  for (const stat of session) {
    if (stat.trialCount >= SESSION_CONFIDENCE_TRIALS || !merged.has(stat.midi)) merged.set(stat.midi, stat);
  }
  return [...merged.values()];
}
