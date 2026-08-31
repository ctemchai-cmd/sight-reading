export type HistoryFailure = "clock" | "expired" | "permission" | "unknown";

/**
 * The database refuses a read for reasons that need entirely different fixes,
 * and the message it returns is the only thing that separates them. Guessing
 * once sent someone to check table grants when their device clock was simply
 * running ahead of the server.
 */
export function classifyHistoryFailure(message: string): HistoryFailure {
  const text = message.toLowerCase();
  // A token stamped in the future is rejected outright: the clock, not the token.
  if (text.includes("future") || text.includes("issued at") || text.includes("clock")) return "clock";
  if (text.includes("expired") || text.includes("jwt")) return "expired";
  if (text.includes("permission") || text.includes("denied") || text.includes("not authorized")) {
    return "permission";
  }
  return "unknown";
}

export const HISTORY_FAILURE_ADVICE: Record<HistoryFailure, string> = {
  clock:
    "This device's clock is ahead of the server, so its sign-in token looks as though it was issued in the future and is refused. Set the date and time to automatic, then sign in again.",
  expired:
    "The sign-in token is no longer valid. Signing in again is usually all this needs.",
  permission:
    "The database declined the request rather than the sign-in. The table grants in supabase/migrations/ are the thing to check.",
  unknown:
    "The request was refused. Signing in again fixes an expired session; a refusal that survives that is the database declining it, and the grants in supabase/migrations/ are the thing to check.",
};
