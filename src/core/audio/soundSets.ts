export type SoundSetId = "grand" | "keyboard";

export interface SoundSet {
  id: SoundSetId;
  label: string;
  /** What it sounds like, in the terms a player would choose between. */
  description: string;
  baseUrl: string;
}

export const SOUND_SETS: Record<SoundSetId, SoundSet> = {
  grand: {
    id: "grand",
    label: "Grand piano",
    description: "Brighter and drier. Notes stop sooner, which keeps fast passages clear.",
    baseUrl: "/audio/piano/",
  },
  keyboard: {
    id: "keyboard",
    label: "Digital keyboard",
    description: "Rounder, and rings about twice as long — the pedal has more to hold.",
    baseUrl: "/audio/keyboard/",
  },
};

export const SOUND_SET_IDS = Object.keys(SOUND_SETS) as SoundSetId[];
export const DEFAULT_SOUND_SET: SoundSetId = "grand";

export function isSoundSetId(value: unknown): value is SoundSetId {
  return typeof value === "string" && value in SOUND_SETS;
}

export function soundSet(id: SoundSetId): SoundSet {
  return SOUND_SETS[id] ?? SOUND_SETS[DEFAULT_SOUND_SET];
}
