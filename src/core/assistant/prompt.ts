import { APP_KNOWLEDGE, COACH_INSTRUCTIONS } from "@/core/assistant/knowledge";
import type { ChatMessage } from "@/types/assistant";

/** A question long enough to be a paste rather than a question. */
export const MAX_MESSAGE_CHARS = 2000;
/** Turns of history sent back. Older ones cost quota without changing an answer. */
export const MAX_TURNS = 20;

interface GeminiPart {
  text: string;
}

export interface GeminiRequest {
  systemInstruction: { parts: GeminiPart[] };
  contents: Array<{ role: "user" | "model"; parts: GeminiPart[] }>;
  generationConfig: { temperature: number; maxOutputTokens: number };
}

export function buildSystemInstruction(practiceSummary: string): string {
  return [
    COACH_INSTRUCTIONS,
    "",
    APP_KNOWLEDGE,
    "",
    "# This player's practice",
    "",
    practiceSummary,
  ].join("\n");
}

/**
 * The history the model is shown, oldest first and trimmed to the most recent
 * turns. A leading model turn is dropped: Gemini rejects a conversation that
 * does not open with the user, which is what a trim through a reply leaves.
 */
export function trimHistory(messages: ChatMessage[], maxTurns = MAX_TURNS): ChatMessage[] {
  const recent = messages.slice(-maxTurns);
  const firstUser = recent.findIndex((message) => message.role === "user");
  return firstUser <= 0 ? recent : recent.slice(firstUser);
}

export function buildGeminiRequest(messages: ChatMessage[], practiceSummary: string): GeminiRequest {
  return {
    systemInstruction: { parts: [{ text: buildSystemInstruction(practiceSummary) }] },
    contents: trimHistory(messages).map((message) => ({
      role: message.role,
      parts: [{ text: message.text }],
    })),
    generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
  };
}

/**
 * Validates what the browser posted. The application has one user, but a route
 * handler still cannot assume the shape of its own request body.
 */
export function parseChatMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const messages: ChatMessage[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const { role, text } = entry as { role?: unknown; text?: unknown };
    if (role !== "user" && role !== "model") return null;
    if (typeof text !== "string" || text.trim() === "") return null;
    messages.push({ role, text: text.slice(0, MAX_MESSAGE_CHARS) });
  }

  return messages.at(-1)?.role === "user" ? messages : null;
}
