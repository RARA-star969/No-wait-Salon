export type AIQueueInsight = {
  rangeLabel: string;
  hourlyLoad: number[];
  idealIndex: number;
  source: 'live' | 'demo';
};

type RawQueueInsightInput = {
  rangeLabel?: string | null;
  hourlyLoad?: number[] | null;
  idealIndex?: number | null;
};

// No live analytics pipeline feeds a genuine "best time to visit" yet, so
// this resolver only ever returns an insight once real hourly-load input
// arrives — it never fabricates one. Callers that have no input fall back to
// null (an honest "not enough data" UI) or opt into DEMO_QUEUE_INSIGHT below
// for a clearly-labeled TEST/preview state.
export function resolveQueueInsight(input: RawQueueInsightInput | null | undefined): AIQueueInsight | null {
  if (!input || !input.rangeLabel || !input.hourlyLoad || input.hourlyLoad.length < 2) return null;

  const maxLoad = Math.max(...input.hourlyLoad);
  const idealIndex =
    input.idealIndex != null && input.idealIndex >= 0 && input.idealIndex < input.hourlyLoad.length
      ? input.idealIndex
      : input.hourlyLoad.indexOf(maxLoad);

  return {
    rangeLabel: input.rangeLabel,
    hourlyLoad: input.hourlyLoad,
    idealIndex,
    source: 'live',
  };
}

// Sample-only preview data for TEST builds before a real queue-analytics
// pipeline exists. Never presented as "Ideal" without the accompanying
// "Preview" tag in the UI — see AIQueueInsightCard.
export const DEMO_QUEUE_INSIGHT: AIQueueInsight = {
  rangeLabel: '5:00 PM – 6:30 PM',
  hourlyLoad: [2, 3, 3, 4, 5, 6, 7, 6, 5, 8, 9, 4],
  idealIndex: 10,
  source: 'demo',
};
