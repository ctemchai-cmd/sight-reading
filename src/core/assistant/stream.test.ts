import { describe, expect, it } from "vitest";
import { createSseTextDecoder, textFromChunk } from "@/core/assistant/stream";

function chunk(text: string): string {
  return JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] });
}

describe("Gemini stream decoding", () => {
  it("reads the text out of a chunk", () => {
    expect(textFromChunk(chunk("hello"))).toBe("hello");
  });

  it("ignores a chunk carrying no text", () => {
    expect(textFromChunk("{}")).toBe("");
    expect(textFromChunk("not json")).toBe("");
  });

  it("joins the reply across events", () => {
    const decode = createSseTextDecoder();
    expect(decode(`data: ${chunk("Prac")}\n\n`)).toBe("Prac");
    expect(decode(`data: ${chunk("tise ")}\n\ndata: ${chunk("F4.")}\n\n`)).toBe("tise F4.");
  });

  // A network chunk is not a line: parsing the tail as JSON would drop it.
  it("holds a payload split mid-way until its newline arrives", () => {
    const decode = createSseTextDecoder();
    const line = `data: ${chunk("split")}\n`;
    const half = Math.floor(line.length / 2);
    expect(decode(line.slice(0, half))).toBe("");
    expect(decode(line.slice(half))).toBe("split");
  });

  it("skips the blank lines and any comment the transport adds", () => {
    const decode = createSseTextDecoder();
    expect(decode(`: keep-alive\n\ndata: ${chunk("ok")}\n`)).toBe("ok");
  });
});
