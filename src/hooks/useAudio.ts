"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ToneAudioEngine } from "@/core/audio/ToneAudioEngine";

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

  useEffect(() => {
    engineRef.current ??= new ToneAudioEngine();
    engineRef.current.preload();
  }, []);

  useEffect(() => () => engineRef.current?.stopAll(), []);

  return { engine: engineRef, ready, error, initialize };
}
