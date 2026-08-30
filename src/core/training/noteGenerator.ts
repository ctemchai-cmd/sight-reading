import { scaleMidisInRange } from "@/core/music/keys";
import { createTargetNote } from "@/core/music/notes";
import { chooseWeightedMidi } from "@/core/training/adaptive";
import { nextScaleIndex } from "@/core/training/melody";
import type { KeyName, TargetNote } from "@/types/music";
import type { MelodicShape, WeakNoteStat } from "@/types/training";

/** How often a melodic line breaks off and starts somewhere fresh. */
const PHRASE_RESTART_CHANCE = 0.15;

export interface NoteGeneratorConfig {
  minMidi: number;
  maxMidi: number;
  keySignature: KeyName;
  melodicShape: MelodicShape;
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
    let candidates = scaleMidisInRange(this.config.keySignature, this.config.minMidi, this.config.maxMidi);
    const focusing = Boolean(this.config.focusMidis?.length);
    if (focusing) {
      const focused = candidates.filter((midi) => this.config.focusMidis?.includes(midi));
      if (focused.length) candidates = focused;
    }

    const midi = this.pick(candidates, stats, focusing);
    this.recent.push(midi);
    if (this.recent.length > 5) this.recent.shift();
    return createTargetNote(midi, this.config.keySignature);
  }

  private pick(candidates: number[], stats: WeakNoteStat[], focusing: boolean): number {
    const shape = this.config.melodicShape;
    const from = candidates.indexOf(this.recent.at(-1) ?? -1);
    // A weak-note drill is a scattered set of pitches, so stepping through it
    // would not be a melodic line; and a line that only ever steps never starts
    // a new phrase, so now and then it breaks off and begins somewhere fresh.
    const continueLine =
      shape !== "random" && !focusing && from >= 0 && this.random() >= PHRASE_RESTART_CHANCE;
    if (continueLine) return candidates[nextScaleIndex(shape, from, candidates.length, this.random)];

    const last = this.recent.at(-1);
    const occurrencesInFive = (midi: number) => this.recent.slice(-5).filter((recent) => recent === midi).length;
    let allowed = candidates.filter(
      (midi) => (!this.config.avoidImmediateRepeat || candidates.length === 1 || midi !== last) && occurrencesInFive(midi) < 2,
    );
    if (allowed.length === 0) allowed = candidates.filter((midi) => candidates.length === 1 || midi !== last);
    if (allowed.length === 0) allowed = candidates;

    const useAdaptive = this.config.adaptive && stats.length > 0 && this.random() < 0.7;
    return useAdaptive
      ? chooseWeightedMidi(allowed, stats, this.random)
      : allowed[Math.floor(this.random() * allowed.length)];
  }

  generateSequence(length: number, stats: WeakNoteStat[] = []): TargetNote[] {
    return Array.from({ length }, () => this.generate(stats));
  }
}
