import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface StaffHarnessProps {
  notes: Array<{ expectedMidi: number }>;
  currentIndex: number;
  beatCursorLeadIn?: boolean;
  performanceFeedbacks?: Array<{ noteIndex: number; kind: string }>;
}

const trainingHarness = vi.hoisted(() => ({
  staffProps: null as StaffHarnessProps | null,
  midiNoteOn: null as ((event: {
    midi: number;
    velocity: number;
    source: "midi";
    occurredAtMs: number;
  }) => void) | null,
}));

const audioEngine = {
  click: vi.fn(),
  noteOff: vi.fn(),
  noteOn: vi.fn(),
  playNote: vi.fn(),
  stopAll: vi.fn(),
};
const engineRef = { current: audioEngine };

// Rendered bare here, without the Suspense boundary the routes provide, so the
// hook has no router to read from.
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/music/MusicStaff", () => ({
  MusicStaff: (props: StaffHarnessProps) => {
    trainingHarness.staffProps = props;
    return <div>staff</div>;
  },
}));
vi.mock("@/components/music/PianoKeyboard", () => ({
  PianoKeyboard: ({ onNoteOn, onNoteOff }: { onNoteOn: (midi: number, velocity: number) => void; onNoteOff: (midi: number) => void }) => (
    <button type="button" onClick={() => { onNoteOn(60, 100); onNoteOff(60); }}>piano key</button>
  ),
}));
vi.mock("@/components/training/FocusSurface", () => ({
  FocusSurface: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/hooks/useAudio", () => ({
  useAudio: () => ({ engine: engineRef, error: null, initialize: vi.fn(async () => undefined) }),
}));
vi.mock("@/hooks/useComputerKeyboard", () => ({
  computerKeyboardGuide: "A-K",
  useComputerKeyboard: vi.fn(),
}));
vi.mock("@/hooks/useMidi", () => ({
  useMidi: vi.fn((onNoteOn: NonNullable<typeof trainingHarness.midiNoteOn>) => {
    trainingHarness.midiNoteOn = onNoteOn;
  }),
}));
vi.mock("@/lib/noteStats", () => ({ loadNoteHistory: vi.fn(async () => ({ stats: [], error: null })) }));
vi.mock("@/lib/sessionPersistence", () => ({ persistTrainingSession: vi.fn(async () => "synced") }));

import { NoteTrainer } from "@/components/training/NoteTrainer";

describe("NoteTrainer clock lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    trainingHarness.staffProps = null;
    trainingHarness.midiNoteOn = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops the Performance metronome when navigation unmounts the trainer", async () => {
    const view = render(<NoteTrainer mode="performance" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(3_000));
    expect(audioEngine.click.mock.calls.length).toBeGreaterThan(1);

    view.unmount();
    const clickCountAfterNavigation = audioEngine.click.mock.calls.length;
    act(() => vi.advanceTimersByTime(10_000));

    expect(audioEngine.click).toHaveBeenCalledTimes(clickCountAfterNavigation);
    expect(audioEngine.stopAll).toHaveBeenCalled();
  });

  it("holds app audio from note-on until the input releases it", async () => {
    render(<NoteTrainer mode="flash" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "piano key" }));

    expect(audioEngine.noteOn).toHaveBeenCalledWith(60, 100);
    expect(audioEngine.noteOff).toHaveBeenCalledWith(60);
    expect(audioEngine.playNote).not.toHaveBeenCalled();
  });

  it("scores against the new note when input beats a late timer callback", async () => {
    render(<NoteTrainer mode="performance" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(4_800));

    const nextMidi = trainingHarness.staffProps?.notes[1]?.expectedMidi;
    expect(nextMidi).toBeDefined();
    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: nextMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: performance.now() + 1_201,
      });
    });

    expect(trainingHarness.staffProps?.currentIndex).toBe(1);
    expect(trainingHarness.staffProps?.performanceFeedbacks?.at(-1)).toMatchObject({ noteIndex: 1, kind: "perfect" });
  });

  it("switches the scoring zone at the midpoint between notes", async () => {
    render(<NoteTrainer mode="performance" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(4_800));

    const currentMidi = trainingHarness.staffProps?.notes[0]?.expectedMidi;
    const nextMidi = trainingHarness.staffProps?.notes[1]?.expectedMidi;
    const firstBeatAt = performance.now();
    expect(currentMidi).toBeDefined();
    expect(nextMidi).toBeDefined();

    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: currentMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: firstBeatAt,
      });
    });
    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: nextMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: firstBeatAt + 599,
      });
    });
    expect(trainingHarness.staffProps?.performanceFeedbacks?.at(-1)).toMatchObject({ noteIndex: 0, kind: "wrong" });

    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: nextMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: firstBeatAt + 600,
      });
    });
    expect(trainingHarness.staffProps?.performanceFeedbacks?.at(-1)).toMatchObject({ noteIndex: 1, kind: "bad" });

    act(() => vi.advanceTimersByTime(1_200));
    expect(trainingHarness.staffProps?.currentIndex).toBe(1);
    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: nextMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: performance.now(),
      });
    });
    expect(trainingHarness.staffProps?.performanceFeedbacks?.at(-1)).toMatchObject({ noteIndex: 1, kind: "bad" });
  });

  it("keeps an early next-note grade visible when the previous note becomes Miss", async () => {
    render(<NoteTrainer mode="performance" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(5_400));
    const nextMidi = trainingHarness.staffProps?.notes[1]?.expectedMidi;
    expect(nextMidi).toBeDefined();

    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: nextMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: performance.now(),
      });
    });
    act(() => vi.advanceTimersByTime(600));

    expect(trainingHarness.staffProps?.performanceFeedbacks).toEqual(expect.arrayContaining([
      expect.objectContaining({ noteIndex: 1, kind: "bad" }),
      expect.objectContaining({ noteIndex: 0, kind: "miss" }),
    ]));
  });

  it("scores the first note during the latter half of a page-turn lead-in", async () => {
    render(<NoteTrainer mode="performance" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    // Four count-in beats, an initial run-up, sixteen played beats, then half of the page-turn
    // beat puts the cursor at the scoring boundary before the new line's A.
    act(() => vi.advanceTimersByTime(24_600));

    expect(trainingHarness.staffProps?.currentIndex).toBe(0);
    expect(trainingHarness.staffProps?.beatCursorLeadIn).toBe(true);
    const firstMidi = trainingHarness.staffProps?.notes[0]?.expectedMidi;
    expect(firstMidi).toBeDefined();

    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: firstMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: performance.now(),
      });
    });

    expect(trainingHarness.staffProps?.performanceFeedbacks?.at(-1)).toMatchObject({
      noteIndex: 0,
      kind: "bad",
    });

    act(() => vi.advanceTimersByTime(600));
    expect(trainingHarness.staffProps?.currentIndex).toBe(0);
    expect(trainingHarness.staffProps?.beatCursorLeadIn).toBe(false);
  });

  it("runs in from the clef before the first Performance note is due", async () => {
    render(<NoteTrainer mode="performance" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start training/i }));
      await Promise.resolve();
    });
    act(() => vi.advanceTimersByTime(3_600));

    expect(trainingHarness.staffProps?.currentIndex).toBe(0);
    expect(trainingHarness.staffProps?.beatCursorLeadIn).toBe(true);
    const firstMidi = trainingHarness.staffProps?.notes[0]?.expectedMidi;
    expect(firstMidi).toBeDefined();

    act(() => vi.advanceTimersByTime(600));
    await act(async () => {
      trainingHarness.midiNoteOn?.({
        midi: firstMidi!,
        velocity: 100,
        source: "midi",
        occurredAtMs: performance.now(),
      });
    });

    expect(trainingHarness.staffProps?.performanceFeedbacks?.at(-1)).toMatchObject({
      noteIndex: 0,
      kind: "bad",
    });
    act(() => vi.advanceTimersByTime(600));
    expect(trainingHarness.staffProps?.beatCursorLeadIn).toBe(false);
    expect(trainingHarness.staffProps?.currentIndex).toBe(0);
  });
});
