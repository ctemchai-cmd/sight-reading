import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PianoKeyboard } from "@/components/music/PianoKeyboard";

describe("PianoKeyboard", () => {
  it("normalizes a pointer press to the exact MIDI key", () => {
    const on = vi.fn();
    const off = vi.fn();
    render(<PianoKeyboard trainingMinMidi={60} trainingMaxMidi={64} onNoteOn={on} onNoteOff={off} />);
    const middleC = screen.getByRole("button", { name: "C4" });
    middleC.setPointerCapture = vi.fn();
    fireEvent.pointerDown(middleC, { pointerId: 1 });
    fireEvent.pointerUp(middleC, { pointerId: 1 });
    expect(on).toHaveBeenCalledWith(60, 100);
    expect(off).toHaveBeenCalledWith(60);
  });

  it("sounds the note even when the pointer cannot be captured", () => {
    const on = vi.fn();
    render(<PianoKeyboard trainingMinMidi={60} trainingMaxMidi={64} onNoteOn={on} onNoteOff={vi.fn()} />);
    const key = screen.getByRole("button", { name: "C4" });
    // A pointer that has already gone throws here; the note must still sound.
    key.setPointerCapture = vi.fn(() => {
      throw new DOMException("no such pointer", "NotFoundError");
    });
    fireEvent.pointerDown(key, { pointerId: 1 });
    expect(on).toHaveBeenCalledWith(60, 100);
  });

  it("releases both notes when two are struck before either renders", () => {
    const off = vi.fn();
    render(<PianoKeyboard trainingMinMidi={60} trainingMaxMidi={67} onNoteOn={vi.fn()} onNoteOff={off} />);
    const first = screen.getByRole("button", { name: "C4" });
    const second = screen.getByRole("button", { name: "E4" });
    first.setPointerCapture = vi.fn();
    second.setPointerCapture = vi.fn();

    // Both down, then both up, with no render in between — a two-finger chord.
    fireEvent.pointerDown(first, { pointerId: 1 });
    fireEvent.pointerDown(second, { pointerId: 2 });
    fireEvent.pointerUp(first, { pointerId: 1 });
    fireEvent.pointerUp(second, { pointerId: 2 });

    expect(off).toHaveBeenCalledWith(60);
    expect(off).toHaveBeenCalledWith(64);
  });
});
