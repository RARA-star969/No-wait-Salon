/**
 * Pure state resolver for the Home "AI Queue Insight" card. There is no live
 * queue-analytics pipeline feeding a genuine "best time to visit" yet, so
 * this never fabricates one: absent real input it resolves to `unavailable`,
 * which the card renders as an honest, non-numeric "coming soon" state
 * rather than a wired demo/sample number presented as real data.
 */

export type AIQueueInsightState =
  | { status: 'unavailable' }
  | { status: 'ready'; rangeLabel: string; hourlyLoad: number[]; idealIndex: number };

type RawAIQueueInsightInput = {
  rangeLabel?: string | null;
  hourlyLoad?: number[] | null;
  idealIndex?: number | null;
};

export function resolveAIQueueInsight(input: RawAIQueueInsightInput | null | undefined): AIQueueInsightState {
  if (!input || !input.rangeLabel || !input.hourlyLoad || input.hourlyLoad.length < 2) {
    return { status: 'unavailable' };
  }

  const maxLoad = Math.max(...input.hourlyLoad);
  const idealIndex =
    input.idealIndex != null && input.idealIndex >= 0 && input.idealIndex < input.hourlyLoad.length
      ? input.idealIndex
      : input.hourlyLoad.indexOf(maxLoad);

  return {
    status: 'ready',
    rangeLabel: input.rangeLabel,
    hourlyLoad: input.hourlyLoad,
    idealIndex,
  };
}
