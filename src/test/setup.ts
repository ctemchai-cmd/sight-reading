import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Without `globals`, Testing Library never registers its own teardown, so a
// second render in one file finds the first still in the document.
afterEach(cleanup);

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
