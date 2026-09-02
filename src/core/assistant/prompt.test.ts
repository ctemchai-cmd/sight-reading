import { describe, expect, it } from "vitest";
import { APP_KNOWLEDGE } from "@/core/assistant/knowledge";
import { MAX_MESSAGE_CHARS, buildGeminiRequest, parseChatMessages, trimHistory } from "@/core/assistant/prompt";
import { KEY_NAMES } from "@/core/music/keys";
import {
  FLUENT_ACCURACY,
  FLUENT_RESPONSE_MS,
  LABOURED_ACCURACY,
  LABOURED_RESPONSE_MS,
} from "@/core/training/fluency";
import type { ChatMessage } from "@/types/assistant";

describe("app knowledge", () => {
  // The coach quoting a threshold the dashboard has moved away from is worse
  // than no coach, so the numbers must come from the constants themselves.
  it("quotes the thresholds the application actually uses", () => {
    expect(APP_KNOWLEDGE).toContain(String(FLUENT_RESPONSE_MS));
    expect(APP_KNOWLEDGE).toContain(String(LABOURED_RESPONSE_MS));
    expect(APP_KNOWLEDGE).toContain(`${Math.round(FLUENT_ACCURACY * 100)}%`);
    expect(APP_KNOWLEDGE).toContain(`${Math.round(LABOURED_ACCURACY * 100)}%`);
  });

  it("names every key the trainer can generate", () => {
    for (const key of KEY_NAMES) expect(APP_KNOWLEDGE).toContain(key);
  });

  it("says which features do not exist, so the coach cannot recommend them", () => {
    expect(APP_KNOWLEDGE).toContain("Not built yet");
    expect(APP_KNOWLEDGE).toMatch(/grand staff/i);
  });
});

describe("request building", () => {
  const turns = (count: number): ChatMessage[] =>
    Array.from({ length: count }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "model",
      text: `turn ${index}`,
    }));

  it("keeps the most recent turns and opens on a user turn", () => {
    const trimmed = trimHistory(turns(30), 5);
    expect(trimmed).toHaveLength(4); // the 5th back is a model turn, and Gemini rejects that opening
    expect(trimmed[0].role).toBe("user");
    expect(trimmed.at(-1)?.text).toBe("turn 29");
  });

  it("puts the practice summary in the system instruction, not the conversation", () => {
    const request = buildGeminiRequest([{ role: "user", text: "what next?" }], "MEDIAN 1.2s");
    expect(request.systemInstruction.parts[0].text).toContain("MEDIAN 1.2s");
    expect(request.contents).toEqual([{ role: "user", parts: [{ text: "what next?" }] }]);
  });
});

describe("request parsing", () => {
  it("accepts a conversation ending in a question", () => {
    expect(parseChatMessages([{ role: "user", text: "hi" }])).toEqual([{ role: "user", text: "hi" }]);
  });

  it("rejects anything that is not a conversation awaiting a reply", () => {
    expect(parseChatMessages([])).toBeNull();
    expect(parseChatMessages("hello")).toBeNull();
    expect(parseChatMessages([{ role: "system", text: "hi" }])).toBeNull();
    expect(parseChatMessages([{ role: "user", text: "   " }])).toBeNull();
    // Ending on a model turn would ask Gemini to reply to itself.
    expect(parseChatMessages([{ role: "user", text: "hi" }, { role: "model", text: "hello" }])).toBeNull();
  });

  it("truncates a message rather than refusing it", () => {
    const parsed = parseChatMessages([{ role: "user", text: "x".repeat(MAX_MESSAGE_CHARS + 500) }]);
    expect(parsed?.[0].text).toHaveLength(MAX_MESSAGE_CHARS);
  });
});
