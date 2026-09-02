import type { NoteInputEvent } from "@/types/training";

export interface InputProvider {
  start(): Promise<void>;
  stop(): void;
  subscribe(callback: (event: NoteInputEvent) => void): () => void;
}

export interface MidiNoteMessage {
  kind: "note-on" | "note-off";
  midi: number;
  velocity: number;
  channel: number;
  occurredAtMs: number;
}

/** The damper pedal. Continuous pedals report a position; MIDI calls half of it down. */
export interface MidiSustainMessage {
  kind: "sustain";
  down: boolean;
  channel: number;
  occurredAtMs: number;
}

export type MidiMessage = MidiNoteMessage | MidiSustainMessage;
