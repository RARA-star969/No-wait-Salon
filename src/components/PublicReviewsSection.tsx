import React, { useEffect, useState } from 'react';
import { Star, BadgeCheck, Loader2 } from 'lucide-react';
import { businessReviewService, type PublicReviewView } from '../services/businessReviewService';

/**
 * Real reviews section shared by Gym Detail and Salon Detail — one review
 * model, one submission path, for every category. Rating average and
 * review count always come from this same real business_review-backed
 * endpoint, never a separately fabricated number. An owner/admin edit to a
 * review's text shows up here on next load since this reads the live row,
 * never a cached copy.
 */
export const PublicReviewsSection: React.FC<{
  businessId: string;
  /** Whether the customer is a verified, ready identity right now — the
   *  parent page owns its own existing verification gate/flow; this
   *  component never re-implements identity verification. */
  ready: boolean;
  /** Opens the parent page's existing verification gate. Called only when
   *  the customer tries to submit a review while not ready. */
  onRequireReady: () => void;
  /** Dark (Gym) or light (Salon) surface — matches each page's own theme
   *  rather than forcing one palette on both. */
  tone?: 'dark' | 'light';
}> = ({ businessId, ready, onRequireReady, tone = 'light' }) => {
  const [loading, setLoading] = useState(true);
  const [overallRating, setOverallRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [reviews, setReviews] = useState<PublicReviewView[]>([]);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    try {
      const data = await businessReviewService.list(businessId);
      setOverallRating(data.overallRating);
      setTotalReviews(data.totalReviews);
      setReviews(data.reviews);
    } catch {
      // Keep showing the last known reviews; nothing to retry automatically.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [businessId]);

  const submit = async () => {
    if (!ready) { onRequireReady(); return; }
    if (!rating) { setNotice('Choose a star rating first.'); setTimeout(() => setNotice(''), 2500); return; }
    setSubmitting(true);
    try {
      await businessReviewService.submit(businessId, rating, reviewText);
      setRating(0);
      setReviewText('');
      setNotice('Thanks for your review!');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not submit your review.');
    } finally {
      setSubmitting(false);
      setTimeout(() => setNotice(''), 3000);
    }
  };

  const dark = tone === 'dark';
  const cardClass = dark ? 'border-white/10 bg-white/[0.04]' : 'border-[#DDE5E3] bg-white';
  const headingClass = dark ? 'text-white/50' : 'text-[#5C6E6B]';
  const textClass = dark ? 'text-white/85' : 'text-[#3A4644]';
  const mutedClass = dark ? 'text-white/40' : 'text-[#8A9997]';
  const inputClass = dark
    ? 'border-white/10 bg-white/[0.05] text-white placeholder:text-white/30'
    : 'border-[#DDE5E3] bg-white text-[#17201F] placeholder:text-[#8A9997]';

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
      <h2 className={`text-xs font-bold uppercase tracking-wider ${headingClass}`}>Reviews</h2>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className={`h-4 w-4 animate-spin ${mutedClass}`} /></div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            <span className={`text-2xl font-extrabold ${textClass}`}>{totalReviews ? overallRating.toFixed(1) : '—'}</span>
            <div>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(overallRating) ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/15' : 'text-[#DDE5E3]'}`} />
                ))}
              </div>
              <p className={`text-[11px] ${mutedClass}`}>{totalReviews} review{totalReviews === 1 ? '' : 's'}</p>
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="mt-3 space-y-3">
              {reviews.slice(0, 5).map((review) => (
                <div key={review.id} className={`rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-black/20' : 'border-[#EEF2F1] bg-[#F8FAFA]'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${textClass}`}>{review.reviewerName}</span>
                      {review.verifiedVisit && (
                        <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                          <BadgeCheck className="h-2.5 w-2.5" /> Verified
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] ${mutedClass}`}>{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3 w-3 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/15' : 'text-[#DDE5E3]'}`} />
                    ))}
                  </div>
                  {review.reviewText && <p className={`mt-1.5 text-xs leading-5 ${textClass}`}>{review.reviewText}</p>}
                  {review.ownerReplyText && (
                    <div className={`mt-2 rounded-lg p-2 ${dark ? 'bg-white/[0.05]' : 'bg-white'}`}>
                      <p className={`text-[9px] font-bold uppercase ${mutedClass}`}>Owner reply</p>
                      <p className={`mt-0.5 text-[11px] ${textClass}`}>{review.ownerReplyText}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={`mt-4 border-t pt-3 ${dark ? 'border-white/[0.06]' : 'border-[#EEF2F1]'}`}>
            <p className={`text-[11px] font-bold uppercase tracking-wide ${headingClass}`}>Write a review</p>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`}>
                  <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/20' : 'text-[#DDE5E3]'}`} />
                </button>
              ))}
            </div>
            <textarea
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Share your experience (optional)"
              rows={3}
              className={`mt-2 w-full rounded-xl border px-3 py-2 text-xs ${inputClass}`}
            />
            {notice && <p className={`mt-1.5 text-[11px] font-semibold ${dark ? 'text-emerald-300' : 'text-emerald-700'}`}>{notice}</p>}
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : ready ? 'Submit review' : 'Verify to submit review'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
