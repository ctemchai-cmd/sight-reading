import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PianoKeyboard } from "@/components/music/PianoKeyboard";

describe("PianoKeyboard", () => {
  it("normalizes a pointer press to the exact MIDI key", () => {
    const on = vi.fn();
    const off = vi.fn();
    render(<PianoKeyboard minMidi={60} maxMidi={64} onNoteOn={on} onNoteOff={off} />);
    const middleC = screen.getByRole("button", { name: "C4" });
    middleC.setPointerCapture = vi.fn();
    fireEvent.pointerDown(middleC, { pointerId: 1 });
    fireEvent.pointerUp(middleC, { pointerId: 1 });
    expect(on).toHaveBeenCalledWith(60, 100);
    expect(off).toHaveBeenCalledWith(60);
  });
});
