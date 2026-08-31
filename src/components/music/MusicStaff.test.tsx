import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MusicStaff } from "@/components/music/MusicStaff";
import type { TargetNote } from "@/types/music";

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    measureText: () => ({
      width: 10,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 10,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    }),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe("MusicStaff Performance cursor", () => {
  it("travels toward the following note for exactly one beat", async () => {
    const notes: TargetNote[] = [60, 62, 64, 65].map((midi, index) => ({
      id: `note-${midi}`,
      expectedMidi: midi,
      notation: {
        letter: (["C", "D", "E", "F"] as const)[index],
        accidental: "natural",
        octave: 4,
      },
    }));
    const { container } = render(
      <MusicStaff
        notes={notes}
        currentIndex={0}
        mode="sheet"
        beatCursor
        beatCursorRunning
        beatDurationMs={1_000}
      />,
    );

    await waitFor(() => expect(container.querySelector(".sheet-beat-cursor-moving")).not.toBeNull());
    const cursor = container.querySelector<HTMLElement>(".sheet-beat-cursor-moving");
    expect(cursor?.style.animationDuration).toBe("1000ms");
    expect(cursor?.style.getPropertyValue("--cursor-travel-x")).not.toBe("0px");
  });
});
