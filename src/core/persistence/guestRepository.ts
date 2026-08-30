import { openDB, type DBSchema } from "idb";
import type { TrainingSessionRecord } from "@/types/training";

interface SightReadingDatabase extends DBSchema {
  sessions: {
    key: string;
    value: TrainingSessionRecord;
    indexes: { "by-completed": string };
  };
  pending: {
    key: string;
    value: TrainingSessionRecord;
  };
}

const database = () =>
  openDB<SightReadingDatabase>("sight-reading-trainer", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("sessions")) {
        const store = db.createObjectStore("sessions", { keyPath: "id" });
        store.createIndex("by-completed", "completedAt");
      }
      if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "id" });
    },
  });

export async function saveGuestSession(session: TrainingSessionRecord): Promise<void> {
  const db = await database();
  await db.put("sessions", { ...session, syncStatus: "local" });
}

export async function listGuestSessions(): Promise<TrainingSessionRecord[]> {
  const db = await database();
  const sessions = await db.getAllFromIndex("sessions", "by-completed");
  return sessions.reverse();
}

export async function queuePendingSession(session: TrainingSessionRecord): Promise<void> {
  const db = await database();
  await db.put("pending", { ...session, syncStatus: "pending" });
}

export async function listPendingSessions(): Promise<TrainingSessionRecord[]> {
  return (await database()).getAll("pending");
}

export async function removePendingSession(id: string): Promise<void> {
  await (await database()).delete("pending", id);
}
