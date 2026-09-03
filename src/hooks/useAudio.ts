"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToneAudioEngine } from "@/core/audio/ToneAudioEngine";
import type { SoundSetId } from "@/core/audio/soundSets";
import { loadLocalPreferences } from "@/lib/preferences";

export function useAudio() {
  const engineRef = useRef<ToneAudioEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(async () => {
    try {
      engineRef.current ??= new ToneAudioEngine();
      await engineRef.current.initialize();
      setReady(true);
      setError(null);
    } catch {
      setError("Audio could not start. Visual training is still available.");
    }
  }, []);

  // The stored choice has to be known before the download starts, or the
  // preloaded samples are the wrong instrument and the first switch stalls
  // behind a set nobody asked for.
  useEffect(() => {
    engineRef.current ??= new ToneAudioEngine();
    void engineRef.current.setSoundSet(loadLocalPreferences().soundSet);
    engineRef.current.preload();
  }, []);

  const changeSoundSet = useCallback(async (id: SoundSetId) => {
    engineRef.current ??= new ToneAudioEngine();
    await engineRef.current.setSoundSet(id);
  }, []);

  useEffect(() => () => engineRef.current?.stopAll(), []);

  return { engine: engineRef, ready, error, initialize, changeSoundSet };
}
