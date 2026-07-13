import '@testing-library/jest-dom';

// jsdom has no ResizeObserver, which Fluent UI's MessageBar (useMessageBarReflow) attaches on mount.
// Provide a no-op polyfill so components relying on it can render in the jsdom test environment.
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}
