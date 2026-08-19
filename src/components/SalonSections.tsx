import React from 'react';
import { Check, Clock, CreditCard, MapPin, Navigation, Scissors, Sparkles, Star, Users, Wifi, Wind } from 'lucide-react';
import type { Barber } from '../types';
import type { SalonProfile } from '../shared/salonProfile';
import { waitLabel } from '../shared/salonProfile';

/**
 * The salon detail sections, shared verbatim by the Customer app's salon screen
 * and the public QR web page.
 *
 * These are presentation components on purpose: both surfaces feed them the
 * same `SalonProfile` (built from the one salon record the Admin panel edits),
 * so an admin change lands on both, and neither surface can quietly grow its
 * own layout, hierarchy or spacing.
 */

export const SectionHeading: React.FC<{ eyebrow: string; title: string; trailing?: string }> = ({
  eyebrow,
  title,
  trailing,
}) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#73827F]">{eyebrow}</p>
      <h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em] text-[#17201F]">{title}</h2>
    </div>
    {trailing && <span className="text-[10px] font-semibold text-[#0F766E]">{trailing}</span>}
  </div>
);

/** Identity row: logo, name, category, address, rating and open state. */
export const SalonIdentity: React.FC<{ profile: SalonProfile }> = ({ profile }) => (
  <div className="rounded-3xl border border-[#E2EAE9] bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,32,31,0.18)]">
    <div className="flex items-start gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#E5F3F1] ring-1 ring-[#D3E7E4]">
        {profile.logoImageUrl ? (
          <img src={profile.logoImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <Scissors className="h-5 w-5 text-[#0F766E]" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[19px] font-bold leading-tight tracking-[-0.02em] text-[#17201F]">{profile.name}</h1>
        {profile.category && <p className="mt-0.5 truncate text-[11px] font-semibold text-[#0F766E]">{profile.category}</p>}
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-[#667371]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{profile.address}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {profile.rating > 0 && (
          <span className="flex items-center gap-1 rounded-lg bg-[#FFF8EC] px-2 py-1 text-xs font-bold text-[#8A6516]">
            <Star className="h-3.5 w-3.5 fill-[#F5A524] text-[#F5A524]" />
            {profile.rating}
            {profile.reviewCount > 0 && <span className="font-semibold text-[#A98A44]">({profile.reviewCount})</span>}
          </span>
        )}
        <span
          className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            profile.isOpen ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-[#F3F0EE] text-[#8A6A62]'
          }`}
        >
          {profile.isOpen ? 'Open now' : 'Closed'}
        </span>
      </div>
    </div>
  </div>
);

/** Live queue band. Both surfaces show the same numbers from the same source. */
export const SalonLiveQueue: React.FC<{
  profile: SalonProfile;
  peopleAhead: number;
  openChairs: number;
  workingChairs: number;
}> = ({ profile, peopleAhead, openChairs, workingChairs }) => (
  <section id="salon-live-queue" className="overflow-hidden rounded-2xl border border-[#BFDAD6] bg-[#E6F3F1] p-4">
    <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#4E7772]">No-Wait live queue</p>
    <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-[#125B54]">{waitLabel(profile.liveWaitMinutes)}</h2>
    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5C7773]">
      <Users className="h-3.5 w-3.5" />
      {peopleAhead} {peopleAhead === 1 ? 'person' : 'people'} ahead · {openChairs} of {workingChairs}{' '}
      {workingChairs === 1 ? 'chair' : 'chairs'} ready
    </p>
  </section>
);

export const SalonOffers: React.FC<{ profile: SalonProfile }> = ({ profile }) => {
  if (profile.offers.length === 0) return null;
  return (
    <section id="salon-offers">
      <SectionHeading eyebrow="Savings" title="Available offers" />
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {profile.offers.map((offer) => (
          <div key={offer.id} className="min-w-[240px] snap-start rounded-2xl border border-[#F2E2C9] bg-[#FFFBF3] p-4">
            {offer.discount && <p className="flex items-center gap-1 text-xs font-bold text-[#0F766E]"><Sparkles className="h-3 w-3" />{offer.discount}</p>}
            <h3 className="mt-1 text-sm font-bold text-[#5C4713]">{offer.title}</h3>
            {offer.minimumBill && <p className="mt-2 text-[10px] text-[#9A7327]">Minimum bill {offer.minimumBill}</p>}
            {offer.validity && <p className="mt-0.5 text-[10px] text-[#9A7327]">{offer.validity}</p>}
          </div>
        ))}
      </div>
    </section>
  );
};

/** Service menu with selection. Identical rows on both surfaces. */
export const SalonServiceMenu: React.FC<{
  profile: SalonProfile;
  selectedServiceId?: string;
  selectedServiceName?: string;
  onSelect: (serviceId: string, serviceName: string) => void;
}> = ({ profile, selectedServiceId, selectedServiceName, onSelect }) => (
  <section id="salon-service-menu">
    <SectionHeading eyebrow="Choose your service" title="Service menu" trailing="Select one service" />
    <div className="space-y-2.5">
      {profile.services.map((service) => {
        const active = selectedServiceId ? service.id === selectedServiceId : service.name === selectedServiceName;
        return (
          <button
            key={service.id}
            id={`service-opt-${service.id}`}
            type="button"
            onClick={() => onSelect(service.id, service.name)}
            aria-pressed={active}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
              active
                ? 'border-[#0F766E] bg-[#F1FAF9] shadow-[0_4px_14px_-8px_rgba(15,118,110,0.5)]'
                : 'border-[#E2EAE9] bg-white'
            }`}
          >
            <span
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                active ? 'border-[#0F766E] bg-[#0F766E]' : 'border-[#CBD8D6]'
              }`}
            >
              {active && <Check className="h-3 w-3 text-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[#17201F]">{service.name}</span>
              {service.description && (
                <span className="mt-0.5 block text-[11px] leading-4 text-[#788582]">{service.description}</span>
              )}
              <span className="mt-0.5 flex items-center gap-1 text-xs text-[#667371]">
                <Clock className="h-3 w-3" /> {service.durationMin} min
              </span>
            </span>
            <span className="shrink-0 text-[15px] font-bold text-[#17201F]">₹{service.priceInr}</span>
          </button>
        );
      })}
      {profile.services.length === 0 && (
        <p className="rounded-2xl border border-[#E2EAE9] bg-white p-5 text-center text-xs text-[#788582]">
          No services listed yet.
        </p>
      )}
    </div>
  </section>
);

/** Stylists on duty. Shown wherever the salon has staff configured. */
export const SalonStylists: React.FC<{ barbers: Barber[] }> = ({ barbers }) => {
  const roster = barbers.filter((barber) => barber.status !== 'unavailable');
  if (roster.length === 0) return null;
  return (
    <section id="salon-stylists">
      <SectionHeading eyebrow="The team" title="Stylists today" />
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {roster.map((barber) => (
          <div key={barber.id} className="min-w-[128px] snap-start rounded-2xl border border-[#E0E7E6] bg-white p-4 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#E7F3F1] text-sm font-bold text-[#0F766E]">
              {barber.name.slice(0, 1).toUpperCase()}
            </span>
            <p className="mt-2 truncate text-xs font-bold text-[#17201F]">{barber.name}</p>
            <p
              className={`mt-0.5 text-[10px] font-semibold ${
                barber.status === 'available' ? 'text-[#0F766E]' : 'text-[#8A6A62]'
              }`}
            >
              {barber.status === 'available' ? 'Free now' : 'With a customer'}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const SalonGallery: React.FC<{ profile: SalonProfile }> = ({ profile }) => {
  if (profile.gallery.length === 0) return null;
  return (
    <section id="salon-gallery">
      <SectionHeading eyebrow="Inside the salon" title="Vibes" />
      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {profile.gallery.map((item) => (
          <div key={item.id} className="relative aspect-[4/5] min-w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#DDE9E7]">
            <img src={item.imageUrl} alt={item.label || profile.name} className="h-full w-full object-cover" />
            {item.type === 'video' && (
              <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[9px] font-bold text-white">
                Video · muted
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

const amenityIcon = (amenity: string) =>
  amenity.includes('Wi-Fi') ? <Wifi className="h-3 w-3" /> : amenity.includes('Air') ? <Wind className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />;

export const SalonAbout: React.FC<{ profile: SalonProfile }> = ({ profile }) => (
  <section id="salon-about" className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
    <SectionHeading eyebrow="Our story" title={`About ${profile.name}`} />
    <p className="text-xs leading-5 text-[#657471]">{profile.description}</p>
    {profile.amenities.length > 0 && (
      <div className="mt-4 flex flex-wrap gap-2">
        {profile.amenities.map((amenity) => (
          <span
            key={amenity}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F5F4] px-3 py-1.5 text-[10px] font-semibold text-[#536966]"
          >
            {amenityIcon(amenity)}
            {amenity}
          </span>
        ))}
      </div>
    )}
  </section>
);

export const SalonLocationHours: React.FC<{ profile: SalonProfile }> = ({ profile }) => (
  <section id="salon-location" className="rounded-2xl border border-[#E0E7E6] bg-white p-4">
    <SectionHeading eyebrow="Visit" title="Location & hours" />
    <p className="text-xs leading-5 text-[#657471]">{profile.address}</p>
    {profile.openingHours && <p className="mt-2 text-xs font-semibold text-[#25302F]">{profile.openingHours}</p>}
    <a
      href={profile.directionsUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#BED7D3] text-xs font-bold text-[#0F766E]"
    >
      <Navigation className="h-4 w-4" />
      View directions
    </a>
  </section>
);
