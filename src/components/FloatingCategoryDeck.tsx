import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MoveHorizontal } from 'lucide-react';
import { CategoryItemConfig, getCategoryIcon } from './CustomerHomeComponents';

type GestureIntent = 'pending' | 'horizontal' | 'vertical';

type DragState = {
  pointerId: number;
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

const DECK_PALETTES: Record<string, DeckPalette> = {
  salon: { from: '#053f46', middle: '#087f83', to: '#22d3c5', glow: 'rgba(45, 212, 191, .48)', edge: 'rgba(172, 255, 246, .72)' },
  gym: { from: '#32105d', middle: '#7226ba', to: '#c084fc', glow: 'rgba(168, 85, 247, .52)', edge: 'rgba(232, 205, 255, .76)' },
  shop: { from: '#643707', middle: '#bd7310', to: '#f8c34f', glow: 'rgba(245, 158, 11, .5)', edge: 'rgba(255, 236, 173, .8)' },
  moto: { from: '#071d57', middle: '#0b4ead', to: '#3294ff', glow: 'rgba(37, 99, 235, .52)', edge: 'rgba(190, 222, 255, .78)' },
  pets: { from: '#5d0a2c', middle: '#b01657', to: '#fb5d9a', glow: 'rgba(244, 63, 130, .5)', edge: 'rgba(255, 198, 222, .8)' },
  mall: { from: '#123449', middle: '#197493', to: '#50c9d7', glow: 'rgba(34, 211, 238, .44)', edge: 'rgba(202, 250, 255, .78)' },
  food: { from: '#62210b', middle: '#cc4e15', to: '#fb8b45', glow: 'rgba(249, 115, 22, .48)', edge: 'rgba(255, 213, 182, .78)' },
};

const FALLBACK_PALETTES: DeckPalette[] = [
  { from: '#1f245c', middle: '#4654bd', to: '#8da2ff', glow: 'rgba(99, 102, 241, .48)', edge: 'rgba(214, 219, 255, .76)' },
  { from: '#16452f', middle: '#24835b', to: '#62d99d', glow: 'rgba(34, 197, 94, .44)', edge: 'rgba(207, 255, 226, .76)' },
  { from: '#4b174d', middle: '#973d91', to: '#e987d9', glow: 'rgba(217, 70, 239, .45)', edge: 'rgba(255, 216, 250, .76)' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pure release projection, exported so Android-like flicks can be regression tested. */
export function resolveDeckTarget(
  activeIndex: number,
  dragX: number,
  velocityX: number,
  cardStep: number,
  categoryCount: number,
) {
  if (categoryCount <= 0) return 0;
  const projectedX = dragX + velocityX * 90;
  // A single physical flick may pass one neighbour, but should never fling a
  // customer across the whole deck because of a short WebView velocity spike.
  const delta = clamp(Math.round(-projectedX / Math.max(1, cardStep)), -2, 2);
  return clamp(activeIndex + delta, 0, categoryCount - 1);
}

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
  const suppressClickRef = useRef(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [stageWidth, setStageWidth] = useState(360);
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeIndex = Math.max(0, categories.findIndex((category) => category.id === selectedCategoryId));
  const cardStep = clamp(stageWidth * 0.255, 88, 112);
  const cardWidth = clamp(stageWidth * 0.64, 210, 244);
  const dragProgress = -dragX / cardStep;

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
  }, []);

  const setLiveDrag = (value: number) => {
    dragXRef.current = value;
    setDragX(value);
  };

  const selectIndex = (targetIndex: number) => {
    const target = categories[targetIndex];
    setLiveDrag(0);
    setDragging(false);
    if (!target || target.id === selectedCategoryId) return;
    pulseHaptic('snap');
    onSelectCategory(target.id);
  };

  const finishGesture = (cancelled = false) => {
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
    const target = resolveDeckTarget(activeIndex, dragXRef.current, gesture.velocityX, cardStep, categories.length);
    selectIndex(target);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocityX: 0,
      intent: 'pending',
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (gesture.intent === 'pending' && Math.hypot(dx, dy) >= 8) {
      if (Math.abs(dx) > Math.abs(dy) * 1.18) {
        gesture.intent = 'horizontal';
        setDragging(true);
        onExploreStart?.();
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* WebView may already own it. */ }
      } else {
        // Permanently yield this gesture to the authoritative vertical scroller.
        gesture.intent = 'vertical';
      }
    }

    if (gesture.intent !== 'horizontal') return;
    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
    const instantaneousVelocity = (event.clientX - gesture.lastX) / elapsed;
    gesture.velocityX = gesture.velocityX * 0.68 + instantaneousVelocity * 0.32;
    gesture.lastX = event.clientX;
    gesture.lastTime = event.timeStamp;

    const atStart = activeIndex === 0 && dx > 0;
    const atEnd = activeIndex === categories.length - 1 && dx < 0;
    setLiveDrag((atStart || atEnd) ? dx * 0.28 : dx);
  };

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
    return { relative, distance, x, scale, depth, rotate, opacity };
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
        className={`floating-category-stage ${dragging ? 'is-dragging' : ''}`}
        style={{ touchAction: 'pan-y' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => finishGesture(false)}
        onPointerCancel={() => finishGesture(true)}
        onLostPointerCapture={() => { if (dragRef.current?.intent === 'horizontal') finishGesture(false); }}
      >
        <div className="pointer-events-none absolute inset-x-[10%] bottom-5 h-16 rounded-[50%] bg-black/60 blur-2xl" />
        {categories.map((category, index) => {
          const transform = cardTransforms[index];
          const isActive = index === activeIndex;
          const palette = paletteFor(category, index);
          const Icon = getCategoryIcon(category.iconName);
          const settling = settlingId === category.id;
          const zIndex = 100 - Math.round(transform.distance * 10);
          return (
            <button
              key={category.id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              aria-label={`${category.name}${isActive ? ', selected. Tap to explore' : ', tap to select'}`}
              onClick={() => openActiveCategory(category.id)}
              className={`floating-glass-card ${isActive ? 'is-active' : ''} ${settling ? 'is-settling' : ''}`}
              style={{
                width: cardWidth,
                zIndex,
                opacity: transform.opacity,
                transform: `translate3d(calc(-50% + ${transform.x}px), -50%, ${transform.depth}px) rotateY(${transform.rotate}deg) scale(${transform.scale})`,
                transitionDuration: dragging || reducedMotion ? '0ms' : '520ms',
                background: `linear-gradient(145deg, ${palette.edge} 0%, ${palette.to}b8 9%, ${palette.middle}d9 48%, ${palette.from}f2 100%)`,
                boxShadow: `inset 1px 1px 0 rgba(255,255,255,.82), inset -1px -2px 0 rgba(0,0,0,.2), inset 0 0 30px rgba(255,255,255,.11), 0 22px 44px -18px ${palette.glow}, 0 12px 24px -14px rgba(4,12,28,.8)`,
              }}
            >
              <span className="floating-glass-reflection" aria-hidden />
              <span className="floating-glass-caustic" aria-hidden />
              <span className="relative z-10 flex h-full flex-col justify-between p-4 text-left text-white">
                <span className="flex items-start justify-between gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/35 bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,.55),0_8px_18px_-10px_rgba(0,0,0,.8)] backdrop-blur-md">
                    <Icon className="h-6 w-6 drop-shadow-md" />
                  </span>
                  <span className="rounded-full border border-white/25 bg-black/10 px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[0.15em] backdrop-blur-md">
                    {category.businessCount ? `${category.businessCount} live` : 'Explore'}
                  </span>
                </span>
                <span>
                  <strong className="block text-[22px] font-black tracking-[-0.04em] drop-shadow-md">{category.name}</strong>
                  <span className="mt-0.5 block max-w-[180px] truncate text-[10px] font-semibold text-white/78">
                    {category.description || category.label}
                  </span>
                </span>
              </span>
            </button>
          );
        })}

        <div className="pointer-events-none absolute inset-x-0 bottom-1 z-[120] flex items-center justify-center gap-3 text-slate-400">
          <ChevronLeft className={`h-3.5 w-3.5 ${activeIndex === 0 ? 'opacity-20' : 'opacity-70'}`} />
          <div className="flex items-center gap-1.5">
            {categories.map((category, index) => (
              <span key={category.id} className={`h-1 rounded-full transition-all duration-300 ${index === activeIndex ? 'w-5 bg-white/85' : 'w-1.5 bg-white/20'}`} />
            ))}
          </div>
          <ChevronRight className={`h-3.5 w-3.5 ${activeIndex === categories.length - 1 ? 'opacity-20' : 'opacity-70'}`} />
        </div>
      </div>
    </section>
  );
};
