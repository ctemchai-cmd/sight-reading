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
  it("keeps one clock-driven cursor and paints note-local feedback", async () => {
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
    const { container, rerender } = render(
      <MusicStaff
        notes={notes}
        currentIndex={0}
        mode="sheet"
        beatCursor
        beatCursorRunning
        beatDurationMs={1_000}
        beatStartedAtMs={performance.now() - 250}
        performanceFeedback={{ id: 1, noteIndex: 0, kind: "perfect" }}
      />,
    );

    const cursor = await waitFor(() => {
      const element = container.querySelector<HTMLElement>(".sheet-beat-cursor");
      expect(element).not.toBeNull();
      expect(element?.style.transform).toContain("translate3d");
      return element!;
    });
    expect(cursor.style.left).toBe("0px");
    expect(animate).not.toHaveBeenCalled();

    expect(await waitFor(() => container.querySelector(".performance-hit-grade-perfect"))).toHaveTextContent("Perfect");
    const note = container.querySelector<SVGElement>('[data-performance-note-index="0"]');
    expect(note?.style.fill).toBe("#38bdf8");

    rerender(
      <MusicStaff
        notes={notes}
        currentIndex={0}
        mode="sheet"
        beatCursor
        beatCursorRunning
        beatDurationMs={1_000}
        beatStartedAtMs={performance.now() - 300}
        performanceFeedback={{ id: 2, noteIndex: 0, kind: "wrong" }}
      />,
    );
    expect(await waitFor(() => container.querySelector(".performance-hit-grade-wrong"))).toHaveTextContent("Wrong");
    await waitFor(() => expect(note?.style.fill).toBe("#fb7185"));
  });
});
