import React, { useEffect, useState } from 'react';
import { ArrowLeft, Star, Loader2, BadgeCheck } from 'lucide-react';
import { gymProfileCmsService, type ReviewView } from '../services/gymProfileCmsService';

const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
] as const;

/** Owner Reviews dashboard (Phase 5) — every number here is computed live
 *  from real business_review rows server-side, never a fabricated count. */
export const GymReviewsDashboard: React.FC<{ gymId: string; gymName: string; onClose: () => void }> = ({ gymName, onClose }) => {
  const [sort, setSort] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [loading, setLoading] = useState(true);
  const [overallRating, setOverallRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [distribution, setDistribution] = useState<Record<number, number>>({});
  const [reviews, setReviews] = useState<ReviewView[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState('');

  const load = async (nextSort = sort) => {
    setLoading(true);
    try {
      const data = await gymProfileCmsService.reviews.dashboard(nextSort);
      setOverallRating(data.overallRating);
      setTotalReviews(data.totalReviews);
      setDistribution(data.distribution);
      setReviews(data.reviews.filter((r) => r.status !== 'hidden'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(sort); }, [sort]);

  const submitReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] || '').trim();
    if (!text) return;
    setReplying(reviewId);
    try {
      await gymProfileCmsService.reviews.reply(reviewId, text);
      await load();
    } finally {
      setReplying('');
    }
  };

  return (
    <div className="flex flex-col rounded-2xl bg-[#F4F7F6]">
      <header className="flex items-center gap-3 border-b border-[#E1E7E6] bg-white px-4 py-3">
        <button onClick={onClose} aria-label="Close Reviews" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0F5F4] text-[#17201F]">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-bold text-[#17201F]">Reviews</h1>
          <p className="truncate text-[11px] text-[#5C6E6B]">{gymName}</p>
        </div>
      </header>

      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="flex h-40 items-center justify-center text-[#5C6E6B]"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#DDE5E3] bg-white p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-extrabold text-[#17201F]">{totalReviews ? overallRating.toFixed(1) : '—'}</span>
                <div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= Math.round(overallRating) ? 'fill-amber-400 text-amber-400' : 'text-[#DDE5E3]'}`} />
                    ))}
                  </div>
                  <p className="text-[11px] text-[#5C6E6B]">{totalReviews} review{totalReviews === 1 ? '' : 's'}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = distribution[n] || 0;
                  const pct = totalReviews ? Math.round((count / totalReviews) * 100) : 0;
                  return (
                    <div key={n} className="flex items-center gap-2 text-[10px] text-[#5C6E6B]">
                      <span className="w-2.5">{n}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F5F4]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></div>
                      <span className="w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex gap-1.5">
              {SORTS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSort(s.key)}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${sort === s.key ? 'bg-[#0F766E] text-white' : 'bg-white text-[#5C6E6B] border border-[#DDE5E3]'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="rounded-2xl border border-[#DDE5E3] bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#17201F]">{review.reviewerName}</span>
                      {review.verifiedVisit && (
                        <span className="flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                          <BadgeCheck className="h-3 w-3" /> Verified
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#8A9997]">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3 w-3 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-[#DDE5E3]'}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[#3A4644]">{review.reviewText}</p>
                  {review.ownerReplyText ? (
                    <div className="mt-2 rounded-xl bg-[#F0F5F4] p-2.5">
                      <p className="text-[10px] font-bold uppercase text-[#5C6E6B]">Your reply</p>
                      <p className="mt-0.5 text-xs text-[#3A4644]">{review.ownerReplyText}</p>
                    </div>
                  ) : (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={replyDrafts[review.id] || ''}
                        onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        placeholder="Reply to this review…"
                        className="flex-1 rounded-lg border border-[#DDE5E3] bg-white px-2.5 py-1.5 text-xs text-[#17201F]"
                      />
                      <button
                        onClick={() => submitReply(review.id)}
                        disabled={replying === review.id}
                        className="rounded-lg bg-[#0F766E] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                      >
                        Reply
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {reviews.length === 0 && <p className="py-8 text-center text-xs text-[#8A9997]">No reviews yet.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
