import { formatNoteName, midiToNotatedPitch } from "@/core/music/notes";
import { FLUENT_RESPONSE_MS, responseFluency } from "@/core/training/fluency";
import { median } from "@/core/training/statistics";
import type { PracticeHistory } from "@/core/training/practiceHistory";
import type { CoachSession } from "@/types/assistant";
import type { WeakNoteStat } from "@/types/training";

/** Enough sessions to show a trend without filling the request with history. */
const RECENT_SESSIONS = 10;
const WEAKEST_PITCHES = 8;

function seconds(milliseconds: number | null): string {
  return milliseconds === null || !Number.isFinite(milliseconds) ? "—" : `${(milliseconds / 1000).toFixed(2)}s`;
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function noteName(midi: number): string {
  return `${formatNoteName(midiToNotatedPitch(midi))} (MIDI ${midi})`;
}

function perMode(sessions: CoachSession[]): string[] {
  const modes = [...new Set(sessions.map((session) => session.mode))];
  return modes.map((mode) => {
    const own = sessions.filter((session) => session.mode === mode);
    const notes = own.reduce((sum, session) => sum + session.completedTargets, 0);
    const accuracy = notes
      ? own.reduce((sum, session) => sum + session.accuracy * session.completedTargets, 0) / notes
      : 0;
    const middle = median(own.map((session) => session.medianResponseMs).filter((value): value is number => value !== null));
    return `- ${mode}: ${own.length} sessions, ${notes} notes, ${percent(accuracy)} first try, median ${seconds(middle)}`;
  });
}

/**
 * The player's history as the coach sees it.
 *
 * Deliberately carries no identity — the account email never leaves the
 * application — and reports the same judgements the dashboard draws, so the
 * coach and the keyboard cannot disagree about which pitches are fluent.
 */
export function summariseForCoach(
  sessions: CoachSession[],
  weakNotes: WeakNoteStat[],
  practice: PracticeHistory,
  now = new Date(),
): string {
  if (sessions.length === 0 && weakNotes.length === 0) {
    return "The player has no recorded practice yet. Nothing has been measured, so do not describe their reading; help them choose a first session instead.";
  }

  const notes = sessions.reduce((sum, session) => sum + session.completedTargets, 0);
  const accuracy = notes
    ? sessions.reduce((sum, session) => sum + session.accuracy * session.completedTargets, 0) / notes
    : 0;
  const ranked = [...weakNotes].sort((a, b) => b.weakScore - a.weakScore);
  const fluent = ranked.filter((stat) => responseFluency(stat.medianResponseMs) >= 1);

  const lines = [
    `Today is ${now.toISOString().slice(0, 10)}.`,
    "",
    "## Habit",
    `Current streak ${practice.currentStreak} days, best ${practice.bestStreak}. ` +
      `Practised ${practice.daysThisWeek} of the last 7 days. ` +
      (practice.practisedToday ? "Already practised today." : "Not practised today yet."),
    "",
    "## Totals",
    `${sessions.length} sessions, ${notes} notes, ${percent(accuracy)} first-try accuracy.`,
    "",
    "## Per mode",
    ...perMode(sessions),
    "",
    `## Last ${Math.min(RECENT_SESSIONS, sessions.length)} sessions, newest first`,
    ...sessions.slice(0, RECENT_SESSIONS).map((session) =>
      `- ${session.completedAt.slice(0, 10)} · ${session.mode} · ${session.completedTargets} notes · ` +
      `${percent(session.accuracy)} first try · median ${seconds(session.medianResponseMs)}`,
    ),
  ];

  if (ranked.length > 0) {
    lines.push(
      "",
      "## Pitches, weakest first",
      ...ranked.slice(0, WEAKEST_PITCHES).map((stat) =>
        `- ${noteName(stat.midi)} · median ${seconds(stat.medianResponseMs)} · ` +
        `${percent(stat.firstTryAccuracy)} first try · ${stat.trialCount} played`,
      ),
      "",
      `## Read on sight (median under ${FLUENT_RESPONSE_MS} ms)`,
      fluent.length > 0
        ? fluent.map((stat) => formatNoteName(midiToNotatedPitch(stat.midi))).join(", ")
        : "None yet.",
      "",
      `${ranked.length} of the 61 keys have been practised at all.`,
    );
  }

  return lines.join("\n");
}
