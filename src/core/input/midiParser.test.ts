import { describe, expect, it } from "vitest";
import { parseMidiMessage } from "@/core/input/midiParser";

describe("MIDI parser", () => {
  it("parses note-on across channels", () => {
    expect(parseMidiMessage([0x95, 60, 84], 123)).toEqual({ kind: "note-on", midi: 60, velocity: 84, channel: 5, occurredAtMs: 123 });
  });

  it("parses explicit and velocity-zero note-off", () => {
    expect(parseMidiMessage([0x80, 60, 30], 1)?.kind).toBe("note-off");
    expect(parseMidiMessage([0x90, 60, 0], 1)?.kind).toBe("note-off");
  });

  it("parses sustain pedal changes across channels at the MIDI midpoint", () => {
    expect(parseMidiMessage([0xb3, 64, 63], 10)).toEqual({
      kind: "sustain",
      down: false,
      channel: 3,
      occurredAtMs: 10,
    });
    expect(parseMidiMessage([0xbf, 64, 64], 11)).toEqual({
      kind: "sustain",
      down: true,
      channel: 15,
      occurredAtMs: 11,
    });
  });

  it("ignores unrelated or malformed messages", () => {
    expect(parseMidiMessage([0xb0, 65, 127], 1)).toBeNull();
    expect(parseMidiMessage([0x90, 60], 1)).toBeNull();
  });
});
