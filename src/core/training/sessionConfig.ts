import { KEY_NAMES } from "@/core/music/keys";
import { MELODIC_SHAPES } from "@/core/training/melody";
import type { Clef, KeyName } from "@/types/music";
import type { MelodicShape } from "@/types/training";

export const SESSION_LENGTHS = [25, 50, 71, 100] as const;
export const TEMPO_CHOICES = [40, 50, 60, 72, 84, 100, 120] as const;

/** What a link may carry. Everything is optional; the trainer keeps its own default for the rest. */
export interface SessionLink {
  focusMidis: number[];
  clef?: Clef;
  keySignature?: KeyName;
  melodicShape?: MelodicShape;
  sessionLength?: number | "endless";
  tempoBpm?: number;
}

interface ReadableParams {
  get(name: string): string | null;
}

function pick<T extends string>(raw: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

/**
 * Reads a session out of a link's query string — the dashboard's weak-pitch
 * button and the coach's recommendations both arrive this way.
 *
 * Anything unrecognised is dropped rather than defaulted. A link is written by
 * something outside the trainer, and a typo silently becoming C major would
 * quietly train the wrong thing.
 */
export function parseSessionLink(params: ReadableParams): SessionLink {
  const focusRaw = params.get("focus");
  const focusMidis = focusRaw
    ? [...new Set(focusRaw.split(",").map(Number))]
        .filter((midi) => Number.isInteger(midi) && midi >= 0 && midi <= 127)
        .sort((a, b) => a - b)
    : [];

  const lengthRaw = params.get("length");
  const sessionLength = lengthRaw === "endless"
    ? "endless"
    : (SESSION_LENGTHS as readonly number[]).includes(Number(lengthRaw))
      ? Number(lengthRaw)
      : undefined;

  const tempoRaw = Number(params.get("tempo"));
  const tempoBpm = (TEMPO_CHOICES as readonly number[]).includes(tempoRaw) ? tempoRaw : undefined;

  return {
    focusMidis,
    clef: pick(params.get("clef"), ["treble", "bass"] as const),
    keySignature: pick(params.get("key"), KEY_NAMES),
    melodicShape: pick(params.get("shape"), MELODIC_SHAPES),
    sessionLength,
    tempoBpm,
  };
}
