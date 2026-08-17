import React, { FormEvent, useState } from 'react';
import { AlertCircle, LoaderCircle, LocateFixed, MapPin, Navigation, Search } from 'lucide-react';
import type { NearbySalon } from '../types';
import { salonDiscoveryService } from '../services/salonDiscoveryService';

type Props = {
  onLocated: (salons: NearbySalon[], label: string) => void;
};

export const LocationDiscovery: React.FC<Props> = ({ onLocated }) => {
  const [area, setArea] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState<'gps' | 'manual' | null>(null);
  const [error, setError] = useState('');

  const useLocation = () => {
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
          onLocated(result.salons, 'Current location');
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
      if (!result.salons.length) return setError(`No onboarded salons found near “${search}”. Try Bengaluru or Indiranagar.`);
      onLocated(result.salons, search);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to search this area.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div id="location-discovery-screen" className="flex min-h-full flex-col bg-[#F8FAFA] px-5 pb-7 pt-10 text-[#17201F]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#CDE3E0] bg-[#E8F5F3] text-[#0F766E]">
          <MapPin className="h-7 w-7" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0F766E]">Nearby salons</p>
        <h1 className="mt-2 text-[29px] font-bold leading-[1.12] tracking-[-0.04em]">Find your closest chair.</h1>
        <p className="mt-3 max-w-sm text-sm leading-6 text-[#667371]">
          Use your location to see onboarded salons ordered by distance, with travel and live waiting times.
        </p>

        <button type="button" onClick={useLocation} disabled={loading !== null}
          className="mt-7 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-4 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60">
          {loading === 'gps' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
          {loading === 'gps' ? 'Finding nearby salons…' : 'Use my current location'}
        </button>

        <button type="button" onClick={() => { setManualMode(true); setError(''); }}
          className="mt-3 h-11 w-full rounded-xl border border-[#D7E2E0] bg-white text-sm font-semibold text-[#35504D] transition hover:border-[#9CCBC6]">
          Choose city or area manually
        </button>

        {manualMode && (
          <form onSubmit={searchArea} className="mt-5 rounded-2xl border border-[#DCE5E3] bg-white p-4">
            <label htmlFor="location-area" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6E7B79]">City or area</label>
            <div className="mt-2 flex gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#D7E2E0] bg-[#F8FAFA] px-3 focus-within:border-[#62AAA3]">
                <Search className="h-4 w-4 shrink-0 text-[#78908D]" />
                <input id="location-area" value={area} onChange={(event) => setArea(event.target.value)}
                  placeholder="e.g. Indiranagar" autoComplete="address-level2"
                  className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9AA6A4]" />
              </div>
              <button disabled={loading !== null} className="h-11 rounded-xl bg-[#173F3B] px-4 text-xs font-bold text-white disabled:opacity-60">
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
        <div className="mt-6 flex items-start gap-2 text-[11px] leading-5 text-[#788582]">
          <LocateFixed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
          Your precise location is used only to calculate nearby results and is not stored.
        </div>
      </div>
    </div>
  );
};
