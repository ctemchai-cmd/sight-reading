import type { TrainingMode } from "@/types/training";

/** Gemini names the two sides "user" and "model"; the wire format uses these verbatim. */
export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}

/** One finished session, flattened to what the coach needs to see. */
export interface CoachSession {
  mode: TrainingMode;
  completedAt: string;
  completedTargets: number;
  accuracy: number;
  medianResponseMs: number | null;
}
