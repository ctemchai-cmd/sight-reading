import {
  listPendingSessions,
  queuePendingSession,
  removePendingSession,
} from "@/core/persistence/pendingSessionRepository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { TrainingSessionRecord } from "@/types/training";

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
  } catch {
    await queuePendingSession(session);
    return "pending";
  }
}

export async function flushPendingSessions(): Promise<number> {
  const pending = await listPendingSessions();
  let synced = 0;
  for (const session of pending) {
    try {
      if (!(await saveCloudSession(session))) break;
      await removePendingSession(session.id);
      synced += 1;
    } catch {
      break;
    }
  }
  return synced;
}
