/** Gemini names the two sides "user" and "model"; the wire format uses these verbatim. */
export type ChatRole = "user" | "model";

export interface ChatMessage {
  role: ChatRole;
  text: string;
}
