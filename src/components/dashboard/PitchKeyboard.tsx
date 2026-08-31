"use client";

import { useMemo } from "react";
import { fluencyColor } from "@/core/training/fluency";
import {
  STANDARD_KEYBOARD_RANGE,
  formatNoteName,
  isNaturalMidi,
  midiToNotatedPitch,
} from "@/core/music/notes";
import { cn } from "@/lib/utils";

const WHITE_KEY_MIN_PX = 26;
const BLACK_KEY_RATIO = 0.58;

export interface KeyReading {
  /** Nothing recorded for this pitch yet, so it is left uncoloured. */
  fluency: number | null;
  label: string;
}

interface PitchKeyboardProps {
  /** Keyed by MIDI number; pitches absent from the map are shown unpractised. */
  readings: Map<number, KeyReading>;
}

/**
 * The same board the player reaches for, coloured by how each pitch is read.
 * A grid of note names asked them to translate twice — from the name to the
 * key, and only then to the hand.
 */
export function PitchKeyboard({ readings }: PitchKeyboardProps) {
  const { whiteKeys, blackKeys } = useMemo(() => {
    const { minMidi, maxMidi } = STANDARD_KEYBOARD_RANGE;
    const all = Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => minMidi + index);
    return { whiteKeys: all.filter(isNaturalMidi), blackKeys: all.filter((midi) => !isNaturalMidi(midi)) };
  }, []);

  const tint = (midi: number, natural: boolean) => {
    const reading = readings.get(midi);
    if (!reading || reading.fluency === null) return undefined;
    // Black keys carry the colour more strongly; the same wash reads as muddy
    // against their own dark ground.
    return fluencyColor(reading.fluency, natural ? 0.85 : 1);
  };

  return (
    <div className="select-none overflow-x-auto overscroll-x-contain rounded-xl border border-slate-700 bg-slate-950">
      <div className="relative flex h-28 sm:h-32" style={{ minWidth: whiteKeys.length * WHITE_KEY_MIN_PX }}>
        {whiteKeys.map((midi) => {
          const reading = readings.get(midi);
          const name = formatNoteName(midiToNotatedPitch(midi));
          return (
            <div
              key={midi}
              title={reading?.label ?? `${name} · not practised`}
              style={{ minWidth: WHITE_KEY_MIN_PX, backgroundColor: tint(midi, true) }}
              className="relative h-full flex-1 rounded-b-lg border border-slate-400 bg-slate-50"
            >
              {midi % 12 === 0 && (
                <span className="absolute inset-x-0 bottom-1 text-center text-[10px] text-slate-500">{name}</span>
              )}
            </div>
          );
        })}
        {blackKeys.map((midi) => {
          const whiteBefore = whiteKeys.filter((white) => white < midi).length;
          const reading = readings.get(midi);
          return (
            <div
              key={midi}
              title={reading?.label ?? `${formatNoteName(midiToNotatedPitch(midi))} · not practised`}
              style={{
                left: `${(whiteBefore / whiteKeys.length) * 100}%`,
                width: `${(100 / whiteKeys.length) * BLACK_KEY_RATIO}%`,
                backgroundColor: tint(midi, false),
              }}
              className={cn(
                "absolute top-0 z-10 h-[60%] -translate-x-1/2 rounded-b-md border border-black bg-slate-950",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
