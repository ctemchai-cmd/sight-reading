import type { Clef, KeyName, MidiNumber, TargetNote, RangePreset } from "@/types/music";

export type InputSource = "touch" | "computer-keyboard" | "midi";
export type TrainingMode = "reflex" | "flash" | "performance" | "sheet";
export type SessionEndReason = "target-reached" | "user-stopped";
export type PerformanceTimingGrade = "perfect" | "great" | "cool" | "bad" | "miss";
export type PerformanceFeedbackKind = PerformanceTimingGrade | "wrong";

export interface PerformanceFeedbackEvent {
  id: number;
  noteIndex: number;
  kind: PerformanceFeedbackKind;
}
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
  /** Null when the note went by unplayed: there was no correct response to time. */
  correctResponseMs: number | null;
  firstAttemptMs: number;
  firstTryCorrect: boolean;
  /** Present only when a metronome owns the target's timing window. */
  timingGrade?: PerformanceTimingGrade;
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
  /** Notes that passed unplayed. Only a tempo can leave one behind. */
  missedCount: number;
  firstTryCorrectCount: number;
  accuracy: number;
  mistakeCount: number;
  averageResponseMs: number | null;
  medianResponseMs: number | null;
  bestResponseMs: number | null;
  /** Immediate Performance result; response times and tempo can reproduce it later. */
  timingGrades?: Record<PerformanceTimingGrade, number>;
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
  /** Beats per minute for the modes that keep time; ignored by the others. */
  tempoBpm: number;
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
