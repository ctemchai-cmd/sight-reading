interface GeminiStreamChunk {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
}

/** The text a single `data:` payload carries, joined across its parts. */
export function textFromChunk(payload: string): string {
  let parsed: GeminiStreamChunk;
  try {
    parsed = JSON.parse(payload) as GeminiStreamChunk;
  } catch {
    return "";
  }
  return (parsed.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("");
}

/**
 * Pulls the reply text out of Gemini's `alt=sse` response.
 *
 * A network chunk is not a line: a `data:` payload can arrive split in half, so
 * the tail is held back until its newline shows up rather than being parsed as
 * truncated JSON and dropped.
 */
export function createSseTextDecoder(): (chunk: string) => string {
  let buffer = "";

  return (chunk: string): string => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    return lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => textFromChunk(line.slice("data:".length).trim()))
      .join("");
  };
}
