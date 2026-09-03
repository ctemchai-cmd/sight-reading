import { DEFAULT_SOUND_SET, isSoundSetId, type SoundSetId } from "@/core/audio/soundSets";

export interface LocalPreferences {
  defaultSessionLength: number;
  adaptive: boolean;
  sound: boolean;
  midiSound: boolean;
  computerKeyboard: boolean;
  soundSet: SoundSetId;
}

export const defaultPreferences: LocalPreferences = {
  defaultSessionLength: 71,
  adaptive: false,
  sound: true,
  midiSound: false,
  computerKeyboard: true,
  soundSet: DEFAULT_SOUND_SET,
};

export function loadLocalPreferences(): LocalPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = localStorage.getItem("sight-reader-preferences");
  if (!raw) return defaultPreferences;
  try {
    const stored = { ...defaultPreferences, ...JSON.parse(raw) as Partial<LocalPreferences> };
    // A sound set that has since been renamed or removed would otherwise ask
    // the sampler for a directory that is not there, and training goes silent.
    return isSoundSetId(stored.soundSet) ? stored : { ...stored, soundSet: DEFAULT_SOUND_SET };
  } catch {
    return defaultPreferences;
  }
}

export function saveLocalPreferences(preferences: LocalPreferences): void {
  localStorage.setItem("sight-reader-preferences", JSON.stringify(preferences));
}
