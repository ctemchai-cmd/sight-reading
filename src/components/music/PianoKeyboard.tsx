"use client";

import { useMemo, useState, type PointerEvent } from "react";
import { formatNoteName, isNaturalMidi, midiToNotatedPitch } from "@/core/music/notes";
import { cn } from "@/lib/utils";

interface PianoKeyboardProps {
  minMidi: number;
  maxMidi: number;
  disabled?: boolean;
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
}

export function PianoKeyboard({ minMidi, maxMidi, disabled, onNoteOn, onNoteOff }: PianoKeyboardProps) {
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const keys = useMemo(
    () => Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => minMidi + index),
    [minMidi, maxMidi],
  );
  const whiteKeys = keys.filter(isNaturalMidi);

  const press = (event: PointerEvent<HTMLButtonElement>, midi: number) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPressed((current) => new Set(current).add(midi));
    onNoteOn(midi, 100);
  };

  const release = (event: PointerEvent<HTMLButtonElement>, midi: number) => {
    if (!pressed.has(midi)) return;
    event.preventDefault();
    setPressed((current) => {
      const next = new Set(current);
      next.delete(midi);
      return next;
    });
    onNoteOff(midi);
  };

  return (
    <div className="select-none overflow-x-auto rounded-xl overscroll-x-contain" aria-label="Virtual piano">
      <div
        className="relative flex h-40 w-full touch-pan-x overflow-hidden rounded-xl border border-slate-700 bg-slate-950 p-1 sm:h-48"
        style={{ minWidth: `${Math.max(320, whiteKeys.length * 42)}px` }}
      >
        {whiteKeys.map((midi) => (
          <button
            key={midi}
            aria-label={formatNoteName(midiToNotatedPitch(midi))}
            disabled={disabled}
            className={cn(
              "relative h-full min-w-10 flex-1 touch-none rounded-b-lg border border-slate-400 bg-slate-50 text-slate-500 shadow-inner transition-colors",
              pressed.has(midi) && "bg-teal-200",
            )}
            onPointerDown={(event) => press(event, midi)}
            onPointerUp={(event) => release(event, midi)}
            onPointerCancel={(event) => release(event, midi)}
          >
            {midi % 12 === 0 && <span className="absolute inset-x-0 bottom-2 text-xs">C{Math.floor(midi / 12) - 1}</span>}
          </button>
        ))}
        {keys.filter((midi) => !isNaturalMidi(midi)).map((midi) => {
          const whiteBefore = whiteKeys.filter((white) => white < midi).length;
          const left = (whiteBefore / whiteKeys.length) * 100;
          return (
            <button
              key={midi}
              aria-label={formatNoteName(midiToNotatedPitch(midi))}
              disabled={disabled}
              className={cn(
                "absolute top-1 z-10 h-[60%] w-[4.5%] max-w-9 touch-none -translate-x-1/2 rounded-b-md border border-black bg-slate-950 shadow-lg transition-colors",
                pressed.has(midi) && "bg-teal-600",
              )}
              style={{ left: `${left}%` }}
              onPointerDown={(event) => press(event, midi)}
              onPointerUp={(event) => release(event, midi)}
              onPointerCancel={(event) => release(event, midi)}
            />
          );
        })}
      </div>
    </div>
  );
}
