import "@testing-library/jest-dom/vitest";

// jsdom has no layout engine and so no ResizeObserver. Components that observe
// their own size only need the constructor to exist.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
