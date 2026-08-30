import { weakNoteStatsFromTotals, type NoteTotals } from "@/core/training/scoring";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { WeakNoteStat } from "@/types/training";

const COLUMNS =
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

/**
 * Every note the player has practised, scored the way a session scores itself.
 * Empty when signed out or unconfigured — row-level security already limits the
 * rows to the signed-in player, so no user check is needed here.
 */
export async function loadNoteHistory(): Promise<WeakNoteStat[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data } = await supabase.from("user_note_stats").select(COLUMNS);
  return weakNoteStatsFromTotals(((data ?? []) as unknown as NoteStatRow[]).map(toTotals));
}
