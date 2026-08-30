"use client";

import { Maximize2, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MusicStaff } from "@/components/music/MusicStaff";
import { PianoKeyboard } from "@/components/music/PianoKeyboard";
import { MidiPanel } from "@/components/midi/MidiPanel";
import { SessionResult } from "@/components/training/SessionResult";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TREBLE_RANGES } from "@/core/music/notes";
import { NoteGenerator } from "@/core/training/noteGenerator";
import { calculateWeakNoteStats, summarizeTraining } from "@/core/training/scoring";
import { applyInputToTrial, createOpenTrial, type OpenTrial } from "@/core/training/session";
import { computerKeyboardGuide, useComputerKeyboard } from "@/hooks/useComputerKeyboard";
import { useAudio } from "@/hooks/useAudio";
import { useMidi } from "@/hooks/useMidi";
import { persistTrainingSession } from "@/lib/sessionPersistence";
import { loadLocalPreferences } from "@/lib/preferences";
import type { TargetNote, TrebleRangePreset } from "@/types/music";
import type {
  NoteInputEvent,
  TrainingSessionConfig,
  TrainingSessionRecord,
  TrainingSummary,
  TrainingTrial,
} from "@/types/training";

type Phase = "configure" | "running" | "paused" | "complete";
type SaveStatus = "saving" | "pending" | "synced";

const DEFAULT_CONFIG: TrainingSessionConfig = {
  mode: "reflex",
  clef: "treble",
  rangePreset: "ledger-1",
  minMidi: 60,
  maxMidi: 81,
  sessionLength: 71,
  adaptive: false,
  soundEnabled: true,
  midiSoundEnabled: false,
  computerKeyboardEnabled: true,
  nextNoteDelayMs: 150,
};

export function ReflexTrainer() {
  const [phase, setPhase] = useState<Phase>("configure");
  const phaseRef = useRef<Phase>("configure");
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const configRef = useRef(config);
  const [target, setTarget] = useState<TargetNote | null>(null);
  const [trials, setTrials] = useState<TrainingTrial[]>([]);
  const trialsRef = useRef<TrainingTrial[]>([]);
  const openTrialRef = useRef<OpenTrial | null>(null);
  const generatorRef = useRef<NoteGenerator | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saving");
  const [attemptCount, setAttemptCount] = useState(0);
  const [focusMode, setFocusMode] = useState(false);
  const startedAtRef = useRef("");
  const armedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { engine, error: audioError, initialize: initializeAudio } = useAudio();

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const preferences = loadLocalPreferences();
      setConfig((current) => ({
        ...current,
        sessionLength: preferences.defaultSessionLength,
        adaptive: preferences.adaptive,
        soundEnabled: preferences.sound,
        midiSoundEnabled: preferences.midiSound,
        computerKeyboardEnabled: preferences.computerKeyboard,
      }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const finishSession = useCallback(async (completedTrials: TrainingTrial[], reason: "target-reached" | "user-stopped") => {
    if (completedTrials.length === 0) return;
    phaseRef.current = "complete";
    setPhase("complete");
    armedRef.current = false;
    const nextSummary = summarizeTraining(completedTrials);
    setSummary(nextSummary);
    setSaveStatus("saving");
    const session: TrainingSessionRecord = {
      id: crypto.randomUUID(),
      mode: "reflex",
      config: configRef.current,
      startedAt: startedAtRef.current,
      completedAt: new Date().toISOString(),
      endReason: reason,
      summary: nextSummary,
      trials: completedTrials,
      syncStatus: "local",
    };
    const status = await persistTrainingSession(session);
    setSaveStatus(status);
  }, []);

  const showNextTarget = useCallback(() => {
    openTrialRef.current = null;
    armedRef.current = false;
    setFeedback(null);
    setAttemptCount(0);
    const stats = calculateWeakNoteStats(trialsRef.current);
    setTarget(generatorRef.current?.generate(stats) ?? null);
  }, []);

  const handleInput = (input: NoteInputEvent) => {
    const currentConfig = configRef.current;
    if (currentConfig.soundEnabled && (input.source !== "midi" || currentConfig.midiSoundEnabled)) {
      engine.current?.playNote(input.midi, input.velocity ?? 96);
    }
    if (phaseRef.current !== "running" || !armedRef.current || !openTrialRef.current) return;

    const result = applyInputToTrial(openTrialRef.current, input);
    openTrialRef.current = result.trial;
    setAttemptCount(result.trial.attempts.length);
    if (!result.completed) {
      setFeedback("incorrect");
      return;
    }

    armedRef.current = false;
    setFeedback("correct");
    const completedTrials = [...trialsRef.current, result.completed];
    trialsRef.current = completedTrials;
    setTrials(completedTrials);
    const targetCount = currentConfig.sessionLength;
    if (targetCount !== "endless" && completedTrials.length >= targetCount) {
      void finishSession(completedTrials, "target-reached");
      return;
    }
    timeoutRef.current = setTimeout(showNextTarget, currentConfig.nextNoteDelayMs);
  };

  const midi = useMidi(handleInput, (midiNote) => engine.current?.noteOff(midiNote));
  useComputerKeyboard(config.computerKeyboardEnabled, handleInput, (midiNote) => engine.current?.noteOff(midiNote));

  const startSession = useCallback(async (focusMidis?: number[]) => {
    if (configRef.current.soundEnabled) await initializeAudio();
    generatorRef.current = new NoteGenerator({
      minMidi: configRef.current.minMidi,
      maxMidi: configRef.current.maxMidi,
      adaptive: configRef.current.adaptive || Boolean(focusMidis?.length),
      avoidImmediateRepeat: true,
      focusMidis,
    });
    trialsRef.current = [];
    setTrials([]);
    setSummary(null);
    setFeedback(null);
    setAttemptCount(0);
    openTrialRef.current = null;
    armedRef.current = false;
    startedAtRef.current = new Date().toISOString();
    phaseRef.current = "running";
    setPhase("running");
    setTarget(generatorRef.current.generate());
  }, [initializeAudio]);

  const markTargetReady = useCallback(() => {
    if (phaseRef.current !== "running" || !target || openTrialRef.current?.target.id === target.id) return;
    openTrialRef.current = createOpenTrial(target, trialsRef.current.length, performance.now());
    armedRef.current = true;
  }, [target]);

  const pause = () => {
    phaseRef.current = "paused";
    setPhase("paused");
    armedRef.current = false;
    openTrialRef.current = null;
    engine.current?.stopAll();
  };

  const resume = () => {
    phaseRef.current = "running";
    setPhase("running");
    setFeedback(null);
  };

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  if (phase === "configure") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">Reflex trainer</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Configure your session</h1>
          <p className="mt-3 text-slate-400">Treble clef · natural notes · Chrome Desktop</p>
        </div>
        <Card className="grid gap-5 p-4 sm:p-6 md:grid-cols-2 md:gap-6">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Note range</span>
            <select
              value={config.rangePreset}
              onChange={(event) => {
                const rangePreset = event.target.value as TrebleRangePreset;
                const range = rangePreset === "custom" ? { minMidi: config.minMidi, maxMidi: config.maxMidi } : TREBLE_RANGES[rangePreset];
                setConfig((current) => ({ ...current, rangePreset, ...range }));
              }}
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            >
              <option value="staff">Staff only (E4–F5)</option>
              <option value="ledger-1">Staff + 1 ledger (C4–A5)</option>
              <option value="ledger-2">Staff + 2 ledgers (A3–C6)</option>
              <option value="ledger-3">Staff + 3 ledgers (F3–E6)</option>
              <option value="custom">Custom MIDI range</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Session length</span>
            <select
              value={config.sessionLength}
              onChange={(event) => setConfig((current) => ({
                ...current,
                sessionLength: event.target.value === "endless" ? "endless" : Number(event.target.value),
              }))}
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            >
              {[25, 50, 71, 100].map((length) => <option key={length} value={length}>{length} notes</option>)}
              <option value="endless">Endless</option>
            </select>
          </label>
          {config.rangePreset === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
              <label className="text-sm text-slate-300">Minimum MIDI<input type="number" min={0} max={127} value={config.minMidi} onChange={(event) => setConfig((current) => ({ ...current, minMidi: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
              <label className="text-sm text-slate-300">Maximum MIDI<input type="number" min={0} max={127} value={config.maxMidi} onChange={(event) => setConfig((current) => ({ ...current, maxMidi: Number(event.target.value) }))} className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white" /></label>
            </div>
          )}
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
            <input type="checkbox" checked={config.adaptive} onChange={(event) => setConfig((current) => ({ ...current, adaptive: event.target.checked }))} /> Adaptive selection
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-800 p-4 text-sm text-slate-300">
            <input type="checkbox" checked={config.soundEnabled} onChange={(event) => setConfig((current) => ({ ...current, soundEnabled: event.target.checked }))} /> App sound
          </label>
          <div className="flex justify-end md:col-span-2">
            <Button className="w-full sm:w-auto" size="lg" onClick={() => void startSession()} disabled={config.minMidi > config.maxMidi}><Play className="size-5" /> Start training</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (phase === "complete" && summary) {
    return <div className="px-4 py-8 sm:px-6 sm:py-10"><SessionResult summary={summary} syncStatus={saveStatus} onRetry={() => { phaseRef.current = "configure"; setPhase("configure"); }} onPracticeWeak={() => void startSession(summary.weakNotes.slice(0, 5).map((note) => note.midi))} /></div>;
  }

  return (
    <div className={focusMode ? "fixed inset-0 z-50 space-y-4 overflow-auto bg-slate-950 px-3 py-4 sm:px-8 sm:py-6" : "mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-6"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-300">REFLEX</p>
          <p className="text-xs text-slate-500">{computerKeyboardGuide}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900/70 p-2 text-center text-xs text-slate-300 sm:flex sm:items-center sm:gap-6 sm:bg-transparent sm:p-0 sm:text-sm">
          <span><span className="block text-slate-500 sm:inline">Notes </span>{trials.length} / {config.sessionLength === "endless" ? "∞" : config.sessionLength}</span>
          <span><span className="block text-slate-500 sm:inline">First try </span>{trials.length ? Math.round((trials.filter((trial) => trial.firstTryCorrect).length / trials.length) * 100) : 100}%</span>
          <span><span className="block text-slate-500 sm:inline">Attempts </span>{attemptCount || 1}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setFocusMode((active) => !active)}><Maximize2 className="size-4" /> {focusMode ? "Exit focus" : "Focus"}</Button>
          {phase === "paused" ? <Button size="sm" onClick={resume}><Play className="size-4" /> Resume</Button> : <Button size="sm" variant="secondary" onClick={pause}><Pause className="size-4" /> Pause</Button>}
          {config.sessionLength === "endless" && <Button size="sm" variant="danger" onClick={() => void finishSession(trialsRef.current, "user-stopped")}><Square className="size-4" /> Finish</Button>}
        </div>
      </div>

      <Card className="relative p-3 sm:p-5">
        {phase === "paused" && <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-slate-950/90"><Button onClick={resume}><Play className="size-4" /> Resume session</Button></div>}
        {target && <MusicStaff notes={[target]} feedback={feedback} onReady={markTargetReady} />}
        <div className="mt-3 h-6 text-center text-sm font-semibold" aria-live="polite">
          {feedback === "correct" && <span className="text-teal-300">✓ Correct</span>}
          {feedback === "incorrect" && <span className="text-rose-300">✕ Try again</span>}
        </div>
      </Card>

      <PianoKeyboard
        minMidi={config.minMidi}
        maxMidi={config.maxMidi}
        disabled={phase !== "running"}
        onNoteOn={(midiNote, velocity) => handleInput({ midi: midiNote, velocity, source: "touch", occurredAtMs: performance.now() })}
        onNoteOff={(midiNote) => engine.current?.noteOff(midiNote)}
      />
      <MidiPanel status={midi.status} devices={midi.devices} selectedDeviceId={midi.selectedDeviceId} onConnect={() => void midi.connect()} onSelect={midi.selectDevice} />
      {audioError && <p className="text-sm text-amber-300">{audioError}</p>}
    </div>
  );
}
