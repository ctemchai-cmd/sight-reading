import type { PerformanceTimingGrade } from "@/types/training";

export const PERFORMANCE_NOTES_PER_LINE = 16;
export const PERFORMANCE_TIMING_GRADE_ORDER = ["perfect", "great", "cool", "bad", "miss"] as const;
export const PERFORMANCE_LOOKAHEAD_RATIO = 0.5;

/**
 * Whether this note opens a line, and so arrives with a page turn in front of
 * it. Only one line fits on screen, so the line ahead cannot be read while the
 * current one plays: the turn gets a silent beat instead, and the pulse carries
 * on through it.
 */
export function startsPerformanceLine(
  index: number,
  notesPerLine = PERFORMANCE_NOTES_PER_LINE,
): boolean {
  return index > 0 && index % notesPerLine === 0;
}

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

export function performancePageLastIndex(
  currentIndex: number,
  sessionLength: number | "endless",
  notesPerLine = PERFORMANCE_NOTES_PER_LINE,
): number {
  const pageEnd = Math.floor(currentIndex / notesPerLine) * notesPerLine + notesPerLine - 1;
  return sessionLength === "endless" ? pageEnd : Math.min(pageEnd, sessionLength - 1);
}

export function getPerformancePage<T>(
  notes: T[],
  currentIndex: number,
  notesPerLine = PERFORMANCE_NOTES_PER_LINE,
): { notes: T[]; currentIndex: number; startIndex: number } {
  const startIndex = Math.floor(currentIndex / notesPerLine) * notesPerLine;
  return {
    notes: notes.slice(startIndex, startIndex + notesPerLine),
    currentIndex: currentIndex - startIndex,
    startIndex,
  };
}
