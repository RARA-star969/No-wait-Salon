import React, { useState } from 'react';
import { ArrowLeft, MapPin, CheckCircle2, Building, Home, Briefcase, Sparkles } from 'lucide-react';
import { UserAddress } from '../types';

type AddAddressProps = {
  onBack: () => void;
  userToken?: string | null;
  onAddressSaved: (addr: UserAddress) => void;
  editingAddress?: UserAddress | null;
};

export const AddAddressScreen: React.FC<AddAddressProps> = ({
  onBack,
  userToken,
  onAddressSaved,
  editingAddress,
}) => {
  const [label, setLabel] = useState(editingAddress?.label || 'Home Me');
  const [buildingName, setBuildingName] = useState(editingAddress?.buildingName || '');
  const [area, setArea] = useState(editingAddress?.area || 'Indiranagar');
  const [city, setCity] = useState(editingAddress?.city || 'Bengaluru');
  const [state, setState] = useState(editingAddress?.state || 'Karnataka');
  const [pinCode, setPinCode] = useState(editingAddress?.pinCode || '560038');
  const [landmark, setLandmark] = useState(editingAddress?.landmark || '');
  const [isDefault, setIsDefault] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!area.trim()) {
      setError('Street or Area is required.');
      return;
    }

    const fullAddress = [buildingName, area, landmark ? `Near ${landmark}` : '', city, pinCode]
      .filter(Boolean)
      .join(', ');

    const payload = {
      label,
      buildingName,
      fullAddress,
      area,
      city,
      state,
      pinCode,
      landmark,
      latitude: 12.9719,
      longitude: 77.6412,
      isDefault,
    };

    setBusy(true);

    if (userToken) {
      try {
        const res = await fetch(`${API_BASE}/api/customer/addresses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.address) {
          onAddressSaved(data.address);
          onBack();
          return;
        }
      } catch (_) {}
    }

    // Guest / local fallback
    const fallback: UserAddress = {
      id: 'local-' + Date.now(),
      customerId: 'guest',
      label,
      buildingName,
      fullAddress,
      area,
      city,
      state,
      pinCode,
      landmark,
      latitude: 12.9719,
      longitude: 77.6412,
      isDefault: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onAddressSaved(fallback);
    onBack();
  };

  const presetLabels = ['Home Me', 'Home', 'Work / Office', 'Gym Base', 'Other'];

  return (
    <div id="add-address-screen" className="flex flex-col min-h-full bg-slate-50 text-slate-900 animate-in fade-in duration-300">
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
          <h1 className="text-lg font-black tracking-tight text-slate-900">
            {editingAddress ? 'Edit Address' : 'Add New Address'}
          </h1>
          <p className="text-[11px] font-medium text-slate-500">Save location for quick service & queue booking</p>
        </div>
      </div>

      <div
        className="flex-1 p-4 max-w-xl mx-auto w-full sm:p-6"
        // Bottom safe area: keeps the final field and Save action clear of the
        // gesture bar / 3-button nav.
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)' }}
      >
        <form onSubmit={handleSubmit} className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {error && <p className="rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}

          {/* Preset Label Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
              Address Label
            </label>
            <div className="flex flex-wrap gap-2">
              {presetLabels.map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setLabel(lbl)}
                  className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${
                    label === lbl
                      ? 'bg-[var(--noq-accent)] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {lbl.includes('Work') ? <Briefcase className="h-3.5 w-3.5" /> : <Home className="h-3.5 w-3.5" />}
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Flat / Building */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Flat, House No., or Building Name
              </label>
              <input
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="e.g. #402, Apex Regency"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--noq-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--noq-tint-10)]"
              />
            </div>

            {/* Street / Area */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Street & Area Name <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. 100ft Road, Indiranagar"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--noq-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--noq-tint-10)]"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Bengaluru"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--noq-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--noq-tint-10)]"
              />
            </div>

            {/* Postal Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Postal Code / PIN
              </label>
              <input
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                placeholder="e.g. 560038"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--noq-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--noq-tint-10)]"
              />
            </div>

            {/* Landmark */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Landmark (Optional)
              </label>
              <input
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Opposite Metro Station Gate 2"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 text-sm font-semibold text-slate-900 outline-none focus:border-[var(--noq-accent)] focus:bg-white focus:ring-2 focus:ring-[var(--noq-tint-10)]"
              />
            </div>
          </div>

          {/* Default Checkbox */}
          <label className="flex items-center gap-3 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4.5 w-4.5 rounded-lg border-slate-300 text-[var(--noq-accent)] focus:ring-[var(--noq-accent)]"
            />
            <span className="text-xs font-bold text-slate-700">Set as my default active location</span>
          </label>

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
              className="flex items-center gap-2 rounded-2xl bg-[var(--noq-accent)] px-6 py-3 text-xs font-extrabold text-white shadow-md shadow-[var(--noq-glow)] hover:bg-[var(--noq-accent-hover)] disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              {busy ? 'Saving...' : 'Save & Set Active'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
