import { describe, expect, it } from "vitest";
import { NoteGenerator } from "@/core/training/noteGenerator";

describe("NoteGenerator", () => {
  it("stays in range, emits naturals, and avoids immediate repeats", () => {
    const values = [0, 0, 0.5, 0.5, 0.9, 0.9];
    let index = 0;
    const generator = new NoteGenerator(
      { minMidi: 60, maxMidi: 67, keySignature: "C", melodicShape: "random", adaptive: false, avoidImmediateRepeat: true },
      () => values[index++ % values.length],
    );
    const notes = generator.generateSequence(6).map((note) => note.expectedMidi);
    expect(notes.every((midi) => [60, 62, 64, 65, 67].includes(midi))).toBe(true);
    expect(notes.every((midi, noteIndex) => noteIndex === 0 || midi !== notes[noteIndex - 1])).toBe(true);
  });

  it("draws only from the notes of the key it was given", () => {
    const generator = new NoteGenerator(
      { minMidi: 60, maxMidi: 72, keySignature: "G", melodicShape: "random", adaptive: false, avoidImmediateRepeat: true },
      () => 0.35,
    );
    const notes = generator.generateSequence(12).map((note) => note.expectedMidi);
    // G major has F sharp (66) and never plain F (65).
    expect(notes.every((midi) => [60, 62, 64, 66, 67, 69, 71, 72].includes(midi))).toBe(true);
    expect(notes.includes(65)).toBe(false);
  });

  it("spells generated notes the way the key writes them", () => {
    const generator = new NoteGenerator(
      { minMidi: 66, maxMidi: 66, keySignature: "G", melodicShape: "random", adaptive: false, avoidImmediateRepeat: false },
      () => 0,
    );
    expect(generator.generate().notation).toEqual({ letter: "F", accidental: "sharp", octave: 4 });
  });

  it("walks by scale degree when given a melodic shape", () => {
    const generator = new NoteGenerator(
      { minMidi: 60, maxMidi: 84, keySignature: "C", melodicShape: "steps", adaptive: false, avoidImmediateRepeat: true },
      () => 0.55,
    );
    const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
    const notes = generator.generateSequence(12).map((note) => note.expectedMidi);
    const gaps = notes.slice(1).map((midi, index) => Math.abs(scale.indexOf(midi) - scale.indexOf(notes[index])));
    // Steps move one or two scale degrees; the odd larger gap is a new phrase.
    expect(gaps.filter((gap) => gap > 2).length).toBeLessThanOrEqual(2);
    expect(gaps.every((gap) => gap > 0)).toBe(true);
  });

  it("limits focused practice to the requested weak-note pool", () => {
    const generator = new NoteGenerator({ minMidi: 60, maxMidi: 72, keySignature: "C", melodicShape: "random", adaptive: true, avoidImmediateRepeat: true, focusMidis: [60, 64, 67] }, () => 0.4);
    expect(generator.generateSequence(8).every((note) => [60, 64, 67].includes(note.expectedMidi))).toBe(true);
  });
});
