import type { Measure, Score, TargetNote } from "@/types/music";

export function createQuarterNoteScore(notes: TargetNote[], notesPerMeasure = 4): Score {
  const measures: Measure[] = [];
  for (let index = 0; index < notes.length; index += notesPerMeasure) {
    measures.push({
      id: crypto.randomUUID(),
      notes: notes.slice(index, index + notesPerMeasure).map((pitch) => ({
        id: crypto.randomUUID(),
        pitch,
        duration: "q",
      })),
    });
  }
  return { clef: "treble", beatsPerMeasure: 4, beatValue: 4, measures };
}
