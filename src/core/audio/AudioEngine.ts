export interface AudioEngine {
  initialize(): Promise<void>;
  noteOn(midi: number, velocity?: number): void;
  noteOff(midi: number): void;
  playNote(midi: number, velocity?: number, durationSeconds?: number): void;
  setVolume(decibels: number): void;
  stopAll(): void;
}
