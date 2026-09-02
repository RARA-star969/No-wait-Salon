import React from 'react';
import { Radio, CalendarCheck, Bell, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';
import type { AIQueueInsightState } from '../shared/aiQueueInsight';

/**
 * Static Home content below the admin-driven carousel: "Why NOQ", the
 * "AI Queue Insight" preview card, and "About NOQ". Styling reuses the
 * existing NOQ tokens (--noq-ink/--noq-muted/--noq-accent/--noq-tint-*) and
 * the same `bg-white rounded-2xl` card convention that `.noq-customer-page`
 * already turns into the app's neumorphic raised surface — no new design
 * tokens or CSS are introduced.
 */

const WHY_NOQ_ITEMS: Array<{ Icon: React.FC<{ className?: string; strokeWidth?: number }>; title: string; description: string }> = [
  { Icon: Radio, title: 'Live queue', description: 'See real-time crowd levels' },
  { Icon: CalendarCheck, title: 'Book ahead', description: 'Reserve your spot in advance' },
  { Icon: Bell, title: 'Smart alerts', description: 'Get notified, stay ahead' },
];

export const WhyNoqSection: React.FC = () => (
  <section aria-labelledby="why-noq-heading">
    <h2 id="why-noq-heading" className="mb-2.5 px-0.5 text-[15px] font-bold tracking-tight text-[var(--noq-ink)]">
      Why NOQ
    </h2>
    <div className="grid grid-cols-3 gap-2.5">
      {WHY_NOQ_ITEMS.map(({ Icon, title, description }) => (
        <div key={title} className="flex flex-col items-start gap-2 rounded-2xl bg-white p-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--noq-tint-10)', color: 'var(--noq-accent)' }}
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
          </span>
          <div>
            <p className="text-[11.5px] font-bold leading-tight text-[var(--noq-ink)]">{title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-[var(--noq-muted)]">{description}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

/** Uniform, non-numeric skeleton bars — a decorative placeholder shape, never
 *  read as real load data. Used only while no real insight is available. */
const InsightSkeletonBars: React.FC = () => (
  <div className="flex h-11 items-end gap-[3px]" aria-hidden="true">
    {[38, 52, 44, 66, 50, 72, 58, 46, 62, 40].map((heightPct, index) => (
      <span
        key={index}
        style={{ height: `${heightPct}%`, background: 'var(--noq-tint-10)' }}
        className="w-1.5 rounded-full"
      />
    ))}
  </div>
);

const InsightLiveBars: React.FC<{ hourlyLoad: number[]; idealIndex: number }> = ({ hourlyLoad, idealIndex }) => {
  const max = Math.max(...hourlyLoad, 1);
  return (
    <div className="flex h-11 items-end gap-[3px]" aria-hidden="true">
      {hourlyLoad.map((value, index) => {
        const heightPct = Math.max(12, Math.round((value / max) * 100));
        const isIdeal = index === idealIndex;
        return (
          <span
            key={index}
            style={{
              height: `${heightPct}%`,
              background: isIdeal ? 'var(--noq-accent)' : 'var(--noq-tint-10)',
            }}
            className="w-1.5 rounded-full"
          />
        );
      })}
    </div>
  );
};

export const AIQueueInsightCard: React.FC<{ insight: AIQueueInsightState }> = ({ insight }) => (
  <div className="flex flex-col rounded-2xl bg-white p-4">
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="truncate text-[12.5px] font-bold text-[var(--noq-ink)]">AI Queue Insight</p>
        <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--noq-accent)' }} />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--noq-text-subtle)]" />
    </div>

    {insight.status === 'ready' ? (
      <>
        <p className="mt-3 text-[9.5px] font-bold uppercase tracking-wide text-[var(--noq-muted)]">
          Best time to visit nearby
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-[13.5px] font-black leading-tight" style={{ color: 'var(--noq-accent)' }}>
            {insight.rangeLabel}
          </p>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
            Ideal
          </span>
        </div>
        <div className="mt-3">
          <InsightLiveBars hourlyLoad={insight.hourlyLoad} idealIndex={insight.idealIndex} />
        </div>
      </>
    ) : (
      <>
        <p className="mt-3 text-[9.5px] font-bold uppercase tracking-wide text-[var(--noq-muted)]">
          Best time to visit nearby
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-[12px] font-bold leading-tight text-[var(--noq-ink)]">Coming soon</p>
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold"
            style={{ background: 'var(--noq-tint-10)', color: 'var(--noq-muted)' }}
          >
            Preview
          </span>
        </div>
        <div className="mt-3">
          <InsightSkeletonBars />
        </div>
        <p className="mt-2 text-[9.5px] font-medium leading-snug text-[var(--noq-muted)]">
          We&apos;ll surface your best time to visit once nearby queues have enough live activity.
        </p>
      </>
    )}
  </div>
);

export const AboutNoqCard: React.FC<{ onLearnMore?: () => void }> = ({ onLearnMore }) => (
  <div className="flex flex-col rounded-2xl bg-white p-4">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[12.5px] font-bold text-[var(--noq-ink)]">About NOQ</p>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--noq-tint-10)', color: 'var(--noq-accent)' }}
      >
        <ShieldCheck className="h-4 w-4" strokeWidth={2.1} />
      </span>
    </div>
    <p className="mt-2 text-[10.5px] leading-relaxed text-[var(--noq-muted)]">
      We help people discover businesses, view live crowd levels, and access services with less waiting.
    </p>
    <button
      type="button"
      onClick={onLearnMore}
      className="mt-3 inline-flex items-center gap-1 self-start text-[10.5px] font-bold transition active:scale-[0.98]"
      style={{ color: 'var(--noq-accent)' }}
    >
      Learn more <ChevronRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

export const HomeContentSections: React.FC<{
  insight: AIQueueInsightState;
  onAboutLearnMore?: () => void;
}> = ({ insight, onAboutLearnMore }) => (
  <div className="space-y-3.5">
    <WhyNoqSection />
    <div className="grid grid-cols-2 gap-2.5">
      <AIQueueInsightCard insight={insight} />
      <AboutNoqCard onLearnMore={onAboutLearnMore} />
    </div>
  </div>
);
