export type NoteLetter = "C" | "D" | "E" | "F" | "G" | "A" | "B";
export type Accidental = "flat" | "natural" | "sharp";
export type Clef = "treble" | "bass";
/** Major keys, written the way a key signature names them. */
export type KeyName =
  | "C"
  | "G"
  | "F"
  | "D"
  | "Bb"
  | "A"
  | "Eb"
  | "E"
  | "Ab"
  | "B"
  | "Db"
  | "F#"
  | "Gb";
export type MidiNumber = number;

export interface NotatedPitch {
  letter: NoteLetter;
  accidental: Accidental;
  octave: number;
}

export interface TargetNote {
  id: string;
  notation: NotatedPitch;
  expectedMidi: MidiNumber;
}

export type NoteDuration = "w" | "h" | "q" | "8" | "16";

export interface ScoreNote {
  id: string;
  pitch: TargetNote;
  duration: NoteDuration;
  dotted?: boolean;
}

export interface Measure {
  id: string;
  notes: ScoreNote[];
}

export interface Score {
  clef: Clef;
  beatsPerMeasure: number;
  beatValue: number;
  measures: Measure[];
}

/** The staff itself, plus that many ledger lines either side of it. */
export type RangePreset = "staff" | "ledger-1" | "ledger-2" | "ledger-3" | "custom";

export interface MidiRange {
  minMidi: number;
  maxMidi: number;
}
