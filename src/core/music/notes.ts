import type {
  Accidental,
  MidiRange,
  NoteLetter,
  NotatedPitch,
  TargetNote,
  TrebleRangePreset,
} from "@/types/music";

const LETTERS: NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_SEMITONES: Record<NoteLetter, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const SHARP_SPELLINGS: Array<[NoteLetter, Accidental]> = [
  ["C", "natural"],
  ["C", "sharp"],
  ["D", "natural"],
  ["D", "sharp"],
  ["E", "natural"],
  ["F", "natural"],
  ["F", "sharp"],
  ["G", "natural"],
  ["G", "sharp"],
  ["A", "natural"],
  ["A", "sharp"],
  ["B", "natural"],
];
const FLAT_SPELLINGS: Array<[NoteLetter, Accidental]> = [
  ["C", "natural"],
  ["D", "flat"],
  ["D", "natural"],
  ["E", "flat"],
  ["E", "natural"],
  ["F", "natural"],
  ["G", "flat"],
  ["G", "natural"],
  ["A", "flat"],
  ["A", "natural"],
  ["B", "flat"],
  ["B", "natural"],
];

export const TREBLE_RANGES: Record<Exclude<TrebleRangePreset, "custom">, MidiRange> = {
  staff: { minMidi: 64, maxMidi: 77 },
  "ledger-1": { minMidi: 60, maxMidi: 81 },
  "ledger-2": { minMidi: 57, maxMidi: 84 },
  "ledger-3": { minMidi: 53, maxMidi: 88 },
};

function assertMidi(midi: number): void {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) {
    throw new RangeError(`MIDI note must be an integer between 0 and 127. Received ${midi}.`);
  }
}

export function noteToMidi(note: NotatedPitch): number {
  const accidentalOffset = note.accidental === "sharp" ? 1 : note.accidental === "flat" ? -1 : 0;
  const midi = (note.octave + 1) * 12 + NATURAL_SEMITONES[note.letter] + accidentalOffset;
  assertMidi(midi);
  return midi;
}

export function midiToNotatedPitch(midi: number, preference: "sharp" | "flat" = "sharp"): NotatedPitch {
  assertMidi(midi);
  const pitchClass = midi % 12;
  const [letter, accidental] = (preference === "sharp" ? SHARP_SPELLINGS : FLAT_SPELLINGS)[pitchClass];
  return { letter, accidental, octave: Math.floor(midi / 12) - 1 };
}

export function createTargetNote(midi: number, id = crypto.randomUUID()): TargetNote {
  return { id, expectedMidi: midi, notation: midiToNotatedPitch(midi) };
}

export function notationToVexFlowKey(note: NotatedPitch): string {
  return `${note.letter.toLowerCase()}/${note.octave}`;
}

export function accidentalToVexFlow(note: NotatedPitch): "#" | "b" | "n" | null {
  if (note.accidental === "sharp") return "#";
  if (note.accidental === "flat") return "b";
  return null;
}

export function formatNoteName(note: NotatedPitch): string {
  const symbol = note.accidental === "sharp" ? "♯" : note.accidental === "flat" ? "♭" : "";
  return `${note.letter}${symbol}${note.octave}`;
}

export function isNaturalMidi(midi: number): boolean {
  assertMidi(midi);
  return [0, 2, 4, 5, 7, 9, 11].includes(midi % 12);
}

export function naturalMidisInRange(minMidi: number, maxMidi: number): number[] {
  assertMidi(minMidi);
  assertMidi(maxMidi);
  if (minMidi > maxMidi) throw new RangeError("Minimum MIDI note must not exceed maximum MIDI note.");

  return Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => minMidi + index).filter(isNaturalMidi);
}

function diatonicIndex(note: NotatedPitch): number {
  return note.octave * 7 + LETTERS.indexOf(note.letter);
}

export function getTrebleStaffPosition(note: NotatedPitch): number {
  const bottomLine = diatonicIndex({ letter: "E", accidental: "natural", octave: 4 });
  return diatonicIndex(note) - bottomLine;
}

export function getTrebleLedgerLineCount(note: NotatedPitch): number {
  const position = getTrebleStaffPosition(note);
  if (position < 0) return Math.floor(Math.abs(position) / 2);
  if (position > 8) return Math.floor((position - 8) / 2);
  return 0;
}

export function resolveTrebleRange(preset: TrebleRangePreset, custom?: MidiRange): MidiRange {
  if (preset === "custom") {
    if (!custom) throw new Error("Custom range requires minMidi and maxMidi.");
    return custom;
  }
  return TREBLE_RANGES[preset];
}
