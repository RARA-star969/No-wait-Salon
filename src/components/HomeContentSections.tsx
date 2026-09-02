import React from 'react';
import { Radio, CalendarCheck, Bell, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';
import type { AIQueueInsight } from '../shared/queueInsight';

const WHY_NOQ_ITEMS: Array<{ Icon: React.FC<{ className?: string; strokeWidth?: number }>; title: string; description: string }> = [
  { Icon: Radio, title: 'Live queue', description: 'See real-time crowd levels' },
  { Icon: CalendarCheck, title: 'Book ahead', description: 'Reserve your spot in advance' },
  { Icon: Bell, title: 'Smart alerts', description: 'Get notified, stay ahead' },
];

const CARD_SHADOW_CLASS = 'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-18px_rgba(38,83,235,0.45)]';

export const WhyNoqSection: React.FC = () => (
  <section aria-labelledby="why-noq-heading">
    <h2
      id="why-noq-heading"
      className="mb-3 px-1 text-base font-black tracking-tight text-[color:var(--noq-ink)]"
    >
      Why NOQ
    </h2>
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
      {WHY_NOQ_ITEMS.map(({ Icon, title, description }) => (
        <div
          key={title}
          className={`flex flex-col items-start gap-2 rounded-2xl border border-[color:var(--noq-border)] bg-[color:var(--noq-card)] p-3 ${CARD_SHADOW_CLASS} sm:p-3.5`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--noq-blue-soft)] text-[color:var(--noq-blue)]">
            <Icon className="h-4.5 w-4.5" strokeWidth={2.1} />
          </span>
          <div>
            <p className="text-[12px] font-extrabold leading-tight text-[color:var(--noq-ink)] sm:text-[13px]">
              {title}
            </p>
            <p className="mt-0.5 text-[10.5px] leading-snug text-[color:var(--noq-muted)] sm:text-[11px]">
              {description}
            </p>
          </div>
        </div>
      ))}
    </div>
  </section>
);

const InsightMiniBarChart: React.FC<{ hourlyLoad: number[]; idealIndex: number }> = ({ hourlyLoad, idealIndex }) => {
  const max = Math.max(...hourlyLoad, 1);
  return (
    <div className="flex h-12 items-end gap-[3px]" aria-hidden="true">
      {hourlyLoad.map((value, index) => {
        const heightPct = Math.max(12, Math.round((value / max) * 100));
        const isIdeal = index === idealIndex;
        return (
          <span
            key={index}
            style={{ height: `${heightPct}%` }}
            className={`w-1.5 rounded-full sm:w-2 ${isIdeal ? 'bg-[color:var(--noq-blue)]' : 'bg-[color:var(--noq-blue-soft)]'}`}
          />
        );
      })}
    </div>
  );
};

export const AIQueueInsightCard: React.FC<{ insight: AIQueueInsight | null }> = ({ insight }) => (
  <div
    className={`flex flex-col rounded-2xl border border-[color:var(--noq-border)] bg-[color:var(--noq-card)] p-4 ${CARD_SHADOW_CLASS}`}
  >
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1.5">
        <p className="truncate text-[13px] font-extrabold text-[color:var(--noq-ink)]">AI Queue Insight</p>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[color:var(--noq-blue)]" />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
    </div>

    {insight ? (
      <>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-[color:var(--noq-muted)]">
          Best time to visit nearby
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-black leading-tight text-[color:var(--noq-blue)] sm:text-[15px]">
            {insight.rangeLabel}
          </p>
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
            {insight.source === 'live' ? 'Ideal' : 'Ideal · Preview'}
          </span>
        </div>
        <div className="mt-3">
          <InsightMiniBarChart hourlyLoad={insight.hourlyLoad} idealIndex={insight.idealIndex} />
        </div>
        {insight.source === 'demo' && (
          <p className="mt-2 text-[9.5px] font-medium leading-snug text-[color:var(--noq-muted)]">
            Sample preview — live insight activates once we have enough queue data.
          </p>
        )}
      </>
    ) : (
      <div className="mt-4 flex flex-col items-start gap-1">
        <p className="text-[12px] font-bold text-[color:var(--noq-ink)]">Not enough live data yet</p>
        <p className="text-[10.5px] leading-snug text-[color:var(--noq-muted)]">
          We'll show your best time to visit once nearby queues have enough activity.
        </p>
      </div>
    )}
  </div>
);

export const AboutNoqCard: React.FC<{ onLearnMore?: () => void }> = ({ onLearnMore }) => (
  <div
    className={`flex flex-col rounded-2xl border border-[color:var(--noq-border)] bg-[color:var(--noq-card)] p-4 ${CARD_SHADOW_CLASS}`}
  >
    <div className="flex items-center justify-between gap-2">
      <p className="text-[13px] font-extrabold text-[color:var(--noq-ink)]">About NOQ</p>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--noq-blue-soft)] text-[color:var(--noq-blue)]">
        <ShieldCheck className="h-4 w-4" strokeWidth={2.1} />
      </span>
    </div>
    <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--noq-muted)]">
      We help people discover businesses, view live crowd levels, and access services with less waiting.
    </p>
    <button
      type="button"
      onClick={onLearnMore}
      className="mt-3 inline-flex items-center gap-1 self-start text-[11px] font-bold text-[color:var(--noq-blue)] transition active:scale-[0.98]"
    >
      Learn more <ChevronRight className="h-3.5 w-3.5" />
    </button>
  </div>
);

export const HomeContentSections: React.FC<{
  insight: AIQueueInsight | null;
  onAboutLearnMore?: () => void;
}> = ({ insight, onAboutLearnMore }) => (
  <div className="space-y-5">
    <WhyNoqSection />
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      <AIQueueInsightCard insight={insight} />
      <AboutNoqCard onLearnMore={onAboutLearnMore} />
    </div>
  </div>
);
