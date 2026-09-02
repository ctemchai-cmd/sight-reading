import { describe, expect, it } from "vitest";
import { parseSessionLink } from "@/core/training/sessionConfig";

function link(query: string) {
  return parseSessionLink(new URLSearchParams(query));
}

describe("session links", () => {
  it("reads a fully specified session", () => {
    expect(link("focus=65,69,72&clef=bass&key=F&shape=thirds&length=50&tempo=60")).toEqual({
      focusMidis: [65, 69, 72],
      clef: "bass",
      keySignature: "F",
      melodicShape: "thirds",
      sessionLength: 50,
      tempoBpm: 60,
    });
  });

  it("leaves out what the link does not name", () => {
    expect(link("focus=60")).toEqual({
      focusMidis: [60],
      clef: undefined,
      keySignature: undefined,
      melodicShape: undefined,
      sessionLength: undefined,
      tempoBpm: undefined,
    });
  });

  // A typo quietly becoming C major would train the wrong thing without saying so.
  it("drops a value it does not recognise rather than defaulting it", () => {
    const parsed = link("clef=alto&key=H&shape=zigzag&length=37&tempo=1000");
    expect(parsed.clef).toBeUndefined();
    expect(parsed.keySignature).toBeUndefined();
    expect(parsed.melodicShape).toBeUndefined();
    expect(parsed.sessionLength).toBeUndefined();
    expect(parsed.tempoBpm).toBeUndefined();
  });

  it("sorts and de-duplicates focus pitches and rejects impossible ones", () => {
    expect(link("focus=72,60,72,999,-4,abc").focusMidis).toEqual([60, 72]);
    expect(link("").focusMidis).toEqual([]);
  });

  it("accepts an endless session", () => {
    expect(link("length=endless").sessionLength).toBe("endless");
  });
});
