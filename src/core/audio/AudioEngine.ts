export interface AudioEngine {
  initialize(): Promise<void>;
  noteOn(midi: number, velocity?: number): void;
  noteOff(midi: number): void;
  /** The damper pedal: while down, a released key keeps ringing. */
  setSustain(down: boolean): void;
  playNote(midi: number, velocity?: number, durationSeconds?: number): void;
  click(accented?: boolean): void;
  setVolume(decibels: number): void;
  stopAll(): void;
}
