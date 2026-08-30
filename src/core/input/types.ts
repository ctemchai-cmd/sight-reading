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
