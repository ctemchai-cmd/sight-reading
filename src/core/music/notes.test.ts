import { describe, expect, it } from "vitest";
import {
  getLedgerLineCount,
  getStaffPosition,
  resolveRange,
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
    expect(getLedgerLineCount("treble", midiToNotatedPitch(62))).toBe(0); // D4, space below staff
    expect(getLedgerLineCount("treble", midiToNotatedPitch(60))).toBe(1); // C4
    expect(getLedgerLineCount("treble", midiToNotatedPitch(59))).toBe(1); // B3
    expect(getLedgerLineCount("treble", midiToNotatedPitch(57))).toBe(2); // A3
    expect(getLedgerLineCount("treble", midiToNotatedPitch(79))).toBe(0); // G5, space above staff
    expect(getLedgerLineCount("treble", midiToNotatedPitch(81))).toBe(1); // A5
    expect(getLedgerLineCount("treble", midiToNotatedPitch(84))).toBe(2); // C6
  });

  it("classifies bass ledger lines against its own staff", () => {
    expect(getStaffPosition("bass", midiToNotatedPitch(43))).toBe(0); // G2 sits on the bottom line
    expect(getStaffPosition("bass", midiToNotatedPitch(57))).toBe(8); // A3 on the top line
    expect(getLedgerLineCount("bass", midiToNotatedPitch(50))).toBe(0); // D3, inside the staff
    expect(getLedgerLineCount("bass", midiToNotatedPitch(60))).toBe(1); // middle C, one above
    expect(getLedgerLineCount("bass", midiToNotatedPitch(40))).toBe(1); // E2, one below
    expect(getLedgerLineCount("bass", midiToNotatedPitch(36))).toBe(2); // C2
  });

  it("gives each clef the same reading task for the same preset", () => {
    for (const clef of ["treble", "bass"] as const) {
      for (const preset of ["staff", "ledger-1", "ledger-2", "ledger-3"] as const) {
        const { minMidi, maxMidi } = resolveRange(clef, preset);
        const ledgers = preset === "staff" ? 0 : Number(preset.slice(-1));
        expect(getLedgerLineCount(clef, midiToNotatedPitch(minMidi)), `${clef} ${preset} low`).toBe(ledgers);
        expect(getLedgerLineCount(clef, midiToNotatedPitch(maxMidi)), `${clef} ${preset} high`).toBe(ledgers);
      }
    }
  });

  it("returns only naturals inside an inclusive range", () => {
    expect(naturalMidisInRange(60, 64)).toEqual([60, 62, 64]);
    expect(() => naturalMidisInRange(64, 60)).toThrow(RangeError);
  });
});
