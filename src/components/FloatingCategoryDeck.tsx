import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { CategoryItemConfig, getCategoryIcon } from './CustomerHomeComponents';

type GestureIntent = 'pending' | 'horizontal' | 'vertical';

type DragState = {
  startX: number;
  startY: number;
  lastX: number;
  lastTime: number;
  velocityX: number;
  intent: GestureIntent;
};

type DeckPalette = {
  from: string;
  middle: string;
  to: string;
  glow: string;
  edge: string;
};

// `glow` alphas are ~30% down from their original values (0.44–0.52) to pull
// the deck's halo back from neon/gaming territory toward polished glass;
// `edge` (the glass reflection highlight) is untouched.
const DECK_PALETTES: Record<string, DeckPalette> = {
  salon: { from: '#053f46', middle: '#087f83', to: '#22d3c5', glow: 'rgba(45, 212, 191, .336)', edge: 'rgba(172, 255, 246, .72)' },
  gym: { from: '#32105d', middle: '#7226ba', to: '#c084fc', glow: 'rgba(168, 85, 247, .364)', edge: 'rgba(232, 205, 255, .76)' },
  shop: { from: '#643707', middle: '#bd7310', to: '#f8c34f', glow: 'rgba(245, 158, 11, .35)', edge: 'rgba(255, 236, 173, .8)' },
  moto: { from: '#071d57', middle: '#0b4ead', to: '#3294ff', glow: 'rgba(37, 99, 235, .364)', edge: 'rgba(190, 222, 255, .78)' },
  pets: { from: '#5d0a2c', middle: '#b01657', to: '#fb5d9a', glow: 'rgba(244, 63, 130, .35)', edge: 'rgba(255, 198, 222, .8)' },
  mall: { from: '#123449', middle: '#197493', to: '#50c9d7', glow: 'rgba(34, 211, 238, .308)', edge: 'rgba(202, 250, 255, .78)' },
  food: { from: '#62210b', middle: '#cc4e15', to: '#fb8b45', glow: 'rgba(249, 115, 22, .336)', edge: 'rgba(255, 213, 182, .78)' },
};

const FALLBACK_PALETTES: DeckPalette[] = [
  { from: '#1f245c', middle: '#4654bd', to: '#8da2ff', glow: 'rgba(99, 102, 241, .336)', edge: 'rgba(214, 219, 255, .76)' },
  { from: '#16452f', middle: '#24835b', to: '#62d99d', glow: 'rgba(34, 197, 94, .308)', edge: 'rgba(207, 255, 226, .76)' },
  { from: '#4b174d', middle: '#973d91', to: '#e987d9', glow: 'rgba(217, 70, 239, .315)', edge: 'rgba(255, 216, 250, .76)' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Velocity-tiered release projection: a slow drag barely projects past where
 * the finger let go, a medium flick projects further, and a hard flick
 * projects the most — but is still capped so a single release can never
 * carry the deck more than 2 categories. Exported so both the Android-style
 * flick and the tiering itself can be regression tested independent of any
 * DOM/gesture plumbing.
 */
export function resolveDeckTarget(
  activeIndex: number,
  dragX: number,
  velocityX: number,
  cardStep: number,
  categoryCount: number,
) {
  if (categoryCount <= 0) return 0;
  const speed = Math.abs(velocityX);
  // px/ms bands tuned against the pointermove EMA smoothing below: a slow
  // drag rarely exceeds ~0.3px/ms, a deliberate flick lands ~0.4-0.9, and a
  // genuinely hard throw clears ~0.9.
  const projectionGain = speed < 0.32 ? 70 : speed < 0.9 ? 150 : 240;
  const projectedX = dragX + velocityX * projectionGain;
  // A single physical flick may pass one neighbour (or two on a hard throw),
  // but should never fling a customer across the whole category list.
  const delta = clamp(Math.round(-projectedX / Math.max(1, cardStep)), -2, 2);
  return clamp(activeIndex + delta, 0, categoryCount - 1);
}

/**
 * Exponential rubber-band: near zero it tracks the input almost 1:1, and as
 * the overscroll grows it asymptotically approaches `maxPull` — progressive
 * resistance instead of a flat linear damping factor. Exported so the edge
 * feel can be regression tested without simulating pointer/touch events.
 */
export function rubberBandResistance(overscroll: number, maxPull: number): number {
  if (maxPull <= 0) return 0;
  const sign = Math.sign(overscroll);
  const magnitude = Math.abs(overscroll);
  return sign * maxPull * (1 - Math.exp(-magnitude / maxPull));
}

/** Visual maximum for how far a card can be dragged past the first/last category. */
const EDGE_MAX_PULL = 44;
/** px/ms above which a release counts as a "hard" flick for bounce/kick tuning. */
const HARD_FLICK_SPEED = 0.9;

function paletteFor(category: CategoryItemConfig, index: number) {
  return DECK_PALETTES[category.themeKey || category.id] || FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];
}

function pulseHaptic(kind: 'snap' | 'open') {
  try {
    // Capacitor WebView forwards navigator.vibrate to Android. Keep this as a
    // single pulse: category changes never vibrate continuously while dragging.
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'open' ? 28 : 12);
    }
  } catch {
    // Haptics are an enhancement; unsupported devices stay silent.
  }
}

export type FloatingCategoryDeckProps = {
  categories: CategoryItemConfig[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onOpenCategory: (id: string) => void;
  onExploreStart?: () => void;
};

export const FloatingCategoryDeck: React.FC<FloatingCategoryDeckProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onOpenCategory,
  onExploreStart,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragXRef = useRef(0);
  const activePointerIdRef = useRef<number | null>(null);
  const activeTouchIdRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edgeBounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fastSnapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(360);
  const [reducedMotion, setReducedMotion] = useState(false);
  // A brief, transient release-only kick — never continuous, never a JS
  // physics loop. Both are cleared automatically a moment after they start.
  const [edgeBounce, setEdgeBounce] = useState<{ cardId: string; amp: number; duration: number } | null>(null);
  const [fastSnap, setFastSnap] = useState(false);

  const activeIndex = Math.max(0, categories.findIndex((category) => category.id === selectedCategoryId));
  // ~8-9% smaller than the original (stageWidth*0.64, max 244) footprint;
  // cardStep is scaled down by the same ratio so the 3D spacing/depth
  // character (how much cards overlap/stagger) reads the same as before,
  // just at the smaller size.
  const cardStep = clamp(stageWidth * 0.235, 82, 103);
  const cardWidth = clamp(stageWidth * 0.59, 196, 224);
  const dragProgress = -dragX / cardStep;

  // "Latest value" refs so the native touch listeners (attached once, see
  // below) and the stable gesture callbacks always see current state/props
  // without needing to re-attach on every render — re-attaching mid-touch on
  // iOS is exactly the kind of thing that drops a gesture.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const categoryCountRef = useRef(categories.length);
  categoryCountRef.current = categories.length;
  const cardStepRef = useRef(cardStep);
  cardStepRef.current = cardStep;
  const selectedCategoryIdRef = useRef(selectedCategoryId);
  selectedCategoryIdRef.current = selectedCategoryId;
  const onSelectCategoryRef = useRef(onSelectCategory);
  onSelectCategoryRef.current = onSelectCategory;
  const categoriesRef = useRef(categories);
  categoriesRef.current = categories;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener?.('change', sync);
    return () => query.removeEventListener?.('change', sync);
  }, []);

  useEffect(() => {
    if (!stageRef.current) return;
    const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    if (edgeBounceTimerRef.current) clearTimeout(edgeBounceTimerRef.current);
    if (fastSnapTimerRef.current) clearTimeout(fastSnapTimerRef.current);
  }, []);

  const setLiveDrag = (value: number) => {
    dragXRef.current = value;
    setDragX(value);
  };

  const selectIndex = useCallback((targetIndex: number) => {
    const target = categoriesRef.current[targetIndex];
    setLiveDrag(0);
    setDragging(false);
    if (!target || target.id === selectedCategoryIdRef.current) return;
    pulseHaptic('snap');
    onSelectCategoryRef.current(target.id);
  }, []);

  /** Shared by Pointer Events (mouse/pen) and the native touch fallback below. */
  const beginGesture = useCallback((x: number, y: number, time: number) => {
    dragRef.current = { startX: x, startY: y, lastX: x, lastTime: time, velocityX: 0, intent: 'pending' };
  }, []);

  const moveGesture = useCallback((x: number, y: number, time: number, preventDefault: () => void, onHorizontalLock?: () => void) => {
    const gesture = dragRef.current;
    if (!gesture) return;
    const dx = x - gesture.startX;
    const dy = y - gesture.startY;

    if (gesture.intent === 'pending' && Math.hypot(dx, dy) >= 8) {
      if (Math.abs(dx) > Math.abs(dy) * 1.18) {
        gesture.intent = 'horizontal';
        setDragging(true);
        // Deliberately does NOT call onExploreStart — horizontal category
        // browsing must never collapse Location/Search on its own. Only an
        // actual tap-to-open (see openActiveCategory) does that.
        onHorizontalLock?.();
      } else {
        // Permanently yield this gesture to the authoritative vertical scroller.
        gesture.intent = 'vertical';
      }
    }

    if (gesture.intent !== 'horizontal') return;
    // Only ever prevented once horizontal intent has actually won — the
    // pending window above (first ~8px) never blocks native scrolling.
    preventDefault();
    const elapsed = Math.max(1, time - gesture.lastTime);
    const instantaneousVelocity = (x - gesture.lastX) / elapsed;
    gesture.velocityX = gesture.velocityX * 0.68 + instantaneousVelocity * 0.32;
    gesture.lastX = x;
    gesture.lastTime = time;

    const atStart = activeIndexRef.current === 0 && dx > 0;
    const atEnd = activeIndexRef.current === categoryCountRef.current - 1 && dx < 0;
    setLiveDrag((atStart || atEnd) ? rubberBandResistance(dx, EDGE_MAX_PULL) : dx);
  }, []);

  const endGesture = useCallback((cancelled: boolean) => {
    const gesture = dragRef.current;
    dragRef.current = null;
    if (!gesture || gesture.intent !== 'horizontal') {
      setDragging(false);
      setLiveDrag(0);
      return;
    }
    suppressClickRef.current = true;
    queueMicrotask(() => { suppressClickRef.current = false; });
    if (cancelled) {
      setDragging(false);
      setLiveDrag(0);
      return;
    }

    const rawDx = dragXRef.current;
    const activeIndexAtRelease = activeIndexRef.current;
    const atStart = activeIndexAtRelease === 0 && rawDx > 0;
    const atEnd = activeIndexAtRelease === categoryCountRef.current - 1 && rawDx < 0;
    const speed = Math.abs(gesture.velocityX);
    const speedFactor = clamp(speed / HARD_FLICK_SPEED, 0, 1);

    if (atStart || atEnd) {
      // Pulled past the first/last category: nothing to select, just a
      // physical spring-back with a small opposite-direction overshoot,
      // scaled by how far it was pulled and how fast it was released.
      const overscroll = Math.abs(rawDx);
      const amp = clamp(8 + (overscroll / EDGE_MAX_PULL) * 6 + speedFactor * 4, 8, 18);
      const duration = clamp(280 + speedFactor * 140, 280, 420);
      const cardId = categoriesRef.current[activeIndexAtRelease]?.id;
      if (cardId) {
        if (edgeBounceTimerRef.current) clearTimeout(edgeBounceTimerRef.current);
        setEdgeBounce({ cardId, amp: Math.sign(rawDx) * -amp, duration });
        edgeBounceTimerRef.current = setTimeout(() => setEdgeBounce(null), duration);
      }
      setDragging(false);
      setLiveDrag(0);
      return;
    }

    const target = resolveDeckTarget(activeIndexAtRelease, rawDx, gesture.velocityX, cardStepRef.current, categoryCountRef.current);
    if (target !== activeIndexAtRelease && speed >= HARD_FLICK_SPEED) {
      // A restrained "this had real force" cue on a genuine hard flick — a
      // touch faster settle plus a tiny one-shot scale kick on the card that
      // becomes active, not a different animation altogether.
      if (fastSnapTimerRef.current) clearTimeout(fastSnapTimerRef.current);
      setFastSnap(true);
      fastSnapTimerRef.current = setTimeout(() => setFastSnap(false), 320);
    }
    selectIndex(target);
  }, [selectIndex]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Touch is handled exclusively by the native listeners below — WebKit's
    // touch-driven PointerEvents have proven unreliable for this gesture, and
    // handling both would double-track the same physical touch.
    if (event.pointerType === 'touch') return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    activePointerIdRef.current = event.pointerId;
    beginGesture(event.clientX, event.clientY, event.timeStamp);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;
    if (activePointerIdRef.current !== event.pointerId) return;
    const node = event.currentTarget;
    const id = event.pointerId;
    moveGesture(event.clientX, event.clientY, event.timeStamp, () => event.preventDefault(), () => {
      try { node.setPointerCapture(id); } catch { /* already captured or unsupported */ }
    });
  };

  const handlePointerFinish = (event: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (event.pointerType === 'touch') return;
    if (activePointerIdRef.current !== event.pointerId) return;
    activePointerIdRef.current = null;
    endGesture(cancelled);
  };

  // Native touch fallback for Safari/WebKit: attached once (not re-bound on
  // every render) so an in-progress touch is never dropped mid-gesture.
  // `touchmove` must be non-passive so preventDefault() actually suppresses
  // the native page pan once horizontal intent has won — Pointer Events
  // alone were not reliably honoring that on iOS.
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    const findTouch = (list: TouchList) => {
      for (let i = 0; i < list.length; i += 1) {
        if (list[i].identifier === activeTouchIdRef.current) return list[i];
      }
      return null;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (activeTouchIdRef.current !== null) return; // one gesture at a time
      const touch = event.changedTouches[0];
      if (!touch) return;
      activeTouchIdRef.current = touch.identifier;
      beginGesture(touch.clientX, touch.clientY, event.timeStamp);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (activeTouchIdRef.current === null) return;
      const touch = findTouch(event.touches);
      if (!touch) return;
      moveGesture(touch.clientX, touch.clientY, event.timeStamp, () => event.preventDefault());
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (activeTouchIdRef.current === null) return;
      const ended = Array.from(event.changedTouches).some((t) => t.identifier === activeTouchIdRef.current);
      if (!ended) return;
      activeTouchIdRef.current = null;
      endGesture(false);
    };

    const onTouchCancel = () => {
      if (activeTouchIdRef.current === null) return;
      activeTouchIdRef.current = null;
      endGesture(true);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd, { passive: true });
    node.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [beginGesture, moveGesture, endGesture]);

  const openActiveCategory = (id: string) => {
    if (suppressClickRef.current || dragging) return;
    const clickedIndex = categories.findIndex((category) => category.id === id);
    if (clickedIndex !== activeIndex) {
      selectIndex(clickedIndex);
      return;
    }
    pulseHaptic('open');
    onExploreStart?.();
    setSettlingId(id);
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      onOpenCategory(id);
      setSettlingId(null);
    }, reducedMotion ? 0 : 260);
  };

  const cardTransforms = useMemo(() => categories.map((_, index) => {
    const relative = index - (activeIndex + dragProgress);
    const distance = Math.abs(relative);
    const direction = Math.sign(relative);
    const spread = distance <= 1 ? distance * cardStep : cardStep + (distance - 1) * 38;
    const x = direction * spread;
    const scale = clamp(1 - distance * 0.11, 0.67, 1);
    const depth = -Math.min(190, distance * 62);
    const rotate = clamp(relative * -4.5, -12, 12);
    const opacity = clamp(1 - Math.max(0, distance - 2.4) * 0.24, 0.32, 1);
    // Rear-card material only — geometry above (x/scale/depth/rotate/opacity)
    // is the approved deck and stays untouched. These three purely control how
    // "readable" a card behind the active one looks: a denser frosted wash,
    // a soft mirror blur on the glass itself, and dimmer inner content so text
    // stops competing with the front card while the shape stays recognizable.
    // Nudged ~5% denser than before — still a frosted silhouette, not opaque.
    const frost = clamp(distance * 0.19, 0, 0.63);
    const frostBlur = clamp(distance * 1.4, 0, 5);
    const contentOpacity = clamp(1 - distance * 0.26, 0.3, 1);
    // Ambient idle-float tuning (Task 1) — active card drifts a touch more
    // than its neighbours, and neighbours are phase-offset so the stack
    // reads as loosely organic rather than moving in lockstep. Only cards
    // within `isNear` actually get the CSS animation applied (see className
    // below), so this is free to compute for every card without any cost.
    const isNear = distance <= 1.5;
    const floatAmp = clamp(4 - distance * 1.3, 2, 4);
    const floatDuration = 4 + (index % 2 === 0 ? 0 : 0.6);
    const floatDelay = relative * -0.35;
    return { relative, distance, x, scale, depth, rotate, opacity, frost, frostBlur, contentOpacity, isNear, floatAmp, floatDuration, floatDelay };
  }), [activeIndex, cardStep, categories, dragProgress]);

  return (
    <section className="floating-category-deck" aria-label="Business categories">
      <div className="mb-1 flex items-center justify-between px-1">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-400">Choose your world</span>
          <p className="mt-0.5 text-xs font-semibold text-slate-200">Swipe the floating deck</p>
        </div>
        <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[9px] font-bold text-slate-300 shadow-sm backdrop-blur-md">
          <MoveHorizontal className="h-3 w-3" /> Drag
        </span>
      </div>

      <div
        ref={stageRef}
        className={`floating-category-stage ${dragging ? 'is-dragging' : ''} ${fastSnap ? 'is-fast-snap' : ''}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => handlePointerFinish(event, false)}
        onPointerCancel={(event) => handlePointerFinish(event, true)}
        onLostPointerCapture={(event) => {
          if (event.pointerType === 'touch') return;
          if (dragRef.current?.intent === 'horizontal') handlePointerFinish(event, false);
        }}
      >
        <div className="pointer-events-none absolute inset-x-[10%] bottom-5 h-16 rounded-[50%] bg-black/60 blur-2xl" />
        {categories.map((category, index) => {
          const transform = cardTransforms[index];
          const isActive = index === activeIndex;
          const palette = paletteFor(category, index);
          const Icon = getCategoryIcon(category.iconName);
          const settling = settlingId === category.id;
          const bouncing = edgeBounce?.cardId === category.id;
          const zIndex = 100 - Math.round(transform.distance * 10);
          return (
            <button
              key={category.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              aria-label={`${category.name}${isActive ? ', selected. Tap to explore' : ', tap to select'}`}
              onClick={() => openActiveCategory(category.id)}
              className={`floating-glass-card ${isActive ? 'is-active' : ''} ${settling ? 'is-settling' : ''} ${bouncing ? 'is-edge-bouncing' : ''} ${transform.isNear && !reducedMotion ? 'is-near' : ''}`}
              style={{
                width: cardWidth,
                zIndex,
                opacity: transform.opacity,
                transform: `translate3d(calc(-50% + ${transform.x}px), -50%, ${transform.depth}px) rotateY(${transform.rotate}deg) scale(${transform.scale})`,
                transitionDuration: dragging || reducedMotion ? '0ms' : fastSnap ? '420ms' : '520ms',
                background: `linear-gradient(145deg, ${palette.edge} 0%, ${palette.to}b8 9%, ${palette.middle}d9 48%, ${palette.from}f2 100%)`,
                boxShadow: `inset 1px 1px 0 rgba(255,255,255,.82), inset -1px -2px 0 rgba(0,0,0,.2), inset 0 0 30px rgba(255,255,255,.11), 0 16px 32px -18px ${palette.glow}, 0 12px 24px -14px rgba(4,12,28,.8)`,
                // Ambient idle-float knobs consumed by the `.is-near` CSS
                // animation (see index.css) — pure CSS custom properties, no
                // JS timer. Cards further than `isNear` never get the class,
                // so these are simply unused (and free) for them.
                ['--float-amp' as any]: `${-transform.floatAmp}px`,
                ['--float-duration' as any]: `${transform.floatDuration}s`,
                ['--float-delay' as any]: `${transform.floatDelay}s`,
                ...(bouncing ? {
                  ['--edge-amp' as any]: `${edgeBounce!.amp}px`,
                  ['--edge-duration' as any]: `${edgeBounce!.duration}ms`,
                } : null),
              }}
            >
              <span className="floating-glass-reflection" aria-hidden />
              <span className="floating-glass-caustic" aria-hidden />
              {transform.frost > 0 && (
                <span
                  className="floating-glass-frost"
                  aria-hidden
                  style={{
                    backgroundColor: `rgba(8, 14, 20, ${transform.frost})`,
                    backdropFilter: `blur(${transform.frostBlur}px) saturate(${clamp(1 - transform.distance * 0.12, 0.7, 1)})`,
                    WebkitBackdropFilter: `blur(${transform.frostBlur}px) saturate(${clamp(1 - transform.distance * 0.12, 0.7, 1)})`,
                  }}
                />
              )}
              <span
                className="relative z-10 flex h-full flex-col justify-between p-3.5 text-left text-white"
                style={{
                  opacity: transform.contentOpacity,
                  transitionProperty: 'opacity',
                  transitionDuration: dragging || reducedMotion ? '0ms' : '520ms',
                  transitionTimingFunction: 'cubic-bezier(.2, .9, .18, 1.18)',
                }}
              >
                {/* No business-count badge here by design — top-right stays
                    clean, carried only by the glass reflection/caustic. */}
                <span className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-[16px] border border-white/35 bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_8px_18px_-10px_rgba(0,0,0,.8)] backdrop-blur-md">
                    <Icon className="h-5 w-5 drop-shadow-md" />
                  </span>
                </span>
                <span>
                  <strong className="block text-[20px] font-black tracking-[-0.04em] drop-shadow-md">{category.name}</strong>
                  <span className="mt-0.5 block max-w-[180px] truncate text-[10px] font-semibold text-white/78">
                    {category.description || category.label}
                  </span>
                </span>
              </span>
            </button>
          );
        })}

        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[120] flex items-center justify-center gap-3 text-slate-400">
          <button
            type="button"
            onClick={() => selectIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous category"
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full transition active:scale-90 disabled:pointer-events-none"
          >
            <ChevronLeft className={`h-3.5 w-3.5 ${activeIndex === 0 ? 'opacity-20' : 'opacity-70'}`} />
          </button>
          <div className="flex items-center gap-1.5">
            {categories.map((category, index) => (
              <span key={category.id} className={`h-1 rounded-full transition-all duration-300 ${index === activeIndex ? 'w-5 bg-white/85' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => selectIndex(activeIndex + 1)}
            disabled={activeIndex === categories.length - 1}
            aria-label="Next category"
            className="pointer-events-auto grid h-6 w-6 place-items-center rounded-full transition active:scale-90 disabled:pointer-events-none"
          >
            <ChevronRight className={`h-3.5 w-3.5 ${activeIndex === categories.length - 1 ? 'opacity-20' : 'opacity-70'}`} />
          </button>
        </div>
      </div>
    </section>
  );
};
