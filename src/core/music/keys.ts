import type { Accidental, KeyName, NotatedPitch, NoteLetter } from "@/types/music";

const LETTERS: NoteLetter[] = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL_SEMITONES: Record<NoteLetter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
/** Semitones above the tonic for each degree of a major scale. */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

function offsetOf(accidental: Accidental): number {
  return accidental === "sharp" ? 1 : accidental === "flat" ? -1 : 0;
}

interface Tonic {
  letter: NoteLetter;
  accidental: Accidental;
}

/**
 * Ordered by how many accidentals the signature carries, which is also roughly
 * how hard it is to read.
 */
export const MAJOR_KEYS: Record<KeyName, Tonic> = {
  C: { letter: "C", accidental: "natural" },
  G: { letter: "G", accidental: "natural" },
  F: { letter: "F", accidental: "natural" },
  D: { letter: "D", accidental: "natural" },
  Bb: { letter: "B", accidental: "flat" },
  A: { letter: "A", accidental: "natural" },
  Eb: { letter: "E", accidental: "flat" },
  E: { letter: "E", accidental: "natural" },
  Ab: { letter: "A", accidental: "flat" },
  B: { letter: "B", accidental: "natural" },
  Db: { letter: "D", accidental: "flat" },
  "F#": { letter: "F", accidental: "sharp" },
  Gb: { letter: "G", accidental: "flat" },
};

export const KEY_NAMES = Object.keys(MAJOR_KEYS) as KeyName[];

/**
 * The seven letters of the scale with the accidental the key signature gives
 * each one. Derived rather than tabulated: a major scale uses each letter once,
 * so the accidental is whatever closes the gap between the letter's natural
 * pitch and the degree the scale needs.
 */
export function scaleDegrees(key: KeyName): Array<{ letter: NoteLetter; accidental: Accidental }> {
  const tonic = MAJOR_KEYS[key];
  const tonicIndex = LETTERS.indexOf(tonic.letter);
  const tonicPitchClass = (NATURAL_SEMITONES[tonic.letter] + offsetOf(tonic.accidental) + 12) % 12;

  return MAJOR_STEPS.map((step, degree) => {
    const letter = LETTERS[(tonicIndex + degree) % LETTERS.length];
    const required = (tonicPitchClass + step) % 12;
    let delta = (required - NATURAL_SEMITONES[letter] + 12) % 12;
    if (delta > 6) delta -= 12;
    return { letter, accidental: delta === 1 ? "sharp" : delta === -1 ? "flat" : "natural" };
  });
}

function pitchClassesOf(key: KeyName): Set<number> {
  return new Set(
    scaleDegrees(key).map(
      ({ letter, accidental }) => (NATURAL_SEMITONES[letter] + offsetOf(accidental) + 12) % 12,
    ),
  );
}

export function isInKey(key: KeyName, midi: number): boolean {
  return pitchClassesOf(key).has(((midi % 12) + 12) % 12);
}

/**
 * Spells a sounding pitch the way the key writes it, so G major reaches for F
 * sharp rather than G flat. The octave is solved from the spelling so that it
 * round-trips back to the same MIDI number.
 */
export function spellInKey(key: KeyName, midi: number): NotatedPitch {
  const pitchClass = ((midi % 12) + 12) % 12;
  const degree = scaleDegrees(key).find(
    ({ letter, accidental }) => (NATURAL_SEMITONES[letter] + offsetOf(accidental) + 12) % 12 === pitchClass,
  );
  if (!degree) throw new RangeError(`MIDI note ${midi} is not part of ${key} major.`);

  const octave = (midi - NATURAL_SEMITONES[degree.letter] - offsetOf(degree.accidental)) / 12 - 1;
  return { letter: degree.letter, accidental: degree.accidental, octave };
}

export function scaleMidisInRange(key: KeyName, minMidi: number, maxMidi: number): number[] {
  if (minMidi > maxMidi) throw new RangeError("Minimum MIDI note must not exceed maximum MIDI note.");
  return Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => minMidi + index).filter((midi) =>
    isInKey(key, midi),
  );
}

/**
 * Whether the key signature already carries this note's accidental, in which
 * case the note head must be drawn without one.
 */
export function isAccidentalImplied(key: KeyName, note: NotatedPitch): boolean {
  const degree = scaleDegrees(key).find(({ letter }) => letter === note.letter);
  return degree?.accidental === note.accidental;
}

export function formatKeyName(key: KeyName): string {
  return key.replace("#", "♯").replace("b", "♭");
}

/** How many sharps or flats the signature draws, for ordering by difficulty. */
export function accidentalCount(key: KeyName): number {
  return scaleDegrees(key).filter(({ accidental }) => accidental !== "natural").length;
}

/** Reads the signature aloud: "2 sharps", "1 flat", "no sharps or flats". */
export function describeKey(key: KeyName): string {
  const written = scaleDegrees(key).filter(({ accidental }) => accidental !== "natural");
  if (written.length === 0) return "no sharps or flats";
  const kind = written[0].accidental === "sharp" ? "sharp" : "flat";
  return `${written.length} ${kind}${written.length === 1 ? "" : "s"}`;
}

/** Picks a key for a session set to random. */
export function randomKey(random: () => number = Math.random): KeyName {
  return KEY_NAMES[Math.floor(random() * KEY_NAMES.length)];
}

/** The key that spells the most of these pitches, for drilling a chosen set. */
export function keyCovering(midis: number[]): KeyName {
  if (midis.length === 0) return "C";
  return KEY_NAMES.reduce((chosen, key) => (
    midis.filter((midi) => isInKey(key, midi)).length > midis.filter((midi) => isInKey(chosen, midi)).length
      ? key
      : chosen
  ), KEY_NAMES[0]);
}
