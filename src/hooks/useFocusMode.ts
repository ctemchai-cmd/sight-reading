"use client";

import { useEffect, useState } from "react";

/**
 * Focus mode is document-level state rather than component state: globals.css
 * hides the application header while it is on, so both trainers can share it.
 */
export function useFocusMode() {
  const [focusMode, setFocusMode] = useState(false);

  useEffect(() => {
    if (focusMode) document.documentElement.dataset.focusMode = "true";
    else delete document.documentElement.dataset.focusMode;
    return () => {
      delete document.documentElement.dataset.focusMode;
    };
  }, [focusMode]);

  return { focusMode, setFocusMode, toggleFocusMode: () => setFocusMode((active) => !active) };
}
