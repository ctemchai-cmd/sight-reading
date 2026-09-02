import { weakNoteStatsFromTotals, type NoteTotals } from "@/core/training/scoring";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WeakNoteStat } from "@/types/training";

export const NOTE_STAT_COLUMNS =
  "midi,trial_count,first_try_correct_count,incorrect_attempt_count,average_response_ms,median_response_ms,best_response_ms";

interface NoteStatRow {
  midi: number;
  trial_count: number;
  first_try_correct_count: number;
  incorrect_attempt_count: number;
  average_response_ms: number | null;
  median_response_ms: number | null;
  best_response_ms: number | null;
}

function toTotals(row: NoteStatRow): NoteTotals {
  return {
    midi: row.midi,
    trialCount: row.trial_count,
    firstTryCorrectCount: row.first_try_correct_count,
    incorrectAttemptCount: row.incorrect_attempt_count,
    averageResponseMs: Number(row.average_response_ms ?? 0),
    medianResponseMs: Number(row.median_response_ms ?? 0),
    bestResponseMs: Number(row.best_response_ms ?? 0),
  };
}

/** Shared with the server-side read, so both score the same rows the same way. */
export function noteStatsFromRows(rows: unknown): WeakNoteStat[] {
  return weakNoteStatsFromTotals(((rows ?? []) as NoteStatRow[]).map(toTotals));
}

export interface NoteHistory {
  stats: WeakNoteStat[];
  /** Why the history is empty, when it is empty for a reason worth showing. */
  error: string | null;
}

/**
 * Every note the player has practised, scored the way a session scores itself.
 * Row-level security already limits the rows to the signed-in player, so no
 * user check is needed here. It never throws — training must carry on without
 * its history — but it does say when something went wrong, because an empty
 * history and a refused one look identical otherwise.
 */
export async function loadNoteHistory(): Promise<NoteHistory> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { stats: [], error: null };
  const { data, error } = await supabase.from("user_note_stats").select(NOTE_STAT_COLUMNS);
  if (error) return { stats: [], error: error.message };
  return { stats: noteStatsFromRows(data), error: null };
}
