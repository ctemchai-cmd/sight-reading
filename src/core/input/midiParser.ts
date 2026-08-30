import type { MidiNoteMessage } from "@/core/input/types";

export function parseMidiMessage(data: ArrayLike<number>, occurredAtMs: number): MidiNoteMessage | null {
  if (data.length < 3) return null;
  const status = data[0];
  const command = status & 0xf0;
  const channel = status & 0x0f;
  const midi = data[1];
  const velocity = data[2];

  if (midi < 0 || midi > 127 || velocity < 0 || velocity > 127) return null;
  if (command === 0x90) {
    return {
      kind: velocity === 0 ? "note-off" : "note-on",
      midi,
      velocity,
      channel,
      occurredAtMs,
    };
  }
  if (command === 0x80) return { kind: "note-off", midi, velocity, channel, occurredAtMs };
  return null;
}
