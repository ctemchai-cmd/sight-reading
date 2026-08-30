import { describe, expect, it } from "vitest";
import {
  KEY_NAMES,
  accidentalCount,
  isAccidentalImplied,
  isInKey,
  scaleDegrees,
  scaleMidisInRange,
  spellInKey,
} from "@/core/music/keys";
import { noteToMidi } from "@/core/music/notes";
import type { KeyName } from "@/types/music";

describe("key signatures", () => {
  it("spells each major scale with every letter used once", () => {
    for (const key of KEY_NAMES) {
      const letters = scaleDegrees(key).map((degree) => degree.letter);
      expect(new Set(letters).size, `${key} major reuses a letter`).toBe(7);
    }
  });

  it("derives the accidentals of the signature", () => {
    expect(scaleDegrees("C").every((degree) => degree.accidental === "natural")).toBe(true);
    expect(scaleDegrees("G").find((degree) => degree.letter === "F")?.accidental).toBe("sharp");
    expect(scaleDegrees("F").find((degree) => degree.letter === "B")?.accidental).toBe("flat");
    expect(accidentalCount("C")).toBe(0);
    expect(accidentalCount("G")).toBe(1);
    expect(accidentalCount("D")).toBe(2);
    expect(accidentalCount("F#")).toBe(6);
  });

  it("spells a sounding pitch the way the key writes it", () => {
    // The same key on the piano, written two ways depending on the signature.
    expect(spellInKey("G", 66)).toEqual({ letter: "F", accidental: "sharp", octave: 4 });
    expect(spellInKey("Db", 66)).toEqual({ letter: "G", accidental: "flat", octave: 4 });
    expect(spellInKey("C", 60)).toEqual({ letter: "C", accidental: "natural", octave: 4 });
  });

  it("round-trips every spelling back to the pitch it came from", () => {
    for (const key of KEY_NAMES) {
      for (const midi of scaleMidisInRange(key, 36, 96)) {
        expect(noteToMidi(spellInKey(key, midi)), `${key} at ${midi}`).toBe(midi);
      }
    }
  });

  it("gives seven notes an octave and rejects pitches outside the scale", () => {
    expect(scaleMidisInRange("C", 60, 71)).toEqual([60, 62, 64, 65, 67, 69, 71]);
    expect(scaleMidisInRange("G", 60, 71)).toEqual([60, 62, 64, 66, 67, 69, 71]);
    expect(isInKey("G", 65)).toBe(false); // F natural is not in G major
    expect(isInKey("G", 66)).toBe(true); // F sharp is
    expect(() => spellInKey("G", 65)).toThrow(RangeError);
  });

  it("knows when the signature already carries the accidental", () => {
    // Drawn without a sharp on the note head: the signature says F sharp.
    expect(isAccidentalImplied("G", { letter: "F", accidental: "sharp", octave: 4 })).toBe(true);
    // Needs a natural sign to cancel the signature.
    expect(isAccidentalImplied("G", { letter: "F", accidental: "natural", octave: 4 })).toBe(false);
    expect(isAccidentalImplied("C", { letter: "F", accidental: "natural", octave: 4 })).toBe(true);
  });

  it("covers every generated note in every key", () => {
    for (const key of KEY_NAMES as KeyName[]) {
      for (const midi of scaleMidisInRange(key, 53, 88)) {
        expect(isAccidentalImplied(key, spellInKey(key, midi)), `${key} at ${midi}`).toBe(true);
      }
    }
  });
});
