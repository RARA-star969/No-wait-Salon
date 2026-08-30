import React, { useState } from 'react';
import { ArrowLeft, MapPinPlus, CheckCircle2, Send } from 'lucide-react';

type RequestAddressProps = {
  onBack: () => void;
  userToken?: string | null;
  onRequestSubmitted: (areaName: string) => void;
};

export const RequestAddressScreen: React.FC<RequestAddressProps> = ({
  onBack,
  userToken,
  onRequestSubmitted,
}) => {
  const [areaName, setAreaName] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [pinCode, setPinCode] = useState('');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!areaName.trim()) {
      setError('Area name is required.');
      return;
    }

    setBusy(true);

    if (userToken) {
      try {
        await fetch(`${API_BASE}/api/customer/address-requests`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ areaName, city, pinCode, comments }),
        });
      } catch (_) {}
    }

    setBusy(false);
    setSubmitted(true);
    setTimeout(() => {
      onRequestSubmitted(areaName);
      onBack();
    }, 1500);
  };

  return (
    <div id="request-address-screen" className="flex flex-col min-h-full bg-slate-50 text-slate-900 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 pb-3.5 backdrop-blur-md sm:px-6"
        // Safe-area top: the back arrow and title must clear the Android
        // status bar and any display cutout. `max()` keeps normal padding on
        // devices that report no inset instead of over-padding them.
        style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to locations"
          className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Request Service Area</h1>
          <p className="text-[11px] font-medium text-slate-500">Ask us to onboard salons in your neighborhood</p>
        </div>
      </div>

      <div
        className="flex-1 p-4 max-w-xl mx-auto w-full sm:p-6"
        // Bottom safe area: keeps the submit action clear of the gesture bar.
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)' }}
      >
        {submitted ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-8 text-center space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-black text-emerald-950">Area Coverage Requested!</h2>
            <p className="text-xs font-medium text-emerald-800 max-w-sm mx-auto">
              Thank you! We have logged your request for &ldquo;{areaName}&rdquo;. We will prioritize onboarding partner salons in this area.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 border border-amber-200/70">
              <MapPinPlus className="h-6 w-6 text-amber-600 shrink-0" />
              <p className="text-xs font-semibold text-amber-900">
                Can&apos;t find your area? Request coverage and we will notify you as soon as salons join!
              </p>
            </div>

            {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Area or Neighborhood Name <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  placeholder="e.g. HSR Layout Sector 1"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">PIN / Postal Code</label>
                  <input
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    placeholder="e.g. 560102"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Additional Details / Preferred Salons
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Mention favorite salons or landmarks in your area..."
                  rows={3}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-sm font-semibold text-slate-900 outline-none focus:border-amber-600 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onBack}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-xs font-extrabold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-2xl bg-amber-600 px-6 py-3 text-xs font-extrabold text-white shadow-md shadow-amber-600/20 hover:bg-amber-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                {busy ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
