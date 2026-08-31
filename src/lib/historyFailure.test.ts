import { describe, expect, it } from "vitest";
import { classifyHistoryFailure } from "@/lib/historyFailure";

describe("telling refusals apart", () => {
  it("recognises a device clock running ahead of the server", () => {
    expect(classifyHistoryFailure("JWT issued at future")).toBe("clock");
    expect(classifyHistoryFailure('{"message":"jwt issued at is in the future"}')).toBe("clock");
  });

  it("separates a stale token from a refused one", () => {
    expect(classifyHistoryFailure("JWT expired")).toBe("expired");
    expect(classifyHistoryFailure("permission denied for table user_note_stats")).toBe("permission");
  });

  it("falls back rather than guessing", () => {
    expect(classifyHistoryFailure("something else entirely")).toBe("unknown");
    expect(classifyHistoryFailure("")).toBe("unknown");
  });
});
