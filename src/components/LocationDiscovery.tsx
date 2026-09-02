import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, LoaderCircle, LocateFixed, MapPin, Navigation, Search } from 'lucide-react';
import type { NearbySalon } from '../types';
import { salonDiscoveryService } from '../services/salonDiscoveryService';
import { readGeolocationPermission, type StoredLocationPreference } from '../services/locationPreferenceService';

type Props = {
  onLocated: (salons: NearbySalon[], label: string, preference: StoredLocationPreference) => void;
  /** Returns to the landing screen. Optional only so this component stays usable if ever reached with nothing behind it. */
  onBack?: () => void;
};

export const LocationDiscovery: React.FC<Props> = ({ onLocated, onBack }) => {
  const [area, setArea] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState<'gps' | 'manual' | null>(null);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const useLocation = useCallback(() => {
    setError('');
    if (!navigator.geolocation) {
      setManualMode(true);
      setError('Location is not available on this device. Search by area instead.');
      return;
    }
    setLoading('gps');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await salonDiscoveryService.byCoordinates(coords.latitude, coords.longitude);
          setPermissionDenied(false);
          onLocated(result.salons, 'Current location', {
            setupCompleted: true,
            mode: 'gps',
            label: 'Current location',
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : 'Unable to load nearby salons.');
          setManualMode(true);
        } finally {
          setLoading(null);
        }
      },
      () => {
        setLoading(null);
        setManualMode(true);
        setPermissionDenied(true);
        setError('Location permission was not granted. Search by city or area instead.');
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  }, [onLocated]);

  // Check the real OS permission before touching GPS. Only auto-locate when the
  // OS already granted access, so reopening the app never triggers a new prompt.
  useEffect(() => {
    let cancelled = false;
    void readGeolocationPermission().then((permission) => {
      if (cancelled) return;
      if (permission === 'granted') useLocation();
      else if (permission === 'denied') {
        setPermissionDenied(true);
        setManualMode(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [useLocation]);

  const searchArea = async (event: FormEvent) => {
    event.preventDefault();
    const search = area.trim();
    if (search.length < 2) return setError('Enter at least 2 characters.');
    setLoading('manual');
    setError('');
    try {
      const result = await salonDiscoveryService.byArea(search);
      onLocated(result.salons, search, { setupCompleted: true, mode: 'manual', label: search, area: search });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to search this area.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div id="location-discovery-screen" className="flex min-h-full flex-col bg-[var(--noq-base)] text-[var(--noq-ink)]">
      {onBack && (
        <div className="px-5 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            id="location-back-btn"
            onClick={onBack}
            aria-label="Back to landing"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--noq-border)] bg-white text-[var(--noq-ink)] transition active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-7 pt-6">
        <div className="noq-glass-surface mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border text-[var(--noq-accent)]">
          <MapPin className="h-7 w-7" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--noq-accent)]">Nearby salons</p>
        <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">Find your closest chair.</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--noq-muted)]">
          Use your location to see onboarded salons ordered by distance, with travel and live waiting times.
        </p>

        <button type="button" onClick={useLocation} disabled={loading !== null}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--noq-accent)] px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60">
          {loading === 'gps' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {loading === 'gps'
            ? 'Finding nearby salons…'
            : permissionDenied
              ? 'Enable location'
              : 'Use my current location'}
        </button>

        <button type="button" onClick={() => { setManualMode(true); setError(''); }}
          className="mt-3 h-11 w-full rounded-xl border border-[var(--noq-border)] bg-white text-sm font-semibold text-[var(--noq-ink)] transition hover:border-[var(--noq-accent)]">
          Choose city or area manually
        </button>


        {manualMode && (
          <form onSubmit={searchArea} className="mt-5 rounded-2xl border border-[var(--noq-border)] bg-white p-4">
            <label htmlFor="location-area" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E7B79]">City or area</label>
            <div className="mt-2 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[var(--noq-border)] bg-[var(--noq-base)] px-3 focus-within:border-[#62AAA3]">
                <Search className="h-4 w-4 shrink-0 text-[#78908D]" />
                <input id="location-area" value={area} onChange={(event) => setArea(event.target.value)}
                  placeholder="e.g. Indiranagar" autoComplete="address-level2"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9AA6A4]" />
              </div>
          <button disabled={loading !== null} className="h-11 rounded-xl bg-[var(--noq-accent)] px-4 text-xs font-bold text-white disabled:opacity-60">
                {loading === 'manual' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Search'}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-[#F0D6D1] bg-[#FFF7F5] p-3 text-xs leading-5 text-[#8A3E35]">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <div className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[var(--noq-muted)]">
          <LocateFixed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--noq-accent)]" />
          Your precise location is used only to calculate nearby results and is not stored.
        </div>
      </div>
    </div>
  );
};
