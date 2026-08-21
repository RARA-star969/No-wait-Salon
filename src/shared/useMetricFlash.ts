import { useEffect, useRef, useState } from 'react';

/**
 * Single source of truth for "this live metric just changed" — previously
 * duplicated as separate useFlashOnChange copies in LiveQueueCard and
 * LiveQueueScoreboard. Flags a value as flashing for FLASH_DURATION_MS
 * whenever it differs from the previous render, so the full card and the
 * capsule pulse identically for the same real-world change and never flash
 * on an identical re-render or on mount.
 */
export const FLASH_DURATION_MS = 650;

export function useMetricFlash<T>(value: T): boolean {
  const previous = useRef(value);
  const [flashing, setFlashing] = useState(false);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), FLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return flashing;
}
