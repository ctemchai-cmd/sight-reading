import type { MelodicShape } from "@/types/training";

/**
 * Moves are counted in scale degrees, so one step is the next note of the key
 * whatever the signature: 1 is a second, 2 a third, 4 a fifth, 7 an octave.
 */
interface Move {
  step: number;
  weight: number;
}

function bothWays(entries: Array<[number, number]>): Move[] {
  return entries.flatMap(([step, weight]) => [
    { step, weight },
    { step: -step, weight },
  ]);
}

/**
 * Reading is pattern recognition, not a lookup per note: an eye that has seen a
 * rising third a thousand times stops spelling it out. Uniform random notes
 * never form those patterns, so each shape is a distribution over how far the
 * line moves, widening as it gets harder.
 */
const SHAPES: Record<Exclude<MelodicShape, "random">, Move[]> = {
  steps: bothWays([
    [1, 6],
    [2, 1],
  ]),
  thirds: bothWays([
    [1, 4],
    [2, 4],
    [3, 1],
    [4, 1],
  ]),
  leaps: bothWays([
    [1, 3],
    [2, 3],
    [3, 2],
    [4, 2],
    [5, 1],
    [7, 1],
  ]),
};

export const MELODIC_SHAPES: MelodicShape[] = ["steps", "thirds", "leaps", "random"];

export const SHAPE_LABELS: Record<MelodicShape, string> = {
  steps: "Steps · mostly next-door notes",
  thirds: "Steps and thirds · scales and broken chords",
  leaps: "Leaps · up to an octave",
  random: "Random · no melodic shape",
};

/**
 * The next note as an index into the scale notes available, so the caller keeps
 * ownership of what those notes are. A move that would run past either end is
 * folded back the other way rather than clamped, which would otherwise pin the
 * line to the top or bottom of the range.
 */
export function nextScaleIndex(
  shape: Exclude<MelodicShape, "random">,
  from: number,
  count: number,
  random: () => number = Math.random,
): number {
  if (count <= 1) return 0;
  const moves = SHAPES[shape];
  const total = moves.reduce((sum, move) => sum + move.weight, 0);
  let cursor = random() * total;
  let chosen = moves[moves.length - 1];
  for (const move of moves) {
    cursor -= move.weight;
    if (cursor <= 0) {
      chosen = move;
      break;
    }
  }

  const forward = from + chosen.step;
  if (forward >= 0 && forward < count) return forward;
  const reflected = from - chosen.step;
  if (reflected >= 0 && reflected < count) return reflected;
  return from < count / 2 ? Math.min(count - 1, from + 1) : Math.max(0, from - 1);
}
