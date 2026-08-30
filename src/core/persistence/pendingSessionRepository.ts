import { openDB, type DBSchema } from "idb";
import type { TrainingSessionRecord } from "@/types/training";

interface SightReadingDatabase extends DBSchema {
  pending: {
    key: string;
    value: TrainingSessionRecord;
  };
}

const database = () =>
  openDB<SightReadingDatabase>("sight-reading-trainer", 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pending")) db.createObjectStore("pending", { keyPath: "id" });
    },
  });

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
