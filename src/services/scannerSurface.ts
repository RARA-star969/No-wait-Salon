/**
 * Owns the "the scanner surface is up" state at the document level.
 *
 * Why this exists as its own module rather than an effect inside the modal:
 * hiding Home has to happen in the SAME synchronous turn as the tap that opens
 * the scanner. React's `useEffect` is deferred until after the browser has had
 * a chance to paint, so a class applied there always leaves at least one frame
 * where Home is still on screen while the scanner surface is coming up. On a
 * real device that frame is the visible "Home blink".
 *
 * Every scanner entry point calls `beginScannerSurface()` directly in its click
 * handler, so Home is gone before React even re-renders. The modal calls it
 * again on mount (idempotent) so any other future entry point is still safe.
 */

/** Home (#root) is hidden while this class is on <body>. */
const SURFACE_CLASS = 'scanner-open';
/** Set while the native ML Kit preview needs a see-through WebView. */
const NATIVE_PREVIEW_CLASS = 'barcode-scanner-active';

let depth = 0;

const body = (): HTMLElement | null => (typeof document === 'undefined' ? null : document.body);

/**
 * Hide Home and lock scrolling, synchronously. Safe to call more than once for
 * a single opening; the surface is only released when every caller has ended.
 */
export function beginScannerSurface(): void {
  depth += 1;
  body()?.classList.add(SURFACE_CLASS);
}

/** Release the surface and hand the screen back to Home. */
export function endScannerSurface(): void {
  depth = Math.max(0, depth - 1);
  if (depth > 0) return;
  const element = body();
  element?.classList.remove(SURFACE_CLASS);
  element?.classList.remove(NATIVE_PREVIEW_CLASS);
}

/** Make the WebView see-through so the native camera plane behind it shows. */
export function revealNativePreview(): void {
  body()?.classList.add(NATIVE_PREVIEW_CLASS);
}

/** Re-opaque the WebView before the camera is torn down. */
export function hideNativePreview(): void {
  body()?.classList.remove(NATIVE_PREVIEW_CLASS);
}

export function scannerSurfaceActive(): boolean {
  return Boolean(body()?.classList.contains(SURFACE_CLASS));
}

/** Test seam: forget any surface state left over from a previous case. */
export function resetScannerSurface(): void {
  depth = 0;
  const element = body();
  element?.classList.remove(SURFACE_CLASS);
  element?.classList.remove(NATIVE_PREVIEW_CLASS);
}
