"use client";

import { useEffect, useRef } from "react";
import type { NoteInputEvent } from "@/types/training";

const KEY_TO_MIDI: Record<string, number> = {
  a: 60,
  w: 61,
  s: 62,
  e: 63,
  d: 64,
  f: 65,
  t: 66,
  g: 67,
  y: 68,
  h: 69,
  u: 70,
  j: 71,
  k: 72,
};

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

export function useComputerKeyboard(
  enabled: boolean,
  onNoteOn: (event: NoteInputEvent) => void,
  onNoteOff?: (midi: number) => void,
): void {
  const onRef = useRef(onNoteOn);
  const offRef = useRef(onNoteOff);

  useEffect(() => {
    onRef.current = onNoteOn;
    offRef.current = onNoteOff;
  }, [onNoteOff, onNoteOn]);

  useEffect(() => {
    if (!enabled) return;
    const pressed = new Set<string>();

    const keydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const midi = KEY_TO_MIDI[key];
      if (midi === undefined || event.repeat || pressed.has(key) || isEditableTarget(event.target)) return;
      event.preventDefault();
      pressed.add(key);
      onRef.current({ midi, velocity: 96, source: "computer-keyboard", occurredAtMs: event.timeStamp });
    };
    const keyup = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const midi = KEY_TO_MIDI[key];
      if (midi === undefined) return;
      pressed.delete(key);
      offRef.current?.(midi);
    };

    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
    };
  }, [enabled]);
}

export const computerKeyboardGuide = "A W S E D F T G Y H U J K = C4–C5";
