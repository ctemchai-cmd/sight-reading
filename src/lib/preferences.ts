export interface LocalPreferences {
  defaultSessionLength: number;
  adaptive: boolean;
  sound: boolean;
  midiSound: boolean;
  computerKeyboard: boolean;
}

export const defaultPreferences: LocalPreferences = {
  defaultSessionLength: 71,
  adaptive: false,
  sound: true,
  midiSound: false,
  computerKeyboard: true,
};

export function loadLocalPreferences(): LocalPreferences {
  if (typeof window === "undefined") return defaultPreferences;
  const raw = localStorage.getItem("sight-reader-preferences");
  if (!raw) return defaultPreferences;
  try {
    return { ...defaultPreferences, ...JSON.parse(raw) as Partial<LocalPreferences> };
  } catch {
    return defaultPreferences;
  }
}

export function saveLocalPreferences(preferences: LocalPreferences): void {
  localStorage.setItem("sight-reader-preferences", JSON.stringify(preferences));
}
