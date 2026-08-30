import { spellInKey } from "@/core/music/keys";
import type {
  Accidental,
  Clef,
  KeyName,
  MidiRange,
  NoteLetter,
  NotatedPitch,
  RangePreset,
  TargetNote,
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

/** A standard 61-key controller: C2 to C7, so the on-screen board matches the hardware. */
export const STANDARD_KEYBOARD_RANGE: MidiRange = { minMidi: 36, maxMidi: 96 };

/**
 * Each preset is the staff itself plus that many ledger lines either side, so a
 * bass preset asks the same of the reader as the treble one of the same name.
 */
export const CLEF_RANGES: Record<Clef, Record<Exclude<RangePreset, "custom">, MidiRange>> = {
  treble: {
    staff: { minMidi: 64, maxMidi: 77 }, // E4-F5
    "ledger-1": { minMidi: 60, maxMidi: 81 }, // C4-A5
    "ledger-2": { minMidi: 57, maxMidi: 84 }, // A3-C6
    "ledger-3": { minMidi: 53, maxMidi: 88 }, // F3-E6
  },
  bass: {
    staff: { minMidi: 43, maxMidi: 57 }, // G2-A3
    "ledger-1": { minMidi: 40, maxMidi: 60 }, // E2-C4
    "ledger-2": { minMidi: 36, maxMidi: 64 }, // C2-E4
    "ledger-3": { minMidi: 33, maxMidi: 67 }, // A1-G4
  },
};

/** The pitch sitting on the lowest line of each staff. */
const BOTTOM_LINE: Record<Clef, NotatedPitch> = {
  treble: { letter: "E", accidental: "natural", octave: 4 },
  bass: { letter: "G", accidental: "natural", octave: 2 },
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

export function createTargetNote(midi: number, key: KeyName = "C", id = crypto.randomUUID()): TargetNote {
  return { id, expectedMidi: midi, notation: spellInKey(key, midi) };
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

/** Steps above the staff's bottom line, counting lines and spaces alike. */
export function getStaffPosition(clef: Clef, note: NotatedPitch): number {
  return diatonicIndex(note) - diatonicIndex(BOTTOM_LINE[clef]);
}

export function getLedgerLineCount(clef: Clef, note: NotatedPitch): number {
  const position = getStaffPosition(clef, note);
  if (position < 0) return Math.floor(Math.abs(position) / 2);
  if (position > 8) return Math.floor((position - 8) / 2);
  return 0;
}

export function resolveRange(clef: Clef, preset: RangePreset, custom?: MidiRange): MidiRange {
  if (preset === "custom") {
    if (!custom) throw new Error("Custom range requires minMidi and maxMidi.");
    return custom;
  }
  return CLEF_RANGES[clef][preset];
}

export function formatClef(clef: Clef): string {
  return clef === "bass" ? "Bass" : "Treble";
}
