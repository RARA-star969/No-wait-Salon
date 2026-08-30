import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Search,
  LocateFixed,
  PlusCircle,
  MapPinPlus,
  Home,
  Briefcase,
  MapPin,
  MoreVertical,
  Check,
  Trash2,
  Edit3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserAddress } from '../types';

type LocationSelectProps = {
  onBack: () => void;
  currentLabel: string;
  currentAddress: string;
  onSelectAddress: (address: Partial<UserAddress> & { label: string; fullAddress: string; area: string; city: string; latitude: number; longitude: number }) => void;
  userToken?: string | null;
  onUseGps: () => void;
  onNavigateAddAddress: () => void;
  onNavigateRequestAddress: () => void;
  onEditAddress?: (address: UserAddress) => void;
};

export const LocationSelectScreen: React.FC<LocationSelectProps> = ({
  onBack,
  currentLabel,
  currentAddress,
  onSelectAddress,
  userToken,
  onUseGps,
  onNavigateAddAddress,
  onNavigateRequestAddress,
  onEditAddress,
}) => {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showAllSaved, setShowAllSaved] = useState(false);

  const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

  const loadAddresses = React.useCallback(() => {
    if (!userToken) return;
    setLoading(true);
    fetch(`${API_BASE}/api/customer/addresses`, {
      headers: { Authorization: `Bearer ${userToken}` },
    })
      .then((res) => (res.ok ? res.json() : { addresses: [] }))
      .then((data) => {
        if (Array.isArray(data.addresses)) {
          setAddresses(data.addresses);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userToken, API_BASE]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleSelectDefault = async (addr: UserAddress) => {
    onSelectAddress({
      id: addr.id,
      label: addr.label,
      fullAddress: addr.fullAddress,
      area: addr.area,
      city: addr.city,
      latitude: addr.latitude,
      longitude: addr.longitude,
    });

    if (userToken) {
      try {
        await fetch(`${API_BASE}/api/customer/addresses/${addr.id}/default`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${userToken}` },
        });
        loadAddresses();
      } catch (_) {}
    }
    onBack();
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenId(null);
    if (!userToken) return;
    try {
      await fetch(`${API_BASE}/api/customer/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userToken}` },
      });
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch (_) {}
  };

  const filteredAddresses = addresses.filter((a) =>
    `${a.label} ${a.fullAddress} ${a.area} ${a.city}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const displayedAddresses = showAllSaved ? filteredAddresses : filteredAddresses.slice(0, 3);

  return (
    <div id="location-select-screen" className="flex flex-col min-h-full bg-slate-50 text-slate-900 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 pb-3.5 backdrop-blur-md sm:px-6"
        // Safe-area top: the back arrow and title must clear the Android
        // status bar and any display cutout. `max()` keeps normal padding on
        // devices that report no inset instead of over-padding them.
        style={{ paddingTop: 'max(0.875rem, env(safe-area-inset-top))' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to home"
          className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-black tracking-tight text-slate-900">Select your location</h1>
          <p className="text-[11px] font-medium text-slate-500">Choose saved address or search new area</p>
        </div>
      </div>

      <div
        className="flex-1 p-4 space-y-6 max-w-2xl mx-auto w-full sm:p-6"
        // Bottom safe area: the last row must clear the gesture bar / 3-button
        // nav rather than sitting underneath it.
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)' }}
      >
        {/* Search Input */}
        <div className="relative">
          <div className="flex h-14 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-100">
            <Search className="h-5 w-5 shrink-0 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search an area or address..."
              aria-label="Search an area or address"
              className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Quick Action Cards (3 Clean Cards) */}
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Card 1: Use Current Location */}
          <button
            type="button"
            onClick={() => {
              onUseGps();
              onBack();
            }}
            className="group flex flex-col items-start justify-between rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-500/10 via-teal-500/5 to-white p-4 text-left shadow-xs transition hover:border-teal-400 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/20 group-hover:scale-105 transition-transform">
              <LocateFixed className="h-5 w-5" />
            </div>
            <div className="mt-4">
              <span className="block text-xs font-black text-slate-900">Use Current Location</span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Auto-detect GPS location</span>
            </div>
          </button>

          {/* Card 2: Add New Address */}
          <button
            type="button"
            onClick={onNavigateAddAddress}
            className="group flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-teal-500 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="mt-4">
              <span className="block text-xs font-black text-slate-900">Add New Address</span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Save home or office</span>
            </div>
          </button>

          {/* Card 3: Request Address */}
          <button
            type="button"
            onClick={onNavigateRequestAddress}
            className="group flex flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition hover:border-amber-400 hover:shadow-md active:scale-[0.98]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-amber-50 group-hover:text-amber-700 transition-colors">
              <MapPinPlus className="h-5 w-5" />
            </div>
            <div className="mt-4">
              <span className="block text-xs font-black text-slate-900">Request Address</span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500">Request area coverage</span>
            </div>
          </button>
        </div>

        {/* Saved Addresses Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">SAVED ADDRESSES</span>
            {filteredAddresses.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAllSaved(!showAllSaved)}
                className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800"
              >
                {showAllSaved ? (
                  <>Show less <ChevronUp className="h-3.5 w-3.5" /></>
                ) : (
                  <>View all ({filteredAddresses.length}) <ChevronDown className="h-3.5 w-3.5" /></>
                )}
              </button>
            )}
          </div>

          {/* Saved Address Cards */}
          <div className="space-y-3">
            {displayedAddresses.map((addr) => {
              const isSelected = currentLabel === addr.label || currentAddress === addr.fullAddress;
              const isMenuOpen = menuOpenId === addr.id;

              return (
                <div
                  key={addr.id}
                  onClick={() => handleSelectDefault(addr)}
                  className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-4 transition-all active:scale-[0.99] ${
                    isSelected
                      ? 'border-teal-500 bg-white ring-2 ring-teal-500/20 shadow-md'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                      isSelected ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {addr.label.includes('Work') || addr.label.includes('Office') ? (
                        <Briefcase className="h-5 w-5" />
                      ) : (
                        <Home className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-slate-900">{addr.label}</span>
                        {isSelected && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-0.5 text-[9px] font-black tracking-wider text-white uppercase">
                            <Check className="h-3 w-3" /> SELECTED
                          </span>
                        )}
                        {addr.distanceKm !== undefined && (
                          <span className="text-[11px] font-bold text-slate-500">
                            · {addr.distanceKm} km away
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-600 leading-relaxed line-clamp-2">
                        {addr.fullAddress}
                      </p>
                    </div>
                  </div>

                  {/* 3-Dot Actions Menu Button */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(isMenuOpen ? null : addr.id)}
                      aria-label="Address options"
                      className="grid h-9 w-9 place-items-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                    >
                      <MoreVertical className="h-4.5 w-4.5" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="absolute right-0 top-10 z-40 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                        <button
                          type="button"
                          onClick={() => handleSelectDefault(addr)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-800"
                        >
                          <CheckCircle2 className="h-4 w-4 text-teal-600" /> Set as Default
                        </button>
                        {onEditAddress && (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpenId(null);
                              onEditAddress(addr);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-100"
                          >
                            <Edit3 className="h-4 w-4 text-slate-500" /> Edit Address
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAddress(addr.id, e)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {!filteredAddresses.length && !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                <MapPin className="mx-auto h-7 w-7 text-slate-400" />
                <h3 className="mt-2 text-sm font-bold text-slate-800">No saved addresses found</h3>
                <p className="mt-1 text-xs text-slate-500">Tap &ldquo;Add New Address&rdquo; above to save your first location.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
