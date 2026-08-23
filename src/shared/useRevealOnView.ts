import { useEffect, useRef, useState } from 'react';

/**
 * Fires exactly once when the returned ref's element first enters the
 * viewport, so a card can play a single tasteful reveal animation instead of
 * looping continuously. Starts already "revealed" when IntersectionObserver
 * is unavailable (SSR/test environments) so content is never stuck hidden.
 */
export function useRevealOnView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (revealed || typeof IntersectionObserver === 'undefined') return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed]);

  return { ref, revealed };
}
