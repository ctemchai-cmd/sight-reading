export const PERFORMANCE_NOTES_PER_LINE = 16;

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
