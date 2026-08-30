import { createTargetNote, naturalMidisInRange } from "@/core/music/notes";
import { chooseWeightedMidi } from "@/core/training/adaptive";
import type { TargetNote } from "@/types/music";
import type { WeakNoteStat } from "@/types/training";

export interface NoteGeneratorConfig {
  minMidi: number;
  maxMidi: number;
  adaptive: boolean;
  avoidImmediateRepeat: boolean;
  focusMidis?: number[];
}

export class NoteGenerator {
  private readonly recent: number[] = [];

  constructor(
    private readonly config: NoteGeneratorConfig,
    private readonly random: () => number = Math.random,
  ) {}

  generate(stats: WeakNoteStat[] = []): TargetNote {
    let candidates = naturalMidisInRange(this.config.minMidi, this.config.maxMidi);
    if (this.config.focusMidis?.length) {
      const focused = candidates.filter((midi) => this.config.focusMidis?.includes(midi));
      if (focused.length) candidates = focused;
    }

    const last = this.recent.at(-1);
    const occurrencesInFive = (midi: number) => this.recent.slice(-5).filter((recent) => recent === midi).length;
    let allowed = candidates.filter(
      (midi) => (!this.config.avoidImmediateRepeat || candidates.length === 1 || midi !== last) && occurrencesInFive(midi) < 2,
    );
    if (allowed.length === 0) allowed = candidates.filter((midi) => candidates.length === 1 || midi !== last);
    if (allowed.length === 0) allowed = candidates;

    const useAdaptive = this.config.adaptive && stats.length > 0 && this.random() < 0.7;
    const midi = useAdaptive
      ? chooseWeightedMidi(allowed, stats, this.random)
      : allowed[Math.floor(this.random() * allowed.length)];
    this.recent.push(midi);
    if (this.recent.length > 5) this.recent.shift();
    return createTargetNote(midi);
  }

  generateSequence(length: number, stats: WeakNoteStat[] = []): TargetNote[] {
    return Array.from({ length }, () => this.generate(stats));
  }
}
