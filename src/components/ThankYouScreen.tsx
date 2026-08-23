import React, { useState } from 'react';
import { CheckCircle2, Star, MessageSquare, ShieldAlert, Sparkles, ArrowLeft, HeartHandshake, Headphones } from 'lucide-react';
import type { QueueItem } from '../types';

type Props = {
  item: QueueItem;
  salonName: string;
  onBackToHome: () => void;
  onSubmitRating: (rating: number, tags: string[], comment: string) => void;
};

const IMPROVEMENT_CHIPS = [
  { id: 'service', label: '✂️ Service Quality' },
  { id: 'waiting', label: '⏳ Waiting Time' },
  { id: 'cleanliness', label: '✨ Cleanliness' },
  { id: 'staff', label: '👨‍ Staff Behaviour' },
  { id: 'pricing', label: '🏷️ Pricing & Value' },
  { id: 'communication', label: '💬 Communication' },
];

export const ThankYouScreen: React.FC<Props> = ({
  item,
  salonName,
  onBackToHome,
  onSubmitRating,
}) => {
  const [rating, setRating] = useState<number>(item.rating || 5);
  const [selectedTags, setSelectedTags] = useState<string[]>(item.feedbackTags || []);
  const [comment, setComment] = useState<string>(item.feedbackComment || '');
  const [submitted, setSubmitted] = useState<boolean>(Boolean(item.rating));
  const [supportModalOpen, setSupportModalOpen] = useState<boolean>(false);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmitRating(rating, selectedTags, comment);
    setSubmitted(true);
  };

  const payableAmount = item.totalPriceInr ?? 250;
  const isPaid = item.paymentStatus === 'paid';
  const paymentMethodLabel = item.paymentMethod === 'online' ? 'Online Payment' : 'Cash (Confirmed by Salon)';

  return (
    <div className="min-h-full w-full bg-[#F8FAFA] p-4 text-[#17201F] flex flex-col items-center">
      {/* Top Header */}
      <div className="w-full max-w-md flex items-center justify-between py-2">
        <button
          onClick={onBackToHome}
          className="flex items-center gap-1.5 text-xs font-bold text-[#0F766E] hover:underline cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </button>
        <span className="rounded-full bg-[#0F766E]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0F766E]">
          Completed
        </span>
      </div>

      <div className="w-full max-w-md space-y-4 mt-2">
        {/* Payment & Completion Banner */}
        <div className="relative overflow-hidden rounded-[22px] border border-[#0F766E]/30 bg-gradient-to-br from-[#0B4A44] via-[#0F6B62] to-[#0F766E] p-5 text-white shadow-[0_20px_35px_-12px_rgba(15,118,110,0.4)]">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          
          <div className="relative z-[1] flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 shadow-inner backdrop-blur-md">
              <CheckCircle2 className="h-8 w-8 text-white" />
            </div>
            <span className="mt-3 text-[10px] font-extrabold uppercase tracking-widest text-teal-200">
              Service Complete
            </span>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-white">
              Thank You!
            </h1>
            <p className="mt-0.5 text-xs font-medium text-teal-100">
              {salonName} &middot; {item.service}
            </p>

            {/* Payment Summary Box */}
            <div className="mt-4 w-full rounded-xl bg-white/15 p-3.5 backdrop-blur-md border border-white/20">
              <div className="flex items-center justify-between text-xs">
                <span className="text-teal-100 font-semibold">Total Paid</span>
                <span className="text-xl font-black text-white font-mono">₹{payableAmount}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-white/15">
                <span className="text-teal-200">Payment Method</span>
                <span className="font-bold text-white flex items-center gap-1">
                  {isPaid && <span className="h-2 w-2 rounded-full bg-emerald-400" />}
                  {paymentMethodLabel}
                </span>
              </div>
              {item.token && (
                <div className="mt-1 flex items-center justify-between text-[10px] text-teal-200/80 font-mono">
                  <span>Token</span>
                  <span>{item.token}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rating & Feedback Card */}
        <div className="rounded-[22px] border border-[#E1E7E6] bg-white p-5 shadow-sm space-y-4">
          <div className="text-center">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0F766E]">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Rate your experience
            </div>
            <h2 className="mt-0.5 text-lg font-bold text-[#17201F]">How was your visit at {salonName}?</h2>
          </div>

          {/* Interactive Star Rating */}
          <div className="flex justify-center gap-2 py-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1 transition-transform active:scale-125 focus:outline-none cursor-pointer"
              >
                <Star
                  className={`h-9 w-9 ${
                    star <= rating ? 'fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,0.5)]' : 'text-slate-200'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-center text-xs font-extrabold text-[#0F766E]">
            {rating === 5 ? ' Excellent! Loved it' : rating === 4 ? ' Very Good' : rating === 3 ? ' Good' : rating === 2 ? ' Below Expectation' : ' Disappointing'}
          </p>

          {/* Structured Improvement Chips */}
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 border-t border-[#E1E7E6]">
            <div>
              <label className="block text-xs font-bold text-[#17201F] mb-2">
                What could this salon improve? <span className="text-[10px] font-normal text-[#6F7C7A]">(Optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {IMPROVEMENT_CHIPS.map((chip) => {
                  const active = selectedTags.includes(chip.id);
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => toggleTag(chip.id)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'border-2 border-[#0F766E] bg-[#E7F5F2] text-[#0F766E] shadow-sm scale-105'
                          : 'border border-[#E1E7E6] bg-[#F8FAFA] text-[#5E6C6A] hover:border-[#62AAA3]'
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Free-text Feedback */}
            <div>
              <label className="block text-xs font-bold text-[#17201F] mb-1">
                Additional Comments / Feedback
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share specific suggestions for the salon manager..."
                rows={3}
                maxLength={300}
                className="w-full rounded-xl border border-[#E1E7E6] bg-[#F8FAFA] p-3 text-xs text-[#17201F] outline-none focus:border-[#0F766E] focus:bg-white transition"
              />
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#0F766E] text-white text-xs font-bold shadow-[0_12px_22px_-10px_rgba(15,118,110,0.5)] hover:bg-[#0B665F] transition active:scale-[0.98] cursor-pointer"
            >
              {submitted ? '✓ Feedback Saved' : 'Submit Feedback & Review'}
            </button>
          </form>
        </div>

        {/* Dedicated Support Option */}
        <div className="rounded-[22px] border border-[#E1E7E6] bg-white p-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#17201F]">Need Help or Have a Problem?</p>
              <p className="text-[10px] font-medium text-[#6F7C7A]">Billing issue, refund request, or platform support</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition cursor-pointer"
          >
            Contact Support
          </button>
        </div>
      </div>

      {/* Support Modal */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[22px] bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E7E6] pb-3">
              <div className="flex items-center gap-2 text-rose-700">
                <ShieldAlert className="h-5 w-5" />
                <h3 className="text-sm font-bold text-[#17201F]">Customer Support</h3>
              </div>
              <button
                onClick={() => setSupportModalOpen(false)}
                className="text-xs font-bold text-[#6F7C7A] hover:text-[#17201F]"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#5E6C6A] leading-relaxed">
              We separate salon feedback from platform support. How can our support team assist you with booking <b>#{item.token || item.id.slice(0, 6)}</b>?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  alert('Billing report submitted to No-Wait Salon Support. Resolution reference #SUP-' + Math.floor(1000 + Math.random() * 9000));
                  setSupportModalOpen(false);
                }}
                className="w-full text-left p-3 rounded-xl border border-[#E1E7E6] hover:border-[#0F766E] bg-[#F8FAFA] hover:bg-white text-xs font-semibold text-[#17201F] transition"
              >
                💳 Report Incorrect Charge / Billing Issue
              </button>
              <button
                onClick={() => {
                  alert('Salon incident reported to No-Wait Platform Quality Team.');
                  setSupportModalOpen(false);
                }}
                className="w-full text-left p-3 rounded-xl border border-[#E1E7E6] hover:border-[#0F766E] bg-[#F8FAFA] hover:bg-white text-xs font-semibold text-[#17201F] transition"
              >
                🏪 Report Salon Experience / Incident
              </button>
              <a
                href="tel:18001234567"
                className="block w-full text-center py-2.5 rounded-xl bg-[#0F766E] text-white text-xs font-bold"
              >
                📞 Call 24/7 Support Helpline (1800-123-4567)
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
