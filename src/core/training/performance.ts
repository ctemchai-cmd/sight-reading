import type { PerformanceTimingGrade } from "@/types/training";

export const PERFORMANCE_NOTES_PER_LINE = 16;
/**
 * Two lines are on screen and the cursor stays on the upper one, so the line
 * you play next has been readable for a line's worth of beats. Showing only the
 * line being played turned every system break into a page that arrived exactly
 * when it was due, with nothing to read ahead to.
 */
export const PERFORMANCE_VISIBLE_LINES = 2;
export const PERFORMANCE_TIMING_GRADE_ORDER = ["perfect", "great", "cool", "bad", "miss"] as const;
export const PERFORMANCE_LOOKAHEAD_RATIO = 0.5;

export function isPerformanceLookaheadWindow(
  inputAtMs: number,
  nextBeatAtMs: number,
  beatDurationMs: number,
): boolean {
  if (beatDurationMs <= 0) return false;
  return inputAtMs >= nextBeatAtMs - beatDurationMs * PERFORMANCE_LOOKAHEAD_RATIO
    && inputAtMs < nextBeatAtMs;
}

export function performanceBeatProgress(
  nowMs: number,
  beatStartedAtMs: number,
  beatDurationMs: number,
): number {
  if (beatStartedAtMs <= 0 || beatDurationMs <= 0) return 0;
  return Math.min(1, Math.max(0, (nowMs - beatStartedAtMs) / beatDurationMs));
}

/**
 * A note owns half a beat on either side of its pulse. Grades divide that
 * symmetric window so both early and late hits can reach every verdict.
 */
export function gradePerformanceTiming(
  timingOffsetMs: number | null,
  beatDurationMs: number,
): PerformanceTimingGrade {
  if (timingOffsetMs === null) return "miss";
  const distance = Math.abs(timingOffsetMs) / beatDurationMs;
  if (distance <= 0.1) return "perfect";
  if (distance <= 0.2) return "great";
  if (distance <= 0.35) return "cool";
  return "bad";
}

/** The last note that has to exist for the visible window to draw. */
export function performancePageLastIndex(
  currentIndex: number,
  sessionLength: number | "endless",
  notesPerLine = PERFORMANCE_NOTES_PER_LINE,
  visibleLines = PERFORMANCE_VISIBLE_LINES,
): number {
  const windowEnd =
    Math.floor(currentIndex / notesPerLine) * notesPerLine + notesPerLine * visibleLines - 1;
  return sessionLength === "endless" ? windowEnd : Math.min(windowEnd, sessionLength - 1);
}

/**
 * The window on screen, which starts at the line holding the cursor and runs on
 * for as many lines as are shown. The returned index is therefore always within
 * the first line.
 */
export function getPerformancePage<T>(
  notes: T[],
  currentIndex: number,
  notesPerLine = PERFORMANCE_NOTES_PER_LINE,
  visibleLines = PERFORMANCE_VISIBLE_LINES,
): { notes: T[]; currentIndex: number; startIndex: number } {
  const startIndex = Math.floor(currentIndex / notesPerLine) * notesPerLine;
  return {
    notes: notes.slice(startIndex, startIndex + notesPerLine * visibleLines),
    currentIndex: currentIndex - startIndex,
    startIndex,
  };
}
