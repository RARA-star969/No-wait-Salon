/**
 * Controlled requestAnimationFrame scroll-to-top for Home's "Location &
 * search" return affordance. Native `scrollTo({ behavior: 'smooth' })` is
 * avoided because Android WebView's smooth-scroll timing is inconsistent
 * (sometimes janky, sometimes overshoots) — driving transform math ourselves
 * gives a distance-aware duration and a predictable 60fps easing curve on
 * every platform, and lets a real user touch/wheel/pointer interaction
 * cancel it immediately instead of fighting native scrolling.
 */

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Quintic ease-out: fast departure, long controlled glide, soft landing —
// reads as "premium", not bouncy.
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

export type SmoothScrollHandle = {
  cancel: () => void;
};

/**
 * Animates `el.scrollTop` to `targetTop`. Duration scales with distance
 * (500–750ms) and skips straight to the target under prefers-reduced-motion.
 * Returns a handle whose `cancel()` stops the animation immediately, leaving
 * the scroll wherever it currently is — callers should invoke it the instant
 * they see a genuine user-initiated scroll gesture.
 */
export function smoothScrollTo(el: HTMLElement, targetTop: number): SmoothScrollHandle {
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    el.scrollTop = targetTop;
    return { cancel: () => {} };
  }

  const startTop = el.scrollTop;
  const distance = targetTop - startTop;
  if (Math.abs(distance) < 1) {
    return { cancel: () => {} };
  }

  const duration = clamp(500 + (Math.min(1200, Math.abs(distance)) / 1200) * 250, 500, 750);
  const startTime = performance.now();
  let cancelled = false;
  let frame = 0;

  const step = (now: number) => {
    if (cancelled) return;
    const elapsed = now - startTime;
    const t = clamp(elapsed / duration, 0, 1);
    el.scrollTop = startTop + distance * easeOutQuint(t);
    if (t < 1) {
      frame = requestAnimationFrame(step);
    }
  };

  frame = requestAnimationFrame(step);

  return {
    cancel: () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
    },
  };
}
