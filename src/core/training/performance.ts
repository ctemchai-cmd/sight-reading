import type { PerformanceTimingGrade } from "@/types/training";

export const PERFORMANCE_NOTES_PER_LINE = 16;
export const PERFORMANCE_TIMING_GRADE_ORDER = ["perfect", "great", "cool", "bad", "miss"] as const;

/**
 * Timing windows scale with tempo. At 60 BPM they are 120/250/500 ms; the
 * remaining part of the beat is Bad, and an unanswered beat is Miss.
 */
export function gradePerformanceTiming(
  timingOffsetMs: number | null,
  beatDurationMs: number,
): PerformanceTimingGrade {
  if (timingOffsetMs === null) return "miss";
  const distance = Math.abs(timingOffsetMs) / beatDurationMs;
  if (distance <= 0.12) return "perfect";
  if (distance <= 0.25) return "great";
  if (distance <= 0.5) return "cool";
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
