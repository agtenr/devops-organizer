import { useCallback, useRef, useState, type PointerEvent } from 'react';

/**
 * Width state + drag-handle bindings for the resizable e-mail preview panel (see `plans/55/plan.md`).
 * The preview `InlineDrawer` is docked to the right (`position="end"`), so dragging its handle to the
 * left widens it. The drag uses the Pointer Events **capture** API on the handle element — no `window`
 * listeners and no `useEffect`, so it never trips `react-hooks/set-state-in-effect`
 * (`.claude/rules/frontend-architecture.md`). The width is in-memory only and resets on reload
 * (ratified OQ2 — no persistence).
 */

/** Fluent's `medium` drawer size in px — the panel's pre-resize width, kept as the starting point. */
const INITIAL_WIDTH = 592;
/** Never let the panel get narrower than this (the list still needs room). */
const MIN_WIDTH = 320;
/** Hard cap on the panel width regardless of viewport. */
const MAX_WIDTH_CAP = 960;

/** Clamp a candidate width to `[MIN_WIDTH, min(80% of viewport, MAX_WIDTH_CAP)]`. */
function clampWidth(width: number): number {
  const max = Math.min(window.innerWidth * 0.8, MAX_WIDTH_CAP);
  return Math.max(MIN_WIDTH, Math.min(width, max));
}

/** The width + handle bindings `EmailList` consumes. */
export interface UseResizablePanelResult {
  /** Current panel width in px; drives the drawer's `--fui-Drawer--size`. */
  width: number;
  /** Spread onto the drag-handle element to make it resize the panel. */
  handleProps: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  };
}

export function useResizablePanel(): UseResizablePanelResult {
  const [width, setWidth] = useState(INITIAL_WIDTH);
  // Drag origin captured on pointer-down; a ref so the move handler reads it without re-rendering.
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      // Capture the pointer so subsequent moves fire on the handle even as the cursor leaves it.
      event.preventDefault();
      drag.current = { startX: event.clientX, startWidth: width };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [width],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!drag.current) {
      return;
    }
    // Right-docked drawer: a leftward drag (smaller clientX) widens it.
    setWidth(clampWidth(drag.current.startWidth + (drag.current.startX - event.clientX)));
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  return { width, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}
