"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  STANDARD_KEYBOARD_RANGE,
  formatNoteName,
  isNaturalMidi,
  midiToNotatedPitch,
} from "@/core/music/notes";
import { cn } from "@/lib/utils";

// Keys are sized so about two octaves fill the width, whatever the screen: any
// more and they read as slivers on a tablet. The rest of the board scrolls.
const VISIBLE_WHITE_KEYS = 14;
// Below this a key stops being a usable touch target, so narrow phones show
// less than two octaves rather than shrinking further.
const WHITE_KEY_MIN_PX = 32;
// A black key covers a little over half the width of a white one.
const BLACK_KEY_RATIO = 0.58;
const WHITE_KEYS_PER_OCTAVE = 7;
const SCROLL_BUTTON_CLASS =
  "absolute top-1/2 z-20 grid size-8 -translate-y-1/2 place-items-center rounded-full border border-slate-600 bg-slate-950/80 text-slate-300 opacity-70 shadow-lg transition hover:opacity-100 focus-visible:opacity-100";

interface PianoKeyboardProps {
  /**
   * The range being trained. The board always shows the full 61 keys; this is
   * what it scrolls to centre on, so the notes in play start in view.
   */
  trainingMinMidi: number;
  trainingMaxMidi: number;
  disabled?: boolean;
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
}

export function PianoKeyboard({
  trainingMinMidi,
  trainingMaxMidi,
  disabled,
  onNoteOn,
  onNoteOff,
}: PianoKeyboardProps) {
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const [viewportWidth, setViewportWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { whiteKeys, blackKeys } = useMemo(() => {
    const { minMidi, maxMidi } = STANDARD_KEYBOARD_RANGE;
    const all = Array.from({ length: maxMidi - minMidi + 1 }, (_, index) => minMidi + index);
    return { whiteKeys: all.filter(isNaturalMidi), blackKeys: all.filter((midi) => !isNaturalMidi(midi)) };
  }, []);

  const keyWidth = Math.max(WHITE_KEY_MIN_PX, Math.round(viewportWidth / VISIBLE_WHITE_KEYS));
  const boardWidth = whiteKeys.length * keyWidth;
  const scrollable = viewportWidth > 0 && boardWidth > viewportWidth + 1;

  // Black keys sit at a percentage of the box the white keys fill, so the
  // scroll anchor has to be a white key.
  const anchorMidi = useMemo(() => {
    const centre = (trainingMinMidi + trainingMaxMidi) / 2;
    return whiteKeys.reduce(
      (best, midi) => (Math.abs(midi - centre) < Math.abs(best - centre) ? midi : best),
      whiteKeys[0],
    );
  }, [trainingMaxMidi, trainingMinMidi, whiteKeys]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    // Wait a frame so flex has settled and the key offsets are real.
    const frame = requestAnimationFrame(() => {
      const key = scroller.querySelector<HTMLElement>(`[data-midi="${anchorMidi}"]`);
      if (!key) return;
      scroller.scrollLeft = key.offsetLeft + key.offsetWidth / 2 - scroller.clientWidth / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [anchorMidi, keyWidth]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(() => setViewportWidth(scroller.clientWidth));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const scrollByOctave = (direction: 1 | -1) => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const octave = keyWidth * WHITE_KEYS_PER_OCTAVE;
    scroller.scrollBy({ left: direction * octave, behavior: "smooth" });
  };

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
    <div className="responsive-piano-surface relative h-40 select-none sm:h-48">
      <div
        ref={scrollRef}
        className="h-full overflow-x-auto overscroll-x-contain rounded-xl border border-slate-700 bg-slate-950"
        aria-label="Virtual piano"
      >
        <div className="relative flex h-full w-full" style={{ minWidth: boardWidth }}>
          {whiteKeys.map((midi) => (
            <button
              key={midi}
              data-midi={midi}
              aria-label={formatNoteName(midiToNotatedPitch(midi))}
              disabled={disabled}
              style={{ minWidth: keyWidth }}
              className={cn(
                "relative h-full flex-1 touch-none rounded-b-lg border border-slate-400 bg-slate-50 text-slate-500 shadow-inner transition-colors",
                pressed.has(midi) && "bg-teal-200",
              )}
              onPointerDown={(event) => press(event, midi)}
              onPointerUp={(event) => release(event, midi)}
              onPointerCancel={(event) => release(event, midi)}
            >
              {midi % 12 === 0 && (
                <span className="absolute inset-x-0 bottom-2 text-xs">C{Math.floor(midi / 12) - 1}</span>
              )}
            </button>
          ))}
          {blackKeys.map((midi) => {
            const whiteBefore = whiteKeys.filter((white) => white < midi).length;
            return (
              <button
                key={midi}
                data-midi={midi}
                aria-label={formatNoteName(midiToNotatedPitch(midi))}
                disabled={disabled}
                style={{
                  left: `${(whiteBefore / whiteKeys.length) * 100}%`,
                  width: `${(100 / whiteKeys.length) * BLACK_KEY_RATIO}%`,
                }}
                className={cn(
                  "absolute top-0 z-10 h-[60%] -translate-x-1/2 touch-none rounded-b-md border border-black bg-slate-950 shadow-lg transition-colors",
                  pressed.has(midi) && "bg-teal-600",
                )}
                onPointerDown={(event) => press(event, midi)}
                onPointerUp={(event) => release(event, midi)}
                onPointerCancel={(event) => release(event, midi)}
              />
            );
          })}
        </div>
      </div>
      {/* Keys keep touch-action none so a press is never mistaken for a pan —
          a pan that fires a note would score a wrong answer — so panning gets
          its own controls. */}
      {scrollable && (
        <>
          <button
            type="button"
            aria-label="Scroll keyboard down an octave"
            onClick={() => scrollByOctave(-1)}
            className={cn(SCROLL_BUTTON_CLASS, "left-1.5")}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Scroll keyboard up an octave"
            onClick={() => scrollByOctave(1)}
            className={cn(SCROLL_BUTTON_CLASS, "right-1.5")}
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
