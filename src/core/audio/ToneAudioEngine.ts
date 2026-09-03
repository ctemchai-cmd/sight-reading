import * as Tone from "tone";
import type { AudioEngine } from "@/core/audio/AudioEngine";
import { DEFAULT_SOUND_SET, soundSet, type SoundSetId } from "@/core/audio/soundSets";
import { velocityToGain } from "@/core/audio/velocity";
import { midiToNotatedPitch } from "@/core/music/notes";
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
const MAX_HELD_NOTE_MS = 5_000;

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

function loadSampler(id: SoundSetId): Promise<Tone.Sampler> {
  return new Promise((resolve, reject) => {
    const sampler: Tone.Sampler = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: soundSet(id).baseUrl,
      release: RELEASE_SECONDS,
      onload: () => resolve(sampler),
      onerror: reject,
    }).toDestination();
  });
}

/** A short, dry tick — a piano note would be mistaken for part of the exercise. */
function createClick(): Tone.MembraneSynth {
  const click = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
  }).toDestination();
  click.volume.value = -16;
  return click;
}

type Instrument = Tone.Sampler | Tone.PolySynth<Tone.MonoSynth>;

export class ToneAudioEngine implements AudioEngine {
  private instrument: Instrument | null = null;
  private loading: Promise<Instrument> | null = null;
  private setId: SoundSetId = DEFAULT_SOUND_SET;
  private metronome: Tone.MembraneSynth | null = null;
  private heldNoteTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private sustaining = false;
  /** Keys let go while the pedal is down. They ring until it comes up. */
  private sustained = new Set<number>();

  /**
   * Fetching and decoding the samples needs no user gesture — only starting the
   * audio context does. Kicking the download off when the trainer mounts means
   * the buffers are usually ready by the time anyone presses Start.
   */
  preload(): void {
    // A missing or unreachable sample set should not silence training.
    this.loading ??= loadSampler(this.setId).catch(() => createSynth());
  }

  get soundSetId(): SoundSetId {
    return this.setId;
  }

  /**
   * Swaps the sampled instrument. Anything sounding is stopped first: the old
   * voices belong to buffers that are about to be disposed, and releasing them
   * afterwards would reach for samples that are no longer there.
   */
  async setSoundSet(id: SoundSetId): Promise<void> {
    if (id === this.setId && this.instrument) return;
    this.setId = id;
    this.stopAll();
    const previous = this.instrument;
    this.loading = loadSampler(id).catch(() => createSynth());
    this.instrument = await this.loading;
    if (previous && previous !== this.instrument) previous.dispose();
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
    return velocityToGain(velocity);
  }

  private static note(midi: number): string {
    return Tone.Frequency(midi, "midi").toNote();
  }

  /** Silences the pitch whatever the pedal is doing. */
  private release(midi: number): void {
    const timer = this.heldNoteTimers.get(midi);
    if (timer) clearTimeout(timer);
    this.heldNoteTimers.delete(midi);
    this.sustained.delete(midi);
    this.instrument?.triggerRelease(ToneAudioEngine.note(midi));
  }

  noteOn(midi: number, velocity = 96): void {
    // Re-striking a pitch has to take its old voice with it even under the
    // pedal, or repeated notes stack into one another until they distort.
    this.release(midi);
    this.instrument?.triggerAttack(ToneAudioEngine.note(midi), undefined, ToneAudioEngine.gain(velocity));
    this.heldNoteTimers.set(midi, setTimeout(() => this.noteOff(midi), MAX_HELD_NOTE_MS));
  }

  noteOff(midi: number): void {
    const timer = this.heldNoteTimers.get(midi);
    if (timer) clearTimeout(timer);
    this.heldNoteTimers.delete(midi);
    // The pedal lifts the dampers: the key is up but the string is not stopped.
    // The recording still ends when it ends, so this cannot ring longer than a
    // sample does — about two and a half seconds, where a piano rings for ten.
    if (this.sustaining) {
      this.sustained.add(midi);
      return;
    }
    this.instrument?.triggerRelease(ToneAudioEngine.note(midi));
  }

  setSustain(down: boolean): void {
    this.sustaining = down;
    if (down) return;
    for (const midi of this.sustained) this.instrument?.triggerRelease(ToneAudioEngine.note(midi));
    this.sustained.clear();
  }

  playNote(midi: number, velocity = 96, durationSeconds = NOTE_SECONDS): void {
    this.instrument?.triggerAttackRelease(
      ToneAudioEngine.note(midi),
      durationSeconds,
      undefined,
      ToneAudioEngine.gain(velocity),
    );
  }

  /** The beat, for the modes that keep one. Accented on the first of the bar. */
  click(accented = false): void {
    this.metronome ??= createClick();
    this.metronome.triggerAttackRelease(accented ? "C4" : "G3", 0.02, undefined, accented ? 1 : 0.6);
  }

  setVolume(decibels: number): void {
    if (this.instrument) this.instrument.volume.value = decibels;
  }

  stopAll(): void {
    for (const timer of this.heldNoteTimers.values()) clearTimeout(timer);
    this.heldNoteTimers.clear();
    this.sustained.clear();
    this.sustaining = false;
    this.instrument?.releaseAll();
    this.metronome?.triggerRelease();
  }
}
