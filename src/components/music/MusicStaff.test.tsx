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
  it("catches its animation up to the metronome timestamp", async () => {
    const animate = vi.fn();
    animate.mockReturnValue({ cancel: vi.fn() } as unknown as Animation);
    Element.prototype.animate = animate as unknown as typeof Element.prototype.animate;
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
        beatStartedAtMs={performance.now() - 250}
      />,
    );

    await waitFor(() => expect(container.querySelector(".sheet-beat-cursor")).not.toBeNull());
    await waitFor(() => expect(animate).toHaveBeenCalled());
    const calls = animate.mock.calls as unknown as Array<[Keyframe[], KeyframeAnimationOptions]>;
    const options = calls.at(-1)![1];
    expect(options.duration).toBe(1_000);
    expect(Number(options.delay)).toBeLessThanOrEqual(-250);
  });
});
