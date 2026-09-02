import React, { FormEvent, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, MapPin, Navigation, Search, X } from 'lucide-react';
import type { NearbySalon } from '../types';
import { salonDiscoveryService } from '../services/salonDiscoveryService';
import type { StoredLocationPreference } from '../services/locationPreferenceService';

type Props = {
  open: boolean;
  currentLabel: string;
  onClose: () => void;
  onSelected: (salons: NearbySalon[], label: string, preference: StoredLocationPreference) => void;
};

/**
 * Change-location sheet for customers who already finished setup. This never
 * routes back through first-time onboarding, and only requests the OS
 * permission when the customer explicitly taps "Use my current location".
 */
export const LocationSelectorSheet: React.FC<Props> = ({ open, currentLabel, onClose, onSelected }) => {
  const [area, setArea] = useState('');
  const [loading, setLoading] = useState<'gps' | 'manual' | null>(null);
  const [error, setError] = useState('');

  if (!open) return null;

  const usingGps = currentLabel === 'Current location';

  const useCurrentLocation = () => {
    setError('');
    if (!navigator.geolocation) {
      setError('Location is not available on this device. Search by area instead.');
      return;
    }
    setLoading('gps');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await salonDiscoveryService.byCoordinates(coords.latitude, coords.longitude);
          onSelected(result.salons, 'Current location', {
            setupCompleted: true,
            mode: 'gps',
            label: 'Current location',
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Unable to load nearby salons.');
        } finally {
          setLoading(null);
        }
      },
      () => {
        setLoading(null);
        setError('Location permission was not granted. Search by city or area instead.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  };

  const searchArea = async (event: FormEvent) => {
    event.preventDefault();
    const search = area.trim();
    if (search.length < 2) return setError('Enter at least 2 characters.');
    setLoading('manual');
    setError('');
    try {
      const result = await salonDiscoveryService.byArea(search);
      onSelected(result.salons, search, {
        setupCompleted: true,
        mode: 'manual',
        label: search,
        area: search,
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to search this area.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/45 sm:items-center">
      <button type="button" aria-label="Close location selector" onClick={onClose} className="absolute inset-0 cursor-default" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Change location"
        className="relative w-full rounded-t-3xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-3xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold tracking-[-0.01em] text-[var(--noq-ink)]">Change location</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--noq-muted)]">Pick where you want to find salons.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--noq-surface-soft)] text-[var(--noq-muted)] transition active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={loading !== null}
            className="flex w-full items-center gap-3 rounded-2xl border border-[var(--noq-glass-border)] bg-[var(--noq-tint-10)] px-4 py-3 text-left transition active:scale-[0.99] disabled:opacity-60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--noq-accent)] text-white">
              {loading === 'gps' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[var(--noq-ink)]">Use my current location</span>
              <span className="block text-[11px] leading-4 text-[var(--noq-muted)]">Find salons closest to you right now</span>
            </span>
            {usingGps && <Check className="h-4 w-4 shrink-0 text-[var(--noq-accent)]" />}
          </button>

          {!usingGps && currentLabel && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--noq-border)] bg-white px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--noq-tint-10)] text-[var(--noq-accent)]">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--noq-muted)]">Currently selected</span>
                <span className="block truncate text-sm font-semibold text-[var(--noq-ink)]">{currentLabel}</span>
              </span>
              <Check className="h-4 w-4 shrink-0 text-[var(--noq-accent)]" />
            </div>
          )}

          <form onSubmit={searchArea} className="mt-4">
            <label htmlFor="change-location-area" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E7B79]">
              Search city or area
            </label>
            <div className="mt-2 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--noq-border)] bg-[var(--noq-base)] px-3 focus-within:border-[#62AAA3]">
                <Search className="h-4 w-4 shrink-0 text-[#78908D]" />
                <input
                  id="change-location-area"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder="e.g. Indiranagar"
                  autoComplete="address-level2"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9AA6A4]"
                />
              </div>
              <button disabled={loading !== null} className="h-11 rounded-xl bg-[var(--noq-accent)] px-4 text-xs font-bold text-white disabled:opacity-60">
                {loading === 'manual' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Search'}
              </button>
            </div>
          </form>

          {error && (
            <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs leading-5 text-[#8A3E35]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
