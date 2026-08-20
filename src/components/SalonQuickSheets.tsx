import React from 'react';
import { Calendar, Check, MapPin, Navigation, Phone, Store } from 'lucide-react';
import type { NearbySalon, Salon } from '../types';
import { BottomSheet, ComingSoonNotice } from './BottomSheet';

/** Which quick-action / header sheet is currently open, or none. */
export type SalonSheetKind = 'address' | 'open' | 'directions' | 'branches' | 'been-here' | null;

type Props = {
  kind: SalonSheetKind;
  onClose: () => void;
  salon: Salon;
  address: string;
  directionsUrl: string;
  openingHours: string;
  branches: NearbySalon[];
  visited: boolean;
  onToggleVisited: () => void;
};

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The salon page's header/address row and 4 quick-action tiles all open one
 * of these sheets. Real data (weekly hours, directions URL, nearby branches)
 * is used wherever the salon record already carries it; anything not wired
 * to a backend yet says so honestly instead of inventing numbers.
 */
export const SalonQuickSheets: React.FC<Props> = ({
  kind,
  onClose,
  salon,
  address,
  directionsUrl,
  openingHours,
  branches,
  visited,
  onToggleVisited,
}) => {
  if (kind === 'address') {
    return (
      <BottomSheet open onClose={onClose} label="Salon location" eyebrow="Location" title={salon.name} icon={<MapPin className="h-4.5 w-4.5" />} id="salon-address-sheet">
        <div className="rounded-2xl border border-[#E1E7E6] bg-white p-4">
          <p className="flex items-start gap-2 text-sm leading-6 text-[#3B4644]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" />
            {address}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {salon.phoneNumber ? (
            <a href={`tel:${salon.phoneNumber}`} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#0F766E] text-xs font-bold text-white">
              <Phone className="h-4 w-4" /> Call salon
            </a>
          ) : (
            <button type="button" disabled className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#E9EFEE] text-xs font-bold text-[#96A19E]">
              <Phone className="h-4 w-4" /> Number unavailable
            </button>
          )}
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-[#BED7D3] text-xs font-bold text-[#0F766E]"
          >
            <Navigation className="h-4 w-4" /> Directions
          </a>
        </div>
      </BottomSheet>
    );
  }

  if (kind === 'open') {
    const hours = salon.weeklyHours || [];
    return (
      <BottomSheet open onClose={onClose} label="Salon timing" eyebrow="Timing" title="Salon hours" icon={<Calendar className="h-4.5 w-4.5" />} id="salon-timing-sheet">
        {openingHours && (
          <p className="rounded-2xl border border-[#BFDAD6] bg-[#E6F3F1] px-4 py-3 text-sm font-bold text-[#0F5F58]">{openingHours}</p>
        )}
        {hours.length > 0 ? (
          <div className="mt-3 divide-y divide-[#EEF3F2] rounded-2xl border border-[#E1E7E6] bg-white">
            {DAY_ORDER.map((day) => {
              const entry = hours.find((row) => row.day === day);
              return (
                <div key={day} className="flex items-center justify-between px-4 py-2.5 text-xs">
                  <span className="font-semibold text-[#3B4644]">{day}</span>
                  <span className={entry?.closed ? 'font-semibold text-[#B4483A]' : 'font-semibold text-[#5A6866]'}>
                    {entry ? (entry.closed ? 'Closed' : `${entry.openTime} – ${entry.closeTime}`) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <ComingSoonNotice text="A day-by-day schedule from this salon isn't published yet." />
        )}
      </BottomSheet>
    );
  }

  if (kind === 'directions') {
    return (
      <BottomSheet open onClose={onClose} label="Directions" eyebrow="Getting there" title="Directions & help" icon={<Navigation className="h-4.5 w-4.5" />} id="salon-directions-sheet">
        <p className="rounded-2xl border border-[#E1E7E6] bg-white p-4 text-sm leading-6 text-[#3B4644]">{address}</p>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0F766E] text-sm font-bold text-white"
        >
          <Navigation className="h-4 w-4" /> Open in Maps
        </a>
        {salon.phoneNumber && (
          <a href={`tel:${salon.phoneNumber}`} className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#BED7D3] text-sm font-bold text-[#0F766E]">
            <Phone className="h-4 w-4" /> Ask the salon
          </a>
        )}
      </BottomSheet>
    );
  }

  if (kind === 'branches') {
    return (
      <BottomSheet open onClose={onClose} label="Other branches" eyebrow="More nearby" title="Other branches" icon={<Store className="h-4.5 w-4.5" />} id="salon-branches-sheet">
        {branches.length > 0 ? (
          <div className="space-y-2">
            {branches.map((branch) => (
              <div key={branch.id} className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
                <p className="text-sm font-bold text-[#17201F]">{branch.name}</p>
                <p className="mt-1 text-[11px] text-[#788582]">
                  {branch.distanceKm} km · {branch.liveWaitMinutes ? `${branch.liveWaitMinutes} min wait` : 'No wait'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <ComingSoonNotice text="No other branches are linked to this salon yet." />
        )}
      </BottomSheet>
    );
  }

  if (kind === 'been-here') {
    return (
      <BottomSheet open onClose={onClose} label="Visit history" eyebrow="Your visits" title="Been here before?" icon={<Check className="h-4.5 w-4.5" />} id="salon-been-here-sheet">
        <p className="text-xs leading-5 text-[#667371]">
          Mark this salon as visited to help us tailor recommendations. Visit history isn't tracked from your account yet — this is a local preview only.
        </p>
        <button
          type="button"
          onClick={onToggleVisited}
          className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold transition ${
            visited ? 'bg-[#0F766E] text-white' : 'border border-[#BED7D3] text-[#0F766E]'
          }`}
        >
          <Check className="h-4 w-4" /> {visited ? "You've been here" : 'Mark as been here'}
        </button>
      </BottomSheet>
    );
  }

  return null;
};
