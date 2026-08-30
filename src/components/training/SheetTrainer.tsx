"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { MusicStaff } from "@/components/music/MusicStaff";
import { PianoKeyboard } from "@/components/music/PianoKeyboard";
import { MidiPanel } from "@/components/midi/MidiPanel";
import { SessionResult } from "@/components/training/SessionResult";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TREBLE_RANGES } from "@/core/music/notes";
import { createQuarterNoteScore } from "@/core/music/score";
import { NoteGenerator } from "@/core/training/noteGenerator";
import { summarizeTraining } from "@/core/training/scoring";
import { applyInputToTrial, createOpenTrial, type OpenTrial } from "@/core/training/session";
import { useAudio } from "@/hooks/useAudio";
import { useComputerKeyboard } from "@/hooks/useComputerKeyboard";
import { useMidi } from "@/hooks/useMidi";
import { persistTrainingSession } from "@/lib/sessionPersistence";
import type { Score, TrebleRangePreset } from "@/types/music";
import type { NoteInputEvent, TrainingSessionConfig, TrainingSessionRecord, TrainingSummary, TrainingTrial } from "@/types/training";

type Phase = "configure" | "running" | "paused" | "complete";

export function SheetTrainer() {
  const [phase, setPhase] = useState<Phase>("configure");
  const phaseRef = useRef<Phase>("configure");
  const [rangePreset, setRangePreset] = useState<TrebleRangePreset>("ledger-1");
  const [score, setScore] = useState<Score | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const indexRef = useRef(0);
  const [trials, setTrials] = useState<TrainingTrial[]>([]);
  const trialsRef = useRef<TrainingTrial[]>([]);
  const openTrialRef = useRef<OpenTrial | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [armNonce, setArmNonce] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saving" | "pending" | "synced">("saving");
  const startedAtRef = useRef("");
  const armedRef = useRef(false);
  const { engine, initialize: initializeAudio, error: audioError } = useAudio();
  const range = rangePreset === "custom" ? TREBLE_RANGES["ledger-1"] : TREBLE_RANGES[rangePreset];
  const notes = useMemo(
    () => score?.measures.flatMap((measure) => measure.notes.map((note) => note.pitch)) ?? [],
    [score],
  );

  const config = useCallback((): TrainingSessionConfig => ({
    mode: "sheet",
    clef: "treble",
    rangePreset,
    ...range,
    sessionLength: 16,
    adaptive: false,
    soundEnabled: true,
    midiSoundEnabled: false,
    computerKeyboardEnabled: true,
    nextNoteDelayMs: 0,
  }), [range, rangePreset]);

  const finish = useCallback(async (completedTrials: TrainingTrial[]) => {
    phaseRef.current = "complete";
    setPhase("complete");
    const nextSummary = summarizeTraining(completedTrials);
    setSummary(nextSummary);
    setSaveStatus("saving");
    const session: TrainingSessionRecord = {
      id: crypto.randomUUID(),
      mode: "sheet",
      config: config(),
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
      endReason: "target-reached",
      summary: nextSummary,
      trials: completedTrials,
      syncStatus: "local",
    };
    setSaveStatus(await persistTrainingSession(session));
  }, [config]);

  const handleInput = (input: NoteInputEvent) => {
    if (input.source !== "midi") engine.current?.playNote(input.midi, input.velocity ?? 96);
    if (phaseRef.current !== "running" || !armedRef.current || !openTrialRef.current) return;
    const result = applyInputToTrial(openTrialRef.current, input);
    openTrialRef.current = result.trial;
    if (!result.completed) {
      setFeedback("incorrect");
      return;
    }
    const completed = [...trialsRef.current, result.completed];
    trialsRef.current = completed;
    setTrials(completed);
    armedRef.current = false;
    setFeedback("correct");
    if (indexRef.current >= 15) {
      void finish(completed);
      return;
    }
    indexRef.current += 1;
    setCurrentIndex(indexRef.current);
    openTrialRef.current = null;
    setFeedback(null);
  };

  const midi = useMidi(handleInput, (midiNote) => engine.current?.noteOff(midiNote));
  useComputerKeyboard(true, handleInput, (midiNote) => engine.current?.noteOff(midiNote));

  const start = async () => {
    await initializeAudio();
    const generator = new NoteGenerator({ ...range, adaptive: false, avoidImmediateRepeat: true });
    const generated = generator.generateSequence(16);
    setScore(createQuarterNoteScore(generated));
    trialsRef.current = [];
    setTrials([]);
    indexRef.current = 0;
    setCurrentIndex(0);
    setArmNonce(0);
    openTrialRef.current = null;
    armedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    phaseRef.current = "running";
    setPhase("running");
  };

  const markReady = useCallback(() => {
    const target = notes[indexRef.current];
    if (phaseRef.current !== "running" || !target || openTrialRef.current?.target.id === target.id) return;
    openTrialRef.current = createOpenTrial(target, indexRef.current, performance.now());
    armedRef.current = true;
  }, [notes]);

  if (phase === "configure") {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Sheet reading</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Read ahead across four measures</h1>
        <Card className="mt-7 space-y-6 p-4 sm:mt-8 sm:p-6">
          <label className="block space-y-2 text-sm text-slate-300">
            <span>Note range</span>
            <select value={rangePreset} onChange={(event) => setRangePreset(event.target.value as TrebleRangePreset)} className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white">
              <option value="staff">Easy · staff only</option>
              <option value="ledger-1">Medium · one ledger line</option>
              <option value="ledger-2">Hard · two ledger lines</option>
              <option value="ledger-3">Advanced · three ledger lines</option>
            </select>
          </label>
          <p className="text-sm text-slate-400">4/4 · 16 quarter notes · wrong notes do not move the cursor</p>
          <div className="flex justify-end"><Button className="w-full sm:w-auto" size="lg" onClick={() => void start()}><Play className="size-5" /> Start sheet</Button></div>
        </Card>
      </div>
    );
  }

  if (phase === "complete" && summary) {
    return <div className="px-4 py-8 sm:px-6 sm:py-10"><SessionResult summary={summary} syncStatus={saveStatus} onRetry={() => { phaseRef.current = "configure"; setPhase("configure"); }} /></div>;
  }

  return (
    <div className="sheet-training-layout mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <div className="sheet-training-toolbar flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-teal-300">SHEET READING</p><p className="text-xs text-slate-500">Quarter notes · 4/4</p></div>
        <p className="order-3 w-full rounded-xl bg-slate-900/70 p-2 text-center text-sm text-slate-300 sm:order-none sm:w-auto sm:bg-transparent sm:p-0">Note {currentIndex + 1} / 16 · First try {trials.length ? Math.round(trials.filter((trial) => trial.firstTryCorrect).length / trials.length * 100) : 100}%</p>
        {phase === "paused" ? <Button size="sm" onClick={() => { phaseRef.current = "running"; setPhase("running"); setArmNonce((value) => value + 1); }}><Play className="size-4" /> Resume</Button> : <Button size="sm" variant="secondary" onClick={() => { phaseRef.current = "paused"; armedRef.current = false; openTrialRef.current = null; setPhase("paused"); }}><Pause className="size-4" /> Pause</Button>}
      </div>
      <Card className="relative p-3 sm:p-5">
        {phase === "paused" && <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-slate-950/90"><Button onClick={() => { phaseRef.current = "running"; setPhase("running"); setArmNonce((value) => value + 1); }}><Play className="size-4" /> Resume</Button></div>}
        {notes.length > 0 && <MusicStaff key={`sheet-${armNonce}`} notes={notes} currentIndex={currentIndex} mode="sheet" feedback={feedback} onReady={markReady} />}
        <p className={`mt-3 h-5 text-center text-sm font-semibold ${feedback === "incorrect" ? "text-rose-300" : "text-teal-300"}`} aria-live="polite">{feedback === "incorrect" ? "✕ Wrong note — stay on the current note" : feedback === "correct" ? "✓" : ""}</p>
      </Card>
      <PianoKeyboard minMidi={range.minMidi} maxMidi={range.maxMidi} disabled={phase !== "running"} onNoteOn={(midiNote, velocity) => handleInput({ midi: midiNote, velocity, source: "touch", occurredAtMs: performance.now() })} onNoteOff={(midiNote) => engine.current?.noteOff(midiNote)} />
      <MidiPanel status={midi.status} devices={midi.devices} selectedDeviceId={midi.selectedDeviceId} onConnect={() => void midi.connect()} onSelect={midi.selectDevice} />
      {audioError && <p className="text-sm text-amber-300">{audioError}</p>}
    </div>
  );
}
