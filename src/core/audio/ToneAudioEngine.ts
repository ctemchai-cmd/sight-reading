import * as Tone from "tone";
import type { AudioEngine } from "@/core/audio/AudioEngine";
import { midiToNotatedPitch } from "@/core/music/notes";

const SAMPLE_BASE_URL = "/audio/piano/";
/**
 * One sample every minor third. Tone repitches the semitone either side, which
 * is inaudible for a reference tone and keeps the decoded buffers within a
 * phone's memory budget — the full set is stereo and would decode to tens of
 * megabytes.
 */
const SAMPLE_STEP = 3;
const SAMPLE_MIN_MIDI = 36;
const SAMPLE_MAX_MIDI = 96;
/**
 * The recordings ring for about two and a half seconds. Practice plays a note
 * every few hundred milliseconds, so each one is cut short and faded out rather
 * than left to pile up into a wash.
 */
const NOTE_SECONDS = 0.6;
const RELEASE_SECONDS = 0.3;

/** File naming follows the sample set: flats spelled with `b`, as in `Eb4.mp3`. */
function sampleName(midi: number): string {
  const { letter, accidental, octave } = midiToNotatedPitch(midi, "flat");
  return `${letter}${accidental === "flat" ? "b" : ""}${octave}`;
}

function sampleUrls(): Record<string, string> {
  const urls: Record<string, string> = {};
  for (let midi = SAMPLE_MIN_MIDI; midi <= SAMPLE_MAX_MIDI; midi += SAMPLE_STEP) {
    urls[sampleName(midi)] = `${sampleName(midi)}.mp3`;
  }
  return urls;
}

/**
 * A struck string is brightest at the hammer strike, mellows as it rings, and
 * decays to silence rather than sustaining. Used when the sample set cannot be
 * loaded; it is a stand-in, not a piano.
 */
function createSynth(): Tone.PolySynth<Tone.MonoSynth> {
  const synth = new Tone.PolySynth(Tone.MonoSynth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.002, decay: 1.5, sustain: 0, release: 0.9 },
    filter: { type: "lowpass", Q: 1 },
    filterEnvelope: {
      attack: 0.001,
      decay: 0.4,
      sustain: 0.08,
      release: 0.8,
      baseFrequency: 320,
      octaves: 4.5,
    },
  }).toDestination();
  synth.maxPolyphony = 24;
  synth.volume.value = -10;
  return synth;
}

function loadSampler(): Promise<Tone.Sampler> {
  return new Promise((resolve, reject) => {
    const sampler: Tone.Sampler = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: SAMPLE_BASE_URL,
      release: RELEASE_SECONDS,
      onload: () => resolve(sampler),
      onerror: reject,
    }).toDestination();
  });
}

type Instrument = Tone.Sampler | Tone.PolySynth<Tone.MonoSynth>;

export class ToneAudioEngine implements AudioEngine {
  private instrument: Instrument | null = null;
  private loading: Promise<Instrument> | null = null;

  /**
   * Fetching and decoding the samples needs no user gesture — only starting the
   * audio context does. Kicking the download off when the trainer mounts means
   * the buffers are usually ready by the time anyone presses Start.
   */
  preload(): void {
    // A missing or unreachable sample set should not silence training.
    this.loading ??= loadSampler().catch(() => createSynth());
  }

  async initialize(): Promise<void> {
    await Tone.start();
    // Tone schedules 100ms ahead by default so sequenced events land on time.
    // Every note here is triggered live by a key press, so that budget is pure
    // input lag; nothing in this app is sequenced, so give it up.
    Tone.getContext().lookAhead = 0;
    if (this.instrument) return;
    this.preload();
    this.instrument = await this.loading;
  }

  /** True once real piano samples are in use rather than the fallback synth. */
  get sampled(): boolean {
    return this.instrument instanceof Tone.Sampler;
  }

  private static gain(velocity: number): number {
    return Math.max(0, Math.min(1, velocity / 127));
  }

  private static note(midi: number): string {
    return Tone.Frequency(midi, "midi").toNote();
  }

  noteOn(midi: number, velocity = 96): void {
    this.instrument?.triggerAttack(ToneAudioEngine.note(midi), undefined, ToneAudioEngine.gain(velocity));
  }

  noteOff(midi: number): void {
    this.instrument?.triggerRelease(ToneAudioEngine.note(midi));
  }

  playNote(midi: number, velocity = 96, durationSeconds = NOTE_SECONDS): void {
    this.instrument?.triggerAttackRelease(
      ToneAudioEngine.note(midi),
      durationSeconds,
      undefined,
      ToneAudioEngine.gain(velocity),
    );
  }

  setVolume(decibels: number): void {
    if (this.instrument) this.instrument.volume.value = decibels;
  }

  stopAll(): void {
    this.instrument?.releaseAll();
  }
}
