import type { WeakNoteStat } from "@/types/training";

export function chooseWeightedMidi(
  candidates: number[],
  stats: WeakNoteStat[],
  random: () => number = Math.random,
): number {
  if (candidates.length === 0) throw new Error("Cannot choose a note from an empty candidate list.");
  const byMidi = new Map(stats.map((stat) => [stat.midi, stat]));
  const weights = candidates.map((midi) => {
    const stat = byMidi.get(midi);
    return stat && stat.trialCount >= 3 ? stat.weakScore : 1;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;

  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return candidates[index];
  }
  return candidates.at(-1)!;
}
