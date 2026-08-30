import {
  listPendingSessions,
  queuePendingSession,
  removePendingSession,
} from "@/core/persistence/pendingSessionRepository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TrainingSessionRecord } from "@/types/training";

export interface FlushResult {
  synced: number;
  /** Queued sessions the server will never accept, left in place to be looked at. */
  rejected: number;
}

/**
 * Postgres data and integrity errors mean the row itself is the problem, so no
 * amount of retrying will land it — usually a value outside a check constraint
 * that a migration has yet to widen. Anything else, a dropped connection or an
 * expired session, is worth waiting on.
 */
export function isPermanentRejection(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && (code.startsWith("22") || code.startsWith("23"));
}

async function saveCloudSession(session: TrainingSessionRecord): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase.rpc("save_training_session", { payload: session });
  if (error) throw error;
  return true;
}

export async function persistTrainingSession(session: TrainingSessionRecord): Promise<"synced" | "pending"> {
  const supabase = getSupabaseBrowserClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user) {
    await queuePendingSession(session);
    return "pending";
  }

  try {
    await saveCloudSession(session);
    return "synced";
  } catch (error) {
    // Queued either way, but silence here left a failing save indistinguishable
    // from being signed out.
    console.error("Could not save the training session", error);
    await queuePendingSession(session);
    return "pending";
  }
}

export async function flushPendingSessions(): Promise<FlushResult> {
  const pending = await listPendingSessions();
  let synced = 0;
  let rejected = 0;

  for (const session of pending) {
    try {
      // Signed out or unconfigured: everything behind this will fail too.
      if (!(await saveCloudSession(session))) break;
      await removePendingSession(session.id);
      synced += 1;
    } catch (error) {
      if (!isPermanentRejection(error)) break;
      // One session the server will never take must not hold up the rest.
      console.error("The server rejected a queued training session", error);
      rejected += 1;
    }
  }

  return { synced, rejected };
}
