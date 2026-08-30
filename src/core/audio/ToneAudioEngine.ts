import * as Tone from "tone";
import type { AudioEngine } from "@/core/audio/AudioEngine";

export class ToneAudioEngine implements AudioEngine {
  private synth: Tone.PolySynth<Tone.Synth> | null = null;

  async initialize(): Promise<void> {
    await Tone.start();
    if (!this.synth) {
      this.synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle8" },
        envelope: { attack: 0.005, decay: 0.12, sustain: 0.25, release: 0.65 },
      }).toDestination();
      this.synth.volume.value = -12;
    }
  }

  noteOn(midi: number, velocity = 96): void {
    this.synth?.triggerAttack(Tone.Frequency(midi, "midi").toFrequency(), undefined, Math.max(0, Math.min(1, velocity / 127)));
  }

  noteOff(midi: number): void {
    this.synth?.triggerRelease(Tone.Frequency(midi, "midi").toFrequency());
  }

  playNote(midi: number, velocity = 96, durationSeconds = 0.18): void {
    this.synth?.triggerAttackRelease(
      Tone.Frequency(midi, "midi").toFrequency(),
      durationSeconds,
      undefined,
      Math.max(0, Math.min(1, velocity / 127)),
    );
  }

  setVolume(decibels: number): void {
    if (this.synth) this.synth.volume.value = decibels;
  }

  stopAll(): void {
    this.synth?.releaseAll();
  }
}
