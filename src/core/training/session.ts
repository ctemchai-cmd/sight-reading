import type { TargetNote } from "@/types/music";
import type { NoteInputEvent, TrainingAttempt, TrainingTrial } from "@/types/training";

export interface OpenTrial {
  id: string;
  sequenceIndex: number;
  target: TargetNote;
  shownAtMs: number;
  attempts: TrainingAttempt[];
}

export function createOpenTrial(target: TargetNote, sequenceIndex: number, shownAtMs: number): OpenTrial {
  return { id: crypto.randomUUID(), sequenceIndex, target, shownAtMs, attempts: [] };
}

export function applyInputToTrial(
  trial: OpenTrial,
  input: NoteInputEvent,
): { trial: OpenTrial; attempt: TrainingAttempt; completed: TrainingTrial | null } {
  const responseMs = Math.max(0, input.occurredAtMs - trial.shownAtMs);
  const correct = input.midi === trial.target.expectedMidi;
  const attempt: TrainingAttempt = {
    id: crypto.randomUUID(),
    trialId: trial.id,
    targetMidi: trial.target.expectedMidi,
    playedMidi: input.midi,
    correct,
    firstAttempt: trial.attempts.length === 0,
    responseMs,
    velocity: input.velocity,
    source: input.source,
  };
  const updated = { ...trial, attempts: [...trial.attempts, attempt] };

  if (!correct) return { trial: updated, attempt, completed: null };

  return {
    trial: updated,
    attempt,
    completed: {
      ...updated,
      completedAtMs: input.occurredAtMs,
      correctResponseMs: responseMs,
      firstAttemptMs: updated.attempts[0].responseMs,
      firstTryCorrect: updated.attempts.length === 1,
    },
  };
}

/**
 * Closes a trial that was never answered. Playing in time means the music does
 * not wait, so a note can end without a correct response — and without one
 * there is no response time to record, which is why the field is nullable
 * rather than filled with the length of the beat.
 */
export function missTrial(trial: OpenTrial, atMs: number): TrainingTrial {
  return {
    ...trial,
    completedAtMs: atMs,
    correctResponseMs: null,
    firstAttemptMs: trial.attempts[0]?.responseMs ?? Math.max(0, atMs - trial.shownAtMs),
    firstTryCorrect: false,
  };
}
