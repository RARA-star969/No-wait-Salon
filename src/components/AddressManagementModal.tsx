import React, { useEffect, useState } from 'react';
import { MapPin, Search, LocateFixed, Plus, Check, Edit2, Trash2, X, Home, Briefcase, Building } from 'lucide-react';
import { UserAddress } from '../types';

type AddressModalProps = {
  isOpen: boolean;
  onClose: () => void;
  currentLabel: string;
  currentAddress: string;
  onSelectAddress: (address: Partial<UserAddress> & { label: string; fullAddress: string; area: string; city: string; latitude: number; longitude: number }) => void;
  userToken?: string | null;
  onUseGps: () => void;
};

export const AddressManagementModal: React.FC<AddressModalProps> = ({
  isOpen,
  onClose,
  currentLabel,
  currentAddress,
  onSelectAddress,
  userToken,
  onUseGps,
}) => {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [labelInput, setLabelInput] = useState('Home Me');
  const [fullAddressInput, setFullAddressInput] = useState('');
  const [areaInput, setAreaInput] = useState('Indiranagar');
  const [cityInput, setCityInput] = useState('Bengaluru');
  const [pinCodeInput, setPinCodeInput] = useState('560038');

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
    if (isOpen) {
      loadAddresses();
    }
  }, [isOpen, loadAddresses]);

  if (!isOpen) return null;

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
    onClose();
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!fullAddressInput.trim() || !areaInput.trim()) {
      setError('Please provide full address and area.');
      return;
    }

    const payload = {
      label: labelInput,
      fullAddress: fullAddressInput,
      area: areaInput,
      city: cityInput || 'Bengaluru',
      pinCode: pinCodeInput || '560038',
      latitude: 12.9719,
      longitude: 77.6412,
      isDefault: true,
    };

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
          onSelectAddress({
            id: data.address.id,
            label: data.address.label,
            fullAddress: data.address.fullAddress,
            area: data.address.area,
            city: data.address.city,
            latitude: data.address.latitude,
            longitude: data.address.longitude,
          });
        }
      } catch (_) {}
    } else {
      // Local fallback for guest
      onSelectAddress({
        label: labelInput,
        fullAddress: fullAddressInput,
        area: areaInput,
        city: cityInput || 'Bengaluru',
        latitude: 12.9719,
        longitude: 77.6412,
      });
    }

    setIsAddingNew(false);
    onClose();
  };

  const handleDeleteAddress = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl max-h-[85vh] overflow-y-auto space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">Select your location</h2>
            <p className="text-xs font-medium text-slate-500">Choose or add a saved delivery & queue location</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="flex h-12 w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 focus-within:border-teal-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100">
            <Search className="h-4.5 w-4.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search area, street, or landmark..."
              className="h-full flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Quick GPS Button */}
        <button
          type="button"
          onClick={() => {
            onUseGps();
            onClose();
          }}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50/60 p-4 text-left transition hover:bg-teal-100/70 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
              <LocateFixed className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-xs font-black text-teal-950">Use Current GPS Location</span>
              <span className="block text-[11px] font-medium text-teal-700">Detect nearest salons & businesses</span>
            </div>
          </div>
          <span className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-teal-800 shadow-xs">Detect →</span>
        </button>

        {/* Saved Addresses Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Saved Addresses</span>
            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-1 text-xs font-extrabold text-teal-700 hover:text-teal-800"
            >
              <Plus className="h-3.5 w-3.5" /> Add New Address
            </button>
          </div>

          {/* Add New Address Form Modal */}
          {isAddingNew && (
            <form onSubmit={handleSaveAddress} className="rounded-2xl border border-teal-200 bg-teal-50/30 p-4 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900">New Saved Address</span>
                <button type="button" onClick={() => setIsAddingNew(false)} className="text-xs font-bold text-slate-500">Cancel</button>
              </div>

              {error && <p className="text-xs font-bold text-red-600">{error}</p>}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-700">
                  Label
                  <select
                    value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="Home Me">Home Me</option>
                    <option value="Work / Office">Work / Office</option>
                    <option value="Gym Base">Gym Base</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-slate-700">
                  Area
                  <input
                    value={areaInput}
                    onChange={(e) => setAreaInput(e.target.value)}
                    placeholder="e.g. Indiranagar"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-700 sm:col-span-2">
                  Full Street Address
                  <input
                    value={fullAddressInput}
                    onChange={(e) => setFullAddressInput(e.target.value)}
                    placeholder="House no., Building, 100ft Road"
                    className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-teal-600/20 hover:bg-teal-700"
                >
                  Save & Select
                </button>
              </div>
            </form>
          )}

          {/* Address Cards List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {filteredAddresses.map((addr) => {
              const isSelected = currentLabel === addr.label || currentAddress === addr.fullAddress;
              return (
                <div
                  key={addr.id}
                  onClick={() => handleSelectDefault(addr)}
                  className={`group relative flex cursor-pointer items-start justify-between gap-3 rounded-2xl border p-3.5 transition active:scale-[0.99] ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500/30'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold ${
                      isSelected ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {addr.label.includes('Work') ? <Briefcase className="h-4.5 w-4.5" /> : <Home className="h-4.5 w-4.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-900">{addr.label}</span>
                        {isSelected && (
                          <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[9px] font-black text-white">SELECTED</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{addr.fullAddress}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteAddress(addr.id, e)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {!filteredAddresses.length && !loading && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center">
                <MapPin className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-xs font-bold text-slate-700">No saved addresses found</p>
                <p className="text-[11px] text-slate-500">Add a new saved address to quick switch anytime.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
