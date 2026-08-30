import { describe, expect, it } from "vitest";
import {
  getTrebleLedgerLineCount,
  midiToNotatedPitch,
  naturalMidisInRange,
  noteToMidi,
  notationToVexFlowKey,
} from "@/core/music/notes";

describe("music note conversion", () => {
  it("converts scientific pitch notation to MIDI", () => {
    expect(noteToMidi({ letter: "C", accidental: "natural", octave: 4 })).toBe(60);
    expect(noteToMidi({ letter: "C", accidental: "sharp", octave: 4 })).toBe(61);
    expect(noteToMidi({ letter: "D", accidental: "flat", octave: 4 })).toBe(61);
  });

  it("keeps written spelling separate from MIDI", () => {
    expect(midiToNotatedPitch(61, "sharp")).toEqual({ letter: "C", accidental: "sharp", octave: 4 });
    expect(midiToNotatedPitch(61, "flat")).toEqual({ letter: "D", accidental: "flat", octave: 4 });
    expect(notationToVexFlowKey(midiToNotatedPitch(60))).toBe("c/4");
  });

  it("classifies treble ledger lines", () => {
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(62))).toBe(0); // D4, space below staff
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(60))).toBe(1); // C4
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(59))).toBe(1); // B3
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(57))).toBe(2); // A3
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(79))).toBe(0); // G5, space above staff
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(81))).toBe(1); // A5
    expect(getTrebleLedgerLineCount(midiToNotatedPitch(84))).toBe(2); // C6
  });

  it("returns only naturals inside an inclusive range", () => {
    expect(naturalMidisInRange(60, 64)).toEqual([60, 62, 64]);
    expect(() => naturalMidisInRange(64, 60)).toThrow(RangeError);
  });
});
