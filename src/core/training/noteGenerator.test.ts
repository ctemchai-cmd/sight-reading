import { describe, expect, it } from "vitest";
import { NoteGenerator } from "@/core/training/noteGenerator";

describe("NoteGenerator", () => {
  it("stays in range, emits naturals, and avoids immediate repeats", () => {
    const values = [0, 0, 0.5, 0.5, 0.9, 0.9];
    let index = 0;
    const generator = new NoteGenerator(
      { minMidi: 60, maxMidi: 67, adaptive: false, avoidImmediateRepeat: true },
      () => values[index++ % values.length],
    );
    const notes = generator.generateSequence(6).map((note) => note.expectedMidi);
    expect(notes.every((midi) => [60, 62, 64, 65, 67].includes(midi))).toBe(true);
    expect(notes.every((midi, noteIndex) => noteIndex === 0 || midi !== notes[noteIndex - 1])).toBe(true);
  });

  it("limits focused practice to the requested weak-note pool", () => {
    const generator = new NoteGenerator({ minMidi: 60, maxMidi: 72, adaptive: true, avoidImmediateRepeat: true, focusMidis: [60, 64, 67] }, () => 0.4);
    expect(generator.generateSequence(8).every((note) => [60, 64, 67].includes(note.expectedMidi))).toBe(true);
  });
});
