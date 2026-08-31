"use client";

import { Maximize2, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MusicStaff } from "@/components/music/MusicStaff";
import { PianoKeyboard } from "@/components/music/PianoKeyboard";
import { FocusSurface } from "@/components/training/FocusSurface";
import { SessionResult } from "@/components/training/SessionResult";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KEY_NAMES, describeKey, formatKeyName, randomKey } from "@/core/music/keys";
import { MELODIC_SHAPES, SHAPE_LABELS } from "@/core/training/melody";
import { formatClef, resolveRange } from "@/core/music/notes";
import { NoteGenerator } from "@/core/training/noteGenerator";
import { PERFORMANCE_NOTES_PER_LINE, gradePerformanceTiming, performancePageLastIndex } from "@/core/training/performance";
import { calculateWeakNoteStats, mergeNoteStats, summarizeTraining } from "@/core/training/scoring";
import { applyInputToTrial, createOpenTrial, missTrial, type OpenTrial } from "@/core/training/session";
import { computerKeyboardGuide, useComputerKeyboard } from "@/hooks/useComputerKeyboard";
import { useAudio } from "@/hooks/useAudio";
import { useFocusMode } from "@/hooks/useFocusMode";
import { useMidi } from "@/hooks/useMidi";
import { loadNoteHistory } from "@/lib/noteStats";
import { persistTrainingSession } from "@/lib/sessionPersistence";
import { loadLocalPreferences } from "@/lib/preferences";
import type { Clef, KeyName, TargetNote, RangePreset } from "@/types/music";
import type {
  MelodicShape,
  NoteInputEvent,
  TrainingSessionConfig,
  TrainingSessionRecord,
  TrainingSummary,
  TrainingTrial,
  WeakNoteStat,
  PerformanceTimingGrade,
} from "@/types/training";

type Phase = "configure" | "running" | "paused" | "complete";
type SaveStatus = "saving" | "pending" | "synced";

// How far past the current note the stream stays generated, so the reader always
// has something to look ahead to.
const STREAM_LOOKAHEAD = 8;
/** Beats of metronome before the first note, so the pulse is established first. */
const COUNT_IN_BEATS = 4;
const TEMPO_CHOICES = [40, 50, 60, 72, 84, 100, 120];
const TIMING_GRADE_LABELS: Record<PerformanceTimingGrade, string> = {
  perfect: "Perfect",
  great: "Great",
  cool: "Cool",
  bad: "Bad",
  miss: "Miss",
};
const TIMING_GRADE_COLORS: Record<PerformanceTimingGrade, string> = {
  perfect: "text-cyan-300",
  great: "text-teal-300",
  cool: "text-sky-300",
  bad: "text-amber-300",
  miss: "text-rose-300",
};

const RANGE_LABELS: Record<RangePreset, string> = {
  staff: "Staff only",
  "ledger-1": "Staff + 1 ledger line",
  "ledger-2": "Staff + 2 ledger lines",
  "ledger-3": "Staff + 3 ledger lines",
  custom: "Custom MIDI range",
};


interface NoteTrainerProps {
  /**
   * All three score the same trials. Flash swaps the moving stream for one note
   * at a time; performance takes the pacing away from the player and gives it
   * to a metronome, so a note can go by unplayed.
   */
  mode: "reflex" | "flash" | "performance";
}

const DEFAULT_CONFIG: TrainingSessionConfig = {
  mode: "reflex",
  clef: "treble",
  keySignature: "C",
  melodicShape: "random",
  rangePreset: "ledger-1",
  minMidi: 60,
  maxMidi: 81,
  sessionLength: 71,
  adaptive: false,
  soundEnabled: true,
  midiSoundEnabled: false,
  computerKeyboardEnabled: true,
  nextNoteDelayMs: 150,
  tempoBpm: 50,
};

export function NoteTrainer({ mode }: NoteTrainerProps) {
  const [phase, setPhase] = useState<Phase>("configure");
  const phaseRef = useRef<Phase>("configure");
  const [config, setConfig] = useState<TrainingSessionConfig>({ ...DEFAULT_CONFIG, mode });
  const configRef = useRef(config);
  const [stream, setStream] = useState<TargetNote[]>([]);
  const streamRef = useRef<TargetNote[]>([]);
  const [streamIndex, setStreamIndex] = useState(0);
  const streamIndexRef = useRef(0);
  const [trials, setTrials] = useState<TrainingTrial[]>([]);
  const trialsRef = useRef<TrainingTrial[]>([]);
  // What the player has been weak at across every past session.
  const historyRef = useRef<WeakNoteStat[]>([]);
  const openTrialRef = useRef<OpenTrial | null>(null);
  const generatorRef = useRef<NoteGenerator | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "incorrect" | null>(null);
  const [timingGrade, setTimingGrade] = useState<PerformanceTimingGrade | null>(null);
  const [summary, setSummary] = useState<TrainingSummary | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saving");
  const [attemptCount, setAttemptCount] = useState(0);
  const { focusMode, setFocusMode, toggleFocusMode } = useFocusMode();
  const [keyChoice, setKeyChoice] = useState<KeyName | "random">("C");
  const [clefChoice, setClefChoice] = useState<Clef | "random">("treble");
  const label = mode === "flash" ? "Flash" : mode === "performance" ? "Performance" : "Reflex";
  const timed = mode === "performance";
  const [countIn, setCountIn] = useState(0);
  const [beatStartedAtMs, setBeatStartedAtMs] = useState(0);
  const countInRef = useRef(0);
  const beatAtRef = useRef(0);
  const beatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The trial the player closed by hitting the note, held until the beat ends.
  const hitRef = useRef<TrainingTrial | null>(null);
  const startedAtRef = useRef("");
  const armedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { engine, error: audioError, initialize: initializeAudio } = useAudio();
  const target = stream[streamIndex] ?? null;
  const performancePageStart = timed
    ? Math.floor(streamIndex / PERFORMANCE_NOTES_PER_LINE) * PERFORMANCE_NOTES_PER_LINE
    : 0;
  // Keep this array stable while the cursor crosses a system. Re-slicing on
  // every grade/beat render made VexFlow redraw the score and delayed motion.
  const visibleNotes = useMemo(
    () => timed
      ? stream.slice(performancePageStart, performancePageStart + PERFORMANCE_NOTES_PER_LINE)
      : stream,
    [performancePageStart, stream, timed],
  );
  const visibleIndex = timed ? streamIndex - performancePageStart : streamIndex;

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let active = true;
    void loadNoteHistory().then(({ stats }) => {
      if (active) historyRef.current = stats;
    });
    return () => {
      active = false;
    };
  }, []);

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
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    timeoutRef.current = null;
    beatTimerRef.current = null;
    phaseRef.current = "complete";
    setPhase("complete");
    setFocusMode(false);
    armedRef.current = false;
    engine.current?.stopAll();
    const nextSummary = summarizeTraining(completedTrials);
    setSummary(nextSummary);
    setSaveStatus("saving");
    const session: TrainingSessionRecord = {
      id: crypto.randomUUID(),
      mode,
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
  }, [engine, mode, setFocusMode]);

  const extendStream = useCallback((throughIndex: number) => {
    const generator = generatorRef.current;
    if (!generator) return;
    const stats = mergeNoteStats(historyRef.current, calculateWeakNoteStats(trialsRef.current));
    const next = [...streamRef.current];
    const sessionLength = configRef.current.sessionLength;
    const finiteLastIndex = sessionLength === "endless" ? Number.POSITIVE_INFINITY : sessionLength - 1;
    const desiredLastIndex = timed
      ? performancePageLastIndex(throughIndex, sessionLength)
      : Math.min(throughIndex + STREAM_LOOKAHEAD - 1, finiteLastIndex);
    while (next.length <= desiredLastIndex) next.push(generator.generate(stats));
    if (next.length === streamRef.current.length) return;
    streamRef.current = next;
    setStream(next);
  }, [timed]);

  const advanceStream = useCallback(() => {
    openTrialRef.current = null;
    armedRef.current = false;
    setFeedback(null);
    setAttemptCount(0);
    streamIndexRef.current += 1;
    setStreamIndex(streamIndexRef.current);
    extendStream(streamIndexRef.current);
  }, [extendStream]);

  const armAt = useCallback((atMs: number) => {
    const next = streamRef.current[streamIndexRef.current];
    if (!next) return;
    openTrialRef.current = createOpenTrial(next, trialsRef.current.length, atMs);
    armedRef.current = true;
    hitRef.current = null;
    if (timed) setBeatStartedAtMs(atMs);
    setFeedback(null);
    setAttemptCount(0);
  }, [timed]);

  /** Closes the beat with whatever the player managed, played or not. */
  const closeBeat = useCallback((atMs: number): TrainingTrial[] => {
    const open = openTrialRef.current;
    const closed = hitRef.current ?? (open ? { ...missTrial(open, atMs), timingGrade: "miss" as const } : null);
    if (!closed) return trialsRef.current;
    setTimingGrade(closed.timingGrade ?? null);
    const next = [...trialsRef.current, closed];
    trialsRef.current = next;
    setTrials(next);
    return next;
  }, []);

  // A declaration rather than a const: each beat schedules the next one, which
  // means naming itself.
  function beat(): void {
    if (phaseRef.current !== "running") return;
    const now = performance.now();
    const beatMs = 60000 / configRef.current.tempoBpm;

    if (countInRef.current > 0) {
      engine.current?.click(countInRef.current === COUNT_IN_BEATS);
      countInRef.current -= 1;
      setCountIn(countInRef.current);
      if (countInRef.current === 0) armAt(now);
    } else {
      const completed = closeBeat(now);
      const target = configRef.current.sessionLength;
      if (target !== "endless" && completed.length >= target) {
        void finishSession(completed, "target-reached");
        return;
      }
      streamIndexRef.current += 1;
      setStreamIndex(streamIndexRef.current);
      extendStream(streamIndexRef.current);
      engine.current?.click(false);
      armAt(now);
    }

    // Scheduled against the beat it should have landed on, not against now, so
    // the pulse does not drift over a long session.
    beatAtRef.current += beatMs;
    beatTimerRef.current = setTimeout(beat, Math.max(0, beatAtRef.current - performance.now()));
  }

  const handleInput = (input: NoteInputEvent) => {
    const currentConfig = configRef.current;
    if (currentConfig.soundEnabled && (input.source !== "midi" || currentConfig.midiSoundEnabled)) {
      engine.current?.noteOn(input.midi, input.velocity ?? 96);
    }
    if (phaseRef.current !== "running" || !armedRef.current || !openTrialRef.current) return;

    const result = applyInputToTrial(openTrialRef.current, input);
    openTrialRef.current = result.trial;
    setAttemptCount(result.trial.attempts.length);
    if (!result.completed) {
      setFeedback("incorrect");
      return;
    }

    const completed = timed
      ? {
          ...result.completed,
          timingGrade: gradePerformanceTiming(
            result.completed.correctResponseMs,
            60000 / currentConfig.tempoBpm,
          ),
        }
      : result.completed;
    armedRef.current = false;
    setFeedback("correct");
    if (timed) {
      // Played in time. The beat will close the trial and move on regardless.
      hitRef.current = completed;
      setTimingGrade(completed.timingGrade ?? null);
      return;
    }
    const completedTrials = [...trialsRef.current, completed];
    trialsRef.current = completedTrials;
    setTrials(completedTrials);
    const targetCount = currentConfig.sessionLength;
    if (targetCount !== "endless" && completedTrials.length >= targetCount) {
      void finishSession(completedTrials, "target-reached");
      return;
    }
    timeoutRef.current = setTimeout(advanceStream, currentConfig.nextNoteDelayMs);
  };

  useMidi(handleInput, (midiNote) => engine.current?.noteOff(midiNote));
  useComputerKeyboard(config.computerKeyboardEnabled, handleInput, (midiNote) => engine.current?.noteOff(midiNote));

  async function startSession(focusMidis?: number[]): Promise<void> {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    timeoutRef.current = null;
    beatTimerRef.current = null;
    if (configRef.current.soundEnabled) await initializeAudio();
    // Resolve a random choice now, so the session records the key it landed on.
    const keySignature = keyChoice === "random" ? randomKey() : keyChoice;
    const clef: Clef = clefChoice === "random" ? (Math.random() < 0.5 ? "treble" : "bass") : clefChoice;
    // Presets are relative to whichever staff is in play, so the range follows the clef.
    const range =
      configRef.current.rangePreset === "custom"
        ? { minMidi: configRef.current.minMidi, maxMidi: configRef.current.maxMidi }
        : resolveRange(clef, configRef.current.rangePreset);
    configRef.current = { ...configRef.current, keySignature, clef, ...range };
    setConfig(configRef.current);
    generatorRef.current = new NoteGenerator({
      minMidi: configRef.current.minMidi,
      maxMidi: configRef.current.maxMidi,
      keySignature,
      melodicShape: configRef.current.melodicShape,
      adaptive: configRef.current.adaptive || Boolean(focusMidis?.length),
      avoidImmediateRepeat: true,
      focusMidis,
    });
    trialsRef.current = [];
    setTrials([]);
    setSummary(null);
    setFeedback(null);
    setTimingGrade(null);
    setBeatStartedAtMs(0);
    setAttemptCount(0);
    openTrialRef.current = null;
    armedRef.current = false;
    streamRef.current = [];
    streamIndexRef.current = 0;
    setStreamIndex(0);
    startedAtRef.current = new Date().toISOString();
    phaseRef.current = "running";
    setPhase("running");
    extendStream(0);

    if (timed) {
      hitRef.current = null;
      countInRef.current = COUNT_IN_BEATS;
      setCountIn(COUNT_IN_BEATS);
      beatAtRef.current = performance.now();
      beat();
    }
  }

  const markTargetReady = useCallback(() => {
    // A timed session arms on the beat, not when the staff finishes painting.
    if (timed || phaseRef.current !== "running" || !target || openTrialRef.current?.target.id === target.id) return;
    openTrialRef.current = createOpenTrial(target, trialsRef.current.length, performance.now());
    armedRef.current = true;
  }, [target, timed]);

  const pause = () => {
    phaseRef.current = "paused";
    setPhase("paused");
    armedRef.current = false;
    openTrialRef.current = null;
    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    beatTimerRef.current = null;
    engine.current?.stopAll();
  };

  const resume = () => {
    phaseRef.current = "running";
    setPhase("running");
    setFeedback(null);
    if (!target) return;
    if (timed) {
      // Counted back in, so the pulse is re-established before the music resumes.
      hitRef.current = null;
      countInRef.current = COUNT_IN_BEATS;
      setCountIn(COUNT_IN_BEATS);
      beatAtRef.current = performance.now();
      beat();
      return;
    }
    // The stream does not repaint on resume, so re-arm here and time the note from
    // the moment the reader is looking at it again.
    openTrialRef.current = createOpenTrial(target, trialsRef.current.length, performance.now());
    armedRef.current = true;
  };

  useEffect(() => () => {
    // A timer callback may already be queued when client-side navigation
    // unmounts the trainer. Make that callback terminal before clearing its
    // handle, otherwise it still sees "running" and schedules the next beat.
    phaseRef.current = "complete";
    armedRef.current = false;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (beatTimerRef.current) clearTimeout(beatTimerRef.current);
    timeoutRef.current = null;
    beatTimerRef.current = null;
    engine.current?.stopAll();
  }, [engine]);

  if (phase === "configure") {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-300">{label} trainer</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">Configure your session</h1>
          <p className="mt-3 text-slate-400">Notes of the chosen key · Chrome Desktop</p>
          <p className="mt-1 text-xs text-slate-500">Computer keyboard: {computerKeyboardGuide}</p>
        </div>
        <Card className="grid gap-5 p-4 sm:p-6 md:grid-cols-2 md:gap-6">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Note range</span>
            <select
              value={config.rangePreset}
              onChange={(event) => {
                const rangePreset = event.target.value as RangePreset;
                setConfig((current) => ({ ...current, rangePreset }));
              }}
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            >
              {(Object.keys(RANGE_LABELS) as RangePreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {RANGE_LABELS[preset]}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Clef</span>
            <select
              value={clefChoice}
              onChange={(event) => setClefChoice(event.target.value as Clef | "random")}
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            >
              <option value="treble">Treble · right hand</option>
              <option value="bass">Bass · left hand</option>
              <option value="random">Random each session</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Key</span>
            <select
              value={keyChoice}
              onChange={(event) => setKeyChoice(event.target.value as KeyName | "random")}
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            >
              <option value="random">Random each session</option>
              {KEY_NAMES.map((name) => (
                <option key={name} value={name}>
                  {formatKeyName(name)} major · {describeKey(name)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Melody</span>
            <select
              value={config.melodicShape}
              onChange={(event) =>
                setConfig((current) => ({ ...current, melodicShape: event.target.value as MelodicShape }))
              }
              className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
            >
              {MELODIC_SHAPES.map((shape) => (
                <option key={shape} value={shape}>
                  {SHAPE_LABELS[shape]}
                </option>
              ))}
            </select>
          </label>
          {timed && (
            <label className="space-y-2 text-sm text-slate-300">
              <span>Tempo</span>
              <select
                value={config.tempoBpm}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, tempoBpm: Number(event.target.value) }))
                }
                className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-white"
              >
                {TEMPO_CHOICES.map((bpm) => (
                  <option key={bpm} value={bpm}>
                    {bpm} BPM · one note every {(60 / bpm).toFixed(1)}s
                  </option>
                ))}
              </select>
            </label>
          )}
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
    <FocusSurface
      active={focusMode}
      onExit={toggleFocusMode}
      className="note-training-layout mx-auto max-w-7xl space-y-4 px-3 py-4 sm:px-6 sm:py-6"
    >
      {!focusMode && (
      <div className="note-training-toolbar flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-teal-300">{label.toUpperCase()}</p>
          <p className="text-xs text-slate-500">{formatClef(config.clef)} · {formatKeyName(config.keySignature)} major · {describeKey(config.keySignature)}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-900/70 p-2 text-center text-xs text-slate-300 sm:flex sm:items-center sm:gap-6 sm:bg-transparent sm:p-0 sm:text-sm">
          <span><span className="block text-slate-500 sm:inline">Notes </span>{trials.length} / {config.sessionLength === "endless" ? "∞" : config.sessionLength}</span>
          <span><span className="block text-slate-500 sm:inline">First try </span>{trials.length ? Math.round((trials.filter((trial) => trial.firstTryCorrect).length / trials.length) * 100) : 100}%</span>
          <span>
            <span className="block text-slate-500 sm:inline">{timed ? "Missed " : "Attempts "}</span>
            {timed ? trials.filter((trial) => trial.correctResponseMs === null).length : attemptCount || 1}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={toggleFocusMode}><Maximize2 className="size-4" /> Focus</Button>
          {phase === "paused" ? <Button size="sm" onClick={resume}><Play className="size-4" /> Resume</Button> : <Button size="sm" variant="secondary" onClick={pause}><Pause className="size-4" /> Pause</Button>}
          <Button size="sm" variant="ghost" onClick={() => void startSession()}><RotateCcw className="size-4" /> Reset</Button>
          {config.sessionLength === "endless" && <Button size="sm" variant="danger" onClick={() => void finishSession(trialsRef.current, "user-stopped")}><Square className="size-4" /> Finish</Button>}
        </div>
      </div>
      )}

      <Card className="note-training-staff relative p-3 sm:p-5">
        {countIn > 0 && (
          <div className="absolute inset-0 z-30 grid place-items-center rounded-2xl bg-slate-950/80">
            <p className="text-6xl font-bold text-teal-300">{countIn}</p>
          </div>
        )}
        {phase === "paused" && <div className="absolute inset-0 z-20 grid place-items-center rounded-2xl bg-slate-950/90"><Button onClick={resume}><Play className="size-4" /> Resume session</Button></div>}
        {visibleNotes.length > 0 && (
          <MusicStaff
            notes={visibleNotes}
            currentIndex={visibleIndex}
            mode={timed ? "sheet" : mode === "flash" ? "flash" : "stream"}
            keySignature={config.keySignature}
            clef={config.clef}
            feedback={feedback}
            beatCursor={timed}
            beatCursorRunning={timed && phase === "running" && countIn === 0}
            beatDurationMs={timed ? 60000 / config.tempoBpm : undefined}
            beatStartedAtMs={timed ? beatStartedAtMs : undefined}
            fill={focusMode}
            onReady={markTargetReady}
          />
        )}
        <div className={`training-feedback mt-3 h-6 text-center text-sm font-semibold ${timed ? "performance-training-feedback" : ""}`} aria-live="polite">
          {feedback === "incorrect" && <span className="text-rose-300">✕ Wrong note</span>}
          {feedback !== "incorrect" && timed && timingGrade && (
            <span className={TIMING_GRADE_COLORS[timingGrade]}>{TIMING_GRADE_LABELS[timingGrade]}</span>
          )}
          {feedback === "correct" && !timed && <span className="text-teal-300">✓ Correct</span>}
        </div>
      </Card>

      <div className="note-training-inputs">
        <PianoKeyboard
          trainingMinMidi={config.minMidi}
          trainingMaxMidi={config.maxMidi}
          disabled={phase !== "running"}
          onNoteOn={(midiNote, velocity) => handleInput({ midi: midiNote, velocity, source: "touch", occurredAtMs: performance.now() })}
          onNoteOff={(midiNote) => engine.current?.noteOff(midiNote)}
        />
      </div>
      {audioError && <p className="note-training-error text-sm text-amber-300">{audioError}</p>}
    </FocusSurface>
  );
}
