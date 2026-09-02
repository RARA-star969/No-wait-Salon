import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { businessReviewService, formatOverallRating } from '../services/businessReviewService';

/**
 * Compact "★ 4.9 · 185 reviews" hero summary shared by Gym and Salon Detail —
 * reads the same business_review-backed endpoint PublicReviewsSection uses,
 * so the number here can never drift from the real reviews section below it.
 */
export const RatingSummaryBadge: React.FC<{ businessId: string; tone?: 'dark' | 'light' }> = ({ businessId, tone = 'dark' }) => {
  const [overallRating, setOverallRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    businessReviewService.list(businessId)
      .then((data) => {
        if (cancelled) return;
        setOverallRating(data.overallRating);
        setTotalReviews(data.totalReviews);
      })
      .catch(() => { if (!cancelled) setTotalReviews((current) => current ?? 0); });
    return () => { cancelled = true; };
  }, [businessId]);

  if (totalReviews === null) return null;
  const textClass = tone === 'dark' ? 'text-white/85' : 'text-[#3A4644]';
  const mutedClass = tone === 'dark' ? 'text-white/45' : 'text-[#8A9997]';

  // A broken/reviews-unavailable response (or any non-finite rating) must
  // never call .toFixed() — it falls back to the same "New / Not yet rated"
  // state a genuinely reviewless business shows, rather than crashing the
  // Detail page it's embedded in.
  const formattedRating = formatOverallRating(overallRating, totalReviews);
  if (formattedRating === null) {
    return <span className={`text-[11px] font-semibold ${mutedClass}`}>Not yet rated · 0 reviews</span>;
  }

  return (
    <span className={`flex items-center gap-1 text-[11px] font-semibold ${textClass}`}>
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
      {formattedRating}
      <span className={mutedClass}>· {totalReviews} review{totalReviews === 1 ? '' : 's'}</span>
    </span>
  );
};
