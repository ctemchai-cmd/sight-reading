import type { Clef, KeyName, MidiNumber, TargetNote, RangePreset } from "@/types/music";

export type InputSource = "touch" | "computer-keyboard" | "midi";
export type TrainingMode = "reflex" | "flash" | "sheet";
export type SessionEndReason = "target-reached" | "user-stopped";
/** How far the line is allowed to move between notes, in scale degrees. */
export type MelodicShape = "steps" | "thirds" | "leaps" | "random";

export interface NoteInputEvent {
  midi: MidiNumber;
  velocity: number | null;
  source: InputSource;
  occurredAtMs: number;
}

export interface TrainingAttempt {
  id: string;
  trialId: string;
  targetMidi: MidiNumber;
  playedMidi: MidiNumber;
  correct: boolean;
  firstAttempt: boolean;
  responseMs: number;
  velocity: number | null;
  source: InputSource;
}

export interface TrainingTrial {
  id: string;
  sequenceIndex: number;
  target: TargetNote;
  shownAtMs: number;
  attempts: TrainingAttempt[];
  completedAtMs: number;
  correctResponseMs: number;
  firstAttemptMs: number;
  firstTryCorrect: boolean;
}

export interface WeakNoteStat {
  midi: MidiNumber;
  trialCount: number;
  firstTryCorrectCount: number;
  incorrectAttemptCount: number;
  firstTryAccuracy: number;
  averageResponseMs: number;
  medianResponseMs: number;
  bestResponseMs: number;
  weakScore: number;
}

export interface TrainingSummary {
  completedTargets: number;
  firstTryCorrectCount: number;
  accuracy: number;
  mistakeCount: number;
  averageResponseMs: number | null;
  medianResponseMs: number | null;
  bestResponseMs: number | null;
  weakNotes: WeakNoteStat[];
}

export interface TrainingSessionConfig {
  mode: TrainingMode;
  clef: Clef;
  /** Resolved for the session, so a random choice is still recorded as the key it landed on. */
  keySignature: KeyName;
  melodicShape: MelodicShape;
  rangePreset: RangePreset;
  minMidi: number;
  maxMidi: number;
  sessionLength: number | "endless";
  adaptive: boolean;
  soundEnabled: boolean;
  midiSoundEnabled: boolean;
  computerKeyboardEnabled: boolean;
  nextNoteDelayMs: number;
}

export interface TrainingSessionRecord {
  id: string;
  mode: TrainingMode;
  config: TrainingSessionConfig;
  startedAt: string;
  completedAt: string;
  endReason: SessionEndReason;
  summary: TrainingSummary;
  trials: TrainingTrial[];
  syncStatus: "local" | "pending" | "synced";
}
