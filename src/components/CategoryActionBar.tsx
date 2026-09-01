import React from 'react';

/**
 * The one premium sticky bottom dock shared by every NOQ category page.
 *
 * The material, proportions and motion here are lifted verbatim from the
 * Salon detail page's dock — the two-state glass (translucent floating glass
 * when nothing is selected, opaque warm blurred-mirror lens once there is
 * something to read), the masked-gradient rim, the fine noise, the diagonal
 * sheen, the safe-area padding, the 22px radius, and the grid-rows expand of
 * the summary region that keeps it mounted so it animates instead of popping.
 *
 * Only the *chrome* is shared. Every category supplies its own content:
 * Salon passes its services summary + Join Queue / Reserve buttons, Gym
 * passes its access summary + Choose Access / Payment / Check Out button.
 * Nothing category-specific lives in this file, so Shop / Moto / Pets can
 * adopt it without touching either existing caller.
 *
 * Contract:
 *   expanded    — whether the dock uses the opaque lens material (there is
 *                 something solid to read) or the lighter zero-state glass.
 *   summaryOpen — whether the summary region is open; defaults to `expanded`.
 *                 The `summary` node stays mounted either way, which is what
 *                 makes it animate open/closed instead of popping in and out.
 *   summary     — the expandable region above the action row (optional).
 *   children  — the always-visible action row.
 *   bounce    — one-shot micro-bounce, driven by the caller when its
 *               selection changes (`dock-bounce` keyframes live in the app CSS).
 */
export const CategoryActionBar: React.FC<{
  expanded?: boolean;
  summaryOpen?: boolean;
  summary?: React.ReactNode;
  bounce?: boolean;
  children: React.ReactNode;
  id?: string;
}> = ({ expanded = false, summaryOpen, summary, bounce = false, children, id }) => {
  const open = summaryOpen ?? expanded;
  return (
  <div id={id} className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
    <div
      className={`relative mx-auto max-w-xl overflow-hidden rounded-[22px] p-2.5 transition-all duration-300 ${
        expanded
          ? 'border border-[var(--noq-glass-border)] bg-gradient-to-b from-white/90 via-white/78 to-[var(--noq-surface-soft)]/90 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_0_24px_rgba(255,255,255,0.35),0_-14px_32px_-12px_var(--noq-glow),0_12px_36px_-16px_var(--noq-glow)] backdrop-blur-2xl backdrop-saturate-[2.2] backdrop-brightness-[1.06]'
          : 'border border-[var(--noq-glass-border)] bg-gradient-to-br from-white/80 via-white/65 to-[var(--noq-tint-10)] shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_0_0_1px_rgba(255,255,255,0.35),0_-14px_30px_-18px_var(--noq-glow),0_8px_24px_-16px_var(--noq-glow)] backdrop-blur-2xl backdrop-saturate-[1.8]'
      } ${bounce ? 'dock-bounce' : ''}`}
    >
      {expanded && (
        <>
          {/* Premium blurred mirror / frosted glass material highlights */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
            style={{
              background:
                'linear-gradient(125deg, rgba(255,255,255,0.95), var(--noq-glow) 35%, rgba(255,255,255,0.35) 55%, var(--noq-soft-reflection) 75%, rgba(255,255,255,0.85))',
              WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute inset-0 rounded-[22px] opacity-[0.14] mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
              backgroundSize: '140px 140px',
            }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -inset-x-[10%] -inset-y-[20%] rounded-[22px] blur-[5px]"
            style={{ background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.12) 58%, transparent 75%)' }}
            aria-hidden="true"
          />
        </>
      )}
      {/* Faint top sheen for the zero-state glass — purely decorative. */}
      {!expanded && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.16] to-transparent" aria-hidden="true" />
      )}
      {summary !== undefined && (
        <div
          className="relative grid transition-[grid-template-rows] duration-[280ms] ease-out"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              className={`transition-all duration-[280ms] ease-out ${
                open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'
              }`}
            >
              {summary}
              <div className="h-2" />
            </div>
          </div>
        </div>
      )}
      <div className="relative grid grid-cols-[1fr_auto] gap-2">{children}</div>
    </div>
  </div>
  );
};
