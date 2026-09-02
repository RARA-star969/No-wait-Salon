import React, { useEffect, useState } from 'react';
import { Star, BadgeCheck, Loader2 } from 'lucide-react';
import { businessReviewService, formatOverallRating, type PublicReviewView } from '../services/businessReviewService';

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
  const [myReview, setMyReview] = useState<PublicReviewView | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    try {
      setLoadError('');
      const data = await businessReviewService.list(businessId);
      setOverallRating(data.overallRating);
      setTotalReviews(data.totalReviews);
      setReviews(data.reviews);
      setMyReview(data.myReview ?? null);
    } catch {
      setLoadError('Reviews could not be refreshed. You can retry without leaving this page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setMyReview(null);
    void load();
  }, [businessId, ready]);

  const submit = async () => {
    if (!ready) { onRequireReady(); return; }
    if (!rating) { setNotice('Choose a star rating first.'); setTimeout(() => setNotice(''), 2500); return; }
    setSubmitting(true);
    try {
      const res = await businessReviewService.submit(businessId, rating, reviewText);
      if (res.review) {
        setMyReview(res.review);
      }
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
  const cardClass = dark ? 'border-white/10 bg-white/[0.04]' : 'border-[var(--noq-border)] bg-white';
  const headingClass = dark ? 'text-white/50' : 'text-[#5C6E6B]';
  const textClass = dark ? 'text-white/85' : 'text-[#3A4644]';
  const mutedClass = dark ? 'text-white/40' : 'text-[#8A9997]';
  const inputClass = dark
    ? 'border-white/10 bg-white/[0.05] text-white placeholder:text-white/30'
    : 'border-[var(--noq-border)] bg-white text-[var(--noq-ink)] placeholder:text-[#8A9997]';

  const otherReviews = reviews.filter((r) => r.id !== myReview?.id);

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
      <h2 className={`text-xs font-bold uppercase tracking-wider ${headingClass}`}>Reviews</h2>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className={`h-4 w-4 animate-spin ${mutedClass}`} /></div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-3">
            {totalReviews > 0 ? (
              <>
                <span className={`text-2xl font-extrabold ${textClass}`}>
                  {formatOverallRating(overallRating, totalReviews) ?? '—'}
                </span>
                <div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3.5 w-3.5 ${Number.isFinite(overallRating) && n <= Math.round(overallRating) ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/15' : 'text-[var(--noq-border)]'}`} />
                    ))}
                  </div>
                  <p className={`text-[11px] ${mutedClass}`}>{totalReviews} review{totalReviews === 1 ? '' : 's'}</p>
                </div>
              </>
            ) : (
              <div>
                <p className={`text-sm font-bold ${textClass}`}>Not yet rated</p>
                <p className={`text-[11px] ${mutedClass}`}>0 reviews</p>
              </div>
            )}
          </div>

          {loadError && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
              <span>{loadError}</span>
              <button type="button" onClick={() => { setLoading(true); void load(); }} className="shrink-0 font-bold underline">Retry</button>
            </div>
          )}

          {/* If the current customer has submitted a review, display it prominently */}
          {myReview && (
            <div className="mt-4 space-y-2">
              <p className={`text-[11px] font-bold uppercase tracking-wide ${headingClass}`}>Your Review</p>
              <div className={`rounded-xl border p-3.5 ${dark ? 'border-amber-400/30 bg-amber-500/10' : 'border-amber-200 bg-amber-50/50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${textClass}`}>{myReview.reviewerName} (You)</span>
                    {myReview.verifiedVisit && (
                      <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                        <BadgeCheck className="h-2.5 w-2.5" /> Verified
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] ${mutedClass}`}>{new Date(myReview.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="mt-1 flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-3 w-3 ${n <= myReview.rating ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/15' : 'text-[var(--noq-border)]'}`} />
                  ))}
                </div>
                {myReview.reviewText && <p className={`mt-1.5 text-xs leading-5 ${textClass}`}>{myReview.reviewText}</p>}
                {myReview.ownerReplyText && (
                  <div className={`mt-2 rounded-lg p-2.5 ${dark ? 'bg-white/[0.08]' : 'bg-white border border-amber-100'}`}>
                    <p className={`text-[9px] font-bold uppercase tracking-wider text-[var(--noq-accent)]`}>Owner reply</p>
                    <p className={`mt-0.5 text-[11px] leading-4 ${textClass}`}>{myReview.ownerReplyText}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other community reviews */}
          {otherReviews.length > 0 && (
            <div className="mt-3 space-y-3">
              {otherReviews.slice(0, 5).map((review) => (
                <div key={review.id} className={`rounded-xl border p-3 ${dark ? 'border-white/[0.06] bg-black/20' : 'border-[#EEF2F1] bg-[var(--noq-base)]'}`}>
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
                      <Star key={n} className={`h-3 w-3 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/15' : 'text-[var(--noq-border)]'}`} />
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

          {/* Only show the review submission form if the customer has not yet reviewed */}
          {!myReview && (
            <div className={`mt-4 border-t pt-3 ${dark ? 'border-white/[0.06]' : 'border-[#EEF2F1]'}`}>
              <p className={`text-[11px] font-bold uppercase tracking-wide ${headingClass}`}>Write a review</p>
              <div className="mt-2 flex items-center gap-1" role="radiogroup" aria-label="Review rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} onClick={() => setRating(n)} aria-label={`${n} star${n === 1 ? '' : 's'}`} className="rounded-md p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--noq-accent)]">
                    <Star className={`h-6 w-6 ${n <= rating ? 'fill-amber-400 text-amber-400' : dark ? 'text-white/20' : 'text-[var(--noq-border)]'}`} />
                  </button>
                ))}
              </div>
              <p className={`mt-1 text-[11px] font-semibold ${rating ? textClass : mutedClass}`} aria-live="polite">
                {rating ? `${rating} of 5 stars selected` : 'No rating selected'}
              </p>
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
                className="mt-2 w-full rounded-xl bg-[var(--noq-accent)] py-2.5 text-xs font-bold text-white shadow-[0_10px_22px_-14px_var(--noq-glow)] disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : ready ? 'Submit review' : 'Verify to submit review'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
