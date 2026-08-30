import * as Tone from "tone";
import type { AudioEngine } from "@/core/audio/AudioEngine";

/**
 * A struck string is brightest at the hammer strike, mellows as it rings, and
 * keeps decaying while the key is held rather than sustaining. A filter envelope
 * over a percussive amplitude envelope gets close enough for a reference tone.
 * A sampled instrument is the real answer — see the piano sample strategy in the
 * specification, which this class exists to keep swappable.
 */
export class ToneAudioEngine implements AudioEngine {
  private synth: Tone.PolySynth<Tone.MonoSynth> | null = null;

  async initialize(): Promise<void> {
    await Tone.start();
    if (this.synth) return;
    this.synth = new Tone.PolySynth(Tone.MonoSynth, {
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
    this.synth.maxPolyphony = 24;
    this.synth.volume.value = -10;
  }

  private static gain(velocity: number): number {
    return Math.max(0, Math.min(1, velocity / 127));
  }

  private static frequency(midi: number): number {
    return Tone.Frequency(midi, "midi").toFrequency();
  }

  noteOn(midi: number, velocity = 96): void {
    this.synth?.triggerAttack(ToneAudioEngine.frequency(midi), undefined, ToneAudioEngine.gain(velocity));
  }

  noteOff(midi: number): void {
    this.synth?.triggerRelease(ToneAudioEngine.frequency(midi));
  }

  playNote(midi: number, velocity = 96, durationSeconds = 0.5): void {
    this.synth?.triggerAttackRelease(
      ToneAudioEngine.frequency(midi),
      durationSeconds,
      undefined,
      ToneAudioEngine.gain(velocity),
    );
  }

  setVolume(decibels: number): void {
    if (this.synth) this.synth.volume.value = decibels;
  }

  stopAll(): void {
    this.synth?.releaseAll();
  }
}
