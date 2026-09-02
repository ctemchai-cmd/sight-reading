import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NoteInputEvent } from "@/types/training";

const playHarness = vi.hoisted(() => ({
  midiNoteOn: null as ((event: NoteInputEvent) => void) | null,
  midiNoteOff: null as ((midi: number) => void) | null,
  midiSustain: null as ((down: boolean) => void) | null,
}));

const audioEngine = {
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  setSustain: vi.fn(),
  stopAll: vi.fn(),
};
const initialize = vi.fn(async () => undefined);
const engineRef = { current: audioEngine };

vi.mock("@/components/music/PianoKeyboard", () => ({
  PianoKeyboard: ({
    onNoteOn,
    onNoteOff,
  }: {
    onNoteOn: (midi: number, velocity: number) => void;
    onNoteOff: (midi: number) => void;
  }) => (
    <button type="button" onClick={() => { onNoteOn(60, 100); onNoteOff(60); }}>
      Virtual C4
    </button>
  ),
}));
vi.mock("@/components/training/FocusSurface", () => ({
  FocusSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAudio", () => ({
  useAudio: () => ({ engine: engineRef, error: null, initialize }),
}));
vi.mock("@/hooks/useComputerKeyboard", () => ({
  computerKeyboardGuide: "A-K",
  useComputerKeyboard: vi.fn(),
}));
vi.mock("@/hooks/useFocusMode", () => ({
  useFocusMode: () => ({
    focusMode: false,
    setFocusMode: vi.fn(),
    toggleFocusMode: vi.fn(),
  }),
}));
vi.mock("@/hooks/useMidi", () => ({
  useMidi: vi.fn((
    onNoteOn: NonNullable<typeof playHarness.midiNoteOn>,
    onNoteOff: NonNullable<typeof playHarness.midiNoteOff>,
    onSustain: NonNullable<typeof playHarness.midiSustain>,
  ) => {
    playHarness.midiNoteOn = onNoteOn;
    playHarness.midiNoteOff = onNoteOff;
    playHarness.midiSustain = onSustain;
  }),
}));

import { FreePlay } from "@/components/play/FreePlay";

describe("FreePlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    playHarness.midiNoteOn = null;
    playHarness.midiNoteOff = null;
    playHarness.midiSustain = null;
  });

  it("starts explicitly, then plays MIDI notes and tracks pedal state", async () => {
    render(<FreePlay />);

    act(() => {
      playHarness.midiNoteOn?.({
        midi: 62,
        velocity: 80,
        source: "midi",
        occurredAtMs: 1,
      });
      playHarness.midiSustain?.(true);
    });
    expect(audioEngine.noteOn).not.toHaveBeenCalled();
    expect(audioEngine.setSustain).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start playing/i }));
      await Promise.resolve();
    });
    expect(initialize).toHaveBeenCalledOnce();
    expect(screen.getByText("—")).toBeInTheDocument();

    act(() => {
      playHarness.midiNoteOn?.({
        midi: 64,
        velocity: 84,
        source: "midi",
        occurredAtMs: 2,
      });
    });
    expect(audioEngine.noteOn).toHaveBeenCalledWith(64, 84);
    expect(screen.getByText(/1 held/)).toBeInTheDocument();
    expect(screen.getByText("E4")).toBeInTheDocument();

    act(() => playHarness.midiSustain?.(true));
    expect(audioEngine.setSustain).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("Down")).toBeInTheDocument();

    act(() => playHarness.midiNoteOff?.(64));
    expect(audioEngine.noteOff).toHaveBeenCalledWith(64);
    expect(screen.queryByText(/1 held/)).toBeNull();
  });

  it("keeps reading input while muted and restores a held pedal with sound", async () => {
    render(<FreePlay />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start playing/i }));
      await Promise.resolve();
    });

    act(() => playHarness.midiSustain?.(true));
    fireEvent.click(screen.getByRole("button", { name: /Sound on/i }));
    expect(audioEngine.stopAll).toHaveBeenCalledOnce();

    act(() => {
      playHarness.midiNoteOn?.({
        midi: 67,
        velocity: 90,
        source: "midi",
        occurredAtMs: 3,
      });
    });
    expect(audioEngine.noteOn).not.toHaveBeenCalled();
    expect(screen.getByText("G4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sound off/i }));
    expect(audioEngine.setSustain).toHaveBeenLastCalledWith(true);
    act(() => playHarness.midiSustain?.(false));
    expect(audioEngine.setSustain).toHaveBeenLastCalledWith(false);
  });

  it("uses the same held-note lifecycle for the virtual piano", async () => {
    render(<FreePlay />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start playing/i }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Virtual C4" }));

    expect(audioEngine.noteOn).toHaveBeenCalledWith(60, 100);
    expect(audioEngine.noteOff).toHaveBeenCalledWith(60);
    expect(screen.getByText("C4")).toBeInTheDocument();
  });
});
