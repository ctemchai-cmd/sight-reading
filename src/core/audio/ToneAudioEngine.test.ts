import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("tone", () => ({
  Frequency: vi.fn((midi: number) => ({ toNote: () => `midi-${midi}` })),
  Sampler: class Sampler {},
  PolySynth: class PolySynth {},
  MonoSynth: class MonoSynth {},
  MembraneSynth: class MembraneSynth {},
  start: vi.fn(async () => undefined),
  getContext: vi.fn(() => ({ lookAhead: 0 })),
}));

import { ToneAudioEngine } from "@/core/audio/ToneAudioEngine";

describe("ToneAudioEngine sustain", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defers a released key until the pedal rises", () => {
    const engine = new ToneAudioEngine();
    const instrument = {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn(),
      volume: { value: 0 },
    };
    (engine as unknown as { instrument: typeof instrument }).instrument = instrument;

    engine.noteOn(60, 100);
    instrument.triggerRelease.mockClear();
    engine.setSustain(true);
    engine.noteOff(60);

    expect(instrument.triggerRelease).not.toHaveBeenCalled();
    engine.setSustain(false);
    expect(instrument.triggerRelease).toHaveBeenCalledWith("midi-60");
    engine.stopAll();
  });

  it("releases a sustained voice before re-striking the same pitch", () => {
    const engine = new ToneAudioEngine();
    const instrument = {
      triggerAttack: vi.fn(),
      triggerRelease: vi.fn(),
      releaseAll: vi.fn(),
      volume: { value: 0 },
    };
    (engine as unknown as { instrument: typeof instrument }).instrument = instrument;

    engine.setSustain(true);
    engine.noteOn(64);
    engine.noteOff(64);
    instrument.triggerRelease.mockClear();
    engine.noteOn(64);

    expect(instrument.triggerRelease).toHaveBeenCalledWith("midi-64");
    expect(instrument.triggerAttack).toHaveBeenCalledTimes(2);
    engine.stopAll();
  });
});
