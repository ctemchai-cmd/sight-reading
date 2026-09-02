import { describe, expect, it } from "vitest";
import { parseInline, parseMessage } from "@/core/assistant/markup";

describe("coach message markup", () => {
  it("turns a training link into a session segment", () => {
    const [segment] = parseInline("[Drill these](/train/reflex?focus=65,69&clef=bass)");
    expect(segment).toEqual({
      kind: "session",
      text: "Drill these",
      href: "/train/reflex?focus=65,69&clef=bass",
    });
  });

  // A link the trainer cannot honour must read as a mistake, not act as one.
  // Only the label survives; the href itself is never carried anywhere it
  // could be navigated to, whatever the model wrote.
  it("leaves any other link as plain text", () => {
    for (const href of ["https://example.com", "/dashboard", "/train/nonsense", "javascript:alert(1)"]) {
      const segments = parseInline(`[go](${href})`);
      expect(segments.some((segment) => segment.kind === "session"), href).toBe(false);
      expect(segments.map((segment) => segment.text).join(""), href).not.toContain(href);
    }
  });

  it("keeps the text around a link and a bold run", () => {
    expect(parseInline("Try **F4** now: [start](/train/flash)")).toEqual([
      { kind: "text", text: "Try " },
      { kind: "bold", text: "F4" },
      { kind: "text", text: " now: " },
      { kind: "session", text: "start", href: "/train/flash" },
    ]);
  });

  it("splits blocks and marks bullets", () => {
    const blocks = parseMessage("Your reading:\n\n- F4 is slow\n* C5 is fine\n");
    expect(blocks).toHaveLength(3);
    expect(blocks[0].bullet).toBe(false);
    expect(blocks[1]).toEqual({ bullet: true, segments: [{ kind: "text", text: "F4 is slow" }] });
    expect(blocks[2].bullet).toBe(true);
  });
});
