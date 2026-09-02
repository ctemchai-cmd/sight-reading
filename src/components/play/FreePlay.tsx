"use client";

import { Maximize2, Music4, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PianoKeyboard } from "@/components/music/PianoKeyboard";
import { FocusSurface } from "@/components/training/FocusSurface";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatNoteName, midiToNotatedPitch } from "@/core/music/notes";
import { useAudio } from "@/hooks/useAudio";
import { computerKeyboardGuide, useComputerKeyboard } from "@/hooks/useComputerKeyboard";
import { useFocusMode } from "@/hooks/useFocusMode";
import { useMidi } from "@/hooks/useMidi";
import { cn } from "@/lib/utils";
import type { NoteInputEvent } from "@/types/training";

/** How many of the most recent pitches to name back. */
const RECENT_NOTES = 8;
/** The board opens around middle C, where hands land without scrolling first. */
const OPENING_MIN_MIDI = 55;
const OPENING_MAX_MIDI = 72;

export function FreePlay() {
  const { engine, error, initialize } = useAudio();
  const { focusMode, setFocusMode, toggleFocusMode } = useFocusMode();
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [sustaining, setSustaining] = useState(false);
  const [heldCount, setHeldCount] = useState(0);
  const [recent, setRecent] = useState<number[]>([]);
  // What the input callbacks read lives on refs, so a re-render between a press
  // and its release cannot leave a note sounding — the trainers' rule.
  const soundOnRef = useRef(true);
  const startedRef = useRef(false);
  const sustainingRef = useRef(false);
  const heldRef = useRef(new Set<number>());

  useEffect(() => () => setFocusMode(false), [setFocusMode]);

  function noteOn(midi: number, velocity: number): void {
    if (!startedRef.current) return;
    if (soundOnRef.current) engine.current?.noteOn(midi, velocity);
    heldRef.current.add(midi);
    setHeldCount(heldRef.current.size);
    setRecent((current) => [midi, ...current].slice(0, RECENT_NOTES));
  }

  function noteOff(midi: number): void {
    if (startedRef.current && soundOnRef.current) engine.current?.noteOff(midi);
    heldRef.current.delete(midi);
    setHeldCount(heldRef.current.size);
  }

  function sustain(down: boolean): void {
    if (!startedRef.current) return;
    sustainingRef.current = down;
    if (soundOnRef.current) engine.current?.setSustain(down);
    setSustaining(down);
  }

  function handleInput(input: NoteInputEvent): void {
    noteOn(input.midi, input.velocity ?? 96);
  }

  useMidi(handleInput, noteOff, sustain);
  useComputerKeyboard(started, handleInput, noteOff);

  async function start(): Promise<void> {
    if (starting) return;
    setStarting(true);
    try {
      await initialize();
      startedRef.current = true;
      setStarted(true);
    } finally {
      setStarting(false);
    }
  }

  function toggleSound(): void {
    const next = !soundOn;
    soundOnRef.current = next;
    setSoundOn(next);
    if (!next) engine.current?.stopAll();
    else if (sustainingRef.current) engine.current?.setSustain(true);
  }

  const keyboard = (
    <PianoKeyboard
      trainingMinMidi={OPENING_MIN_MIDI}
      trainingMaxMidi={OPENING_MAX_MIDI}
      onNoteOn={noteOn}
      onNoteOff={noteOff}
    />
  );

  return (
    <FocusSurface
      active={focusMode}
      onExit={toggleFocusMode}
      className="note-training-layout mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8"
    >
      {focusMode ? (
        <>
          <p className="text-center text-sm text-slate-400" aria-live="polite">
            {sustaining ? "Pedal down" : " "}
          </p>
          <div className="note-training-inputs">{keyboard}</div>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Play</p>
              <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Free play</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Nothing is scored or recorded here. Play the keys below, a MIDI keyboard, or {computerKeyboardGuide}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={toggleSound} aria-pressed={soundOn}>
                {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                {soundOn ? "Sound on" : "Sound off"}
              </Button>
              <Button variant="secondary" onClick={toggleFocusMode} disabled={!started}>
                <Maximize2 className="size-4" /> Focus
              </Button>
            </div>
          </div>

          {error && <Card className="mt-6 border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</Card>}

          {!started ? (
            <Card className="mt-6 p-6 text-center sm:p-10">
              <Music4 className="mx-auto size-8 text-teal-300" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold text-white">Ready when you are</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                A browser only lets a page make sound once you have asked it to. The piano is already
                downloading, so this starts straight away.
              </p>
              <Button className="mt-5 w-full sm:w-auto" size="lg" onClick={() => void start()} disabled={starting}>
                <Music4 className="size-5" /> {starting ? "Starting…" : "Start playing"}
              </Button>
            </Card>
          ) : (
            <>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <Card className="flex items-center justify-between p-4">
                  <span className="text-sm text-slate-400">
                    Sustain pedal{heldCount > 0 ? ` · ${heldCount} held` : ""}
                  </span>
                  <span
                    aria-live="polite"
                    className={cn(
                      "rounded-lg px-3 py-1 text-sm font-semibold transition-colors",
                      sustaining ? "bg-teal-500 text-slate-950" : "bg-slate-800 text-slate-400",
                    )}
                  >
                    {sustaining ? "Down" : "Up"}
                  </span>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-slate-400">Last played</p>
                  <p className="mt-1 min-h-6 break-words font-semibold text-white">
                    {recent.length === 0
                      ? "—"
                      : recent.map((midi) => formatNoteName(midiToNotatedPitch(midi))).join("  ")}
                  </p>
                </Card>
              </div>

              <div className="note-training-inputs mt-4">
                <Card className="w-full p-3 sm:p-4">{keyboard}</Card>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">
                A note rings for as long as its recording lasts, about two and a half seconds. The pedal
                stops a note being cut off when you let the key go; it cannot make a sample ring for longer
                than it was recorded, so this will not sustain the way a real piano does.
              </p>
            </>
          )}
        </>
      )}
    </FocusSurface>
  );
}
