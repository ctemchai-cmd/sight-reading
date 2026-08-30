export interface PracticeHistory {
  /** Consecutive days up to today, or up to yesterday if today is still empty. */
  currentStreak: number;
  bestStreak: number;
  daysThisWeek: number;
  practisedToday: boolean;
  /** Oldest first, ending today, for a week's worth of dots. */
  lastSevenDays: boolean[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local midnight, so a session counts against the day the player thinks it was. */
function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function runLength(days: number[], from: number): number {
  let streak = 0;
  let expected = from;
  for (const day of days) {
    if (day > expected) continue;
    if (day < expected) break;
    streak += 1;
    expected -= DAY_MS;
  }
  return streak;
}

/**
 * The skill this trains is built by turning up often, not by long sessions, so
 * the dashboard needs to say something about the habit and not only the scores.
 */
export function summarisePractice(completedAt: string[], now = new Date()): PracticeHistory {
  const days = [...new Set(completedAt.map((value) => startOfDay(new Date(value))))].sort((a, b) => b - a);
  if (days.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: 0,
      daysThisWeek: 0,
      practisedToday: false,
      lastSevenDays: Array<boolean>(7).fill(false),
    };
  }

  const today = startOfDay(now);
  const practisedToday = days[0] === today;
  // A streak survives until the day after it was last extended.
  const currentStreak = practisedToday
    ? runLength(days, today)
    : days[0] === today - DAY_MS
      ? runLength(days, today - DAY_MS)
      : 0;

  let bestStreak = 1;
  let run = 1;
  for (let index = 1; index < days.length; index += 1) {
    run = days[index - 1] - days[index] === DAY_MS ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
  }

  const weekStart = today - 6 * DAY_MS;
  const practised = new Set(days);
  return {
    currentStreak,
    bestStreak: Math.max(bestStreak, currentStreak),
    daysThisWeek: days.filter((day) => day >= weekStart).length,
    practisedToday,
    lastSevenDays: Array.from({ length: 7 }, (_, index) => practised.has(weekStart + index * DAY_MS)),
  };
}
