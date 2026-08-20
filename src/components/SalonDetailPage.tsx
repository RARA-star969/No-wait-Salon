import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, CreditCard, ExternalLink, Lock, MapPin, Navigation, Phone, Receipt, Scissors, Share2, Sparkles, Store, Wifi, Wind, X } from 'lucide-react';
import type { Barber, NearbySalon, QueueItem, Salon } from '../types';
import { toSalonProfile } from '../shared/salonProfile';
import { LiveQueueCard, type QueueTrend } from './LiveQueueCard';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';
import { formatDuration } from '../shared/formatDuration';
import { GOLD_BADGE_CLASS, GOLD_SHIMMER_CLASS, GOLD_SURFACE_CLASS } from '../shared/premiumGold';

type Props = {
  salon: Salon;
  nearbySalons: NearbySalon[];
  queue: QueueItem[];
  barbers: Barber[];
  selectedService: string;
  setSelectedService: (service: string) => void;
  selectedServiceIds: string[];
  setSelectedServiceIds: (ids: string[]) => void;
  onBack: () => void;
  onJoin: () => void;
  onReserve: () => void;
  userEntry: QueueItem | null;
};

const serviceCategory = (name: string) => {
  const value = name.toLocaleLowerCase();
  if (value.includes('beard')) return 'Beard';
  if (value.includes('massage') || value.includes('spa')) return 'Massage & Spa';
  if (value.includes('colour')) return 'Hair Colour';
  if (value.includes('facial')) return 'Facial';
  return 'Hair Care';
};

export const SalonDetailPage: React.FC<Props> = ({ salon, nearbySalons, queue, barbers, selectedService, setSelectedService, selectedServiceIds, setSelectedServiceIds, onBack, onJoin, onReserve, userEntry }) => {
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [premiumSheetOpen, setPremiumSheetOpen] = useState(false);
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('All');
  const waiting = queue.filter((item) => ['Waiting', 'Called'].includes(item.status));
  const activeBarbers = barbers.filter((barber) => barber.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((barber) => barber.status === 'available').length;
  const waitMinutes = activeBarbers ? Math.ceil(waiting.length * 15 / activeBarbers) : 0;
  // Shared with the public web page so the same salon never reads differently.
  const profile = useMemo(
    () => toSalonProfile(salon, { liveWaitMinutes: waitMinutes, waitingCustomers: waiting.length }),
    [salon, waitMinutes, waiting.length],
  );
  // The USP card's own compact wording ("8 min", not "8 min wait") — kept
  // local to this card so the shared salonProfile.waitLabel() used elsewhere
  // (including the public QR web page) is untouched.
  const compactWaitLabel = waitMinutes > 0 ? formatDuration(waitMinutes) : 'Ready now';
  const queueStatusLabel = waiting.length === 0 ? 'Ready now' : availableBarbers > 0 ? 'Queue moving steadily' : 'All chairs busy right now';
  const categories = useMemo(() => Array.from(new Set(profile.services.map((service) => serviceCategory(service.name)))), [profile.services]);
  const branches = nearbySalons.filter((item) => item.id !== salon.id && salon.brandKey && item.brandKey === salon.brandKey);

  // Default to whatever the top-level app already had selected, so the two
  // pickers (legacy single-service string, new multi-select ids) never fight.
  useEffect(() => {
    if (selectedServiceIds.length || !profile.services.length) return;
    const match = profile.services.find((service) => service.name === selectedService) || profile.services[0];
    if (match) setSelectedServiceIds([match.id]);
  }, [profile.services, selectedService, selectedServiceIds.length, setSelectedServiceIds]);

  const filteredServices = useMemo(() => filterServices(profile.services, serviceFilter), [profile.services, serviceFilter]);
  const totals = useMemo(() => selectionTotals(profile.services, selectedServiceIds), [profile.services, selectedServiceIds]);

  const toggleService = (id: string) => {
    const next = selectedServiceIds.includes(id) ? selectedServiceIds.filter((value) => value !== id) : [...selectedServiceIds, id];
    setSelectedServiceIds(next);
    const names = profile.services.filter((service) => next.includes(service.id)).map((service) => service.name);
    setSelectedService(names.join(' + ') || profile.services[0]?.name || '');
  };

  // Trend arrows compare against the previous render's numbers, purely a
  // client-side visual cue layered on top of the server-authoritative queue.
  const previousStats = useRef({ waitMinutes, waitingCount: waiting.length });
  const [waitTrend, setWaitTrend] = useState<QueueTrend>('steady');
  const [aheadTrend, setAheadTrend] = useState<QueueTrend>('steady');
  useEffect(() => {
    const prev = previousStats.current;
    setWaitTrend(waitMinutes < prev.waitMinutes ? 'down' : waitMinutes > prev.waitMinutes ? 'up' : 'steady');
    setAheadTrend(waiting.length < prev.waitingCount ? 'down' : waiting.length > prev.waitingCount ? 'up' : 'steady');
    previousStats.current = { waitMinutes, waitingCount: waiting.length };
  }, [waitMinutes, waiting.length]);

  const directionsUrl = `https://maps.google.com/?q=${salon.latitude},${salon.longitude}`;
  const shareSalon = async () => {
    const shareData = { title: salon.name, text: `${salon.name}\n${salon.address}`, url: directionsUrl };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`).catch(() => undefined);
  };

  return (
    <div id="customer-salon-screen" className="relative min-h-full overflow-y-auto bg-[#F5F7F6] pb-[calc(8.5rem+env(safe-area-inset-bottom))] text-[#17201F] animate-in fade-in duration-200">
      <section className="relative min-h-[270px] overflow-hidden bg-[#173B38] text-white">
        {salon.coverImageUrl ? <img src={salon.coverImageUrl} alt={`${salon.name} interior`} className="absolute inset-0 h-full w-full object-cover opacity-80" /> : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_22%,#4A7C76_0,transparent_38%),linear-gradient(145deg,#102B28,#224C47_58%,#C3A66A)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-[#102725]/95" />
        <div className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button onClick={onBack} id="back-to-salons-btn" aria-label="Back to nearby salons" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex gap-2">
            <button onClick={() => setSaved((value) => !value)} aria-label={saved ? 'Remove saved salon' : 'Save salon'} className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md ${saved ? 'bg-white text-[#0F766E]' : 'bg-black/35 text-white'}`}><Bookmark className={`h-[18px] w-[18px] ${saved ? 'fill-current' : ''}`} /></button>
            <button onClick={shareSalon} aria-label="Share salon" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md"><Share2 className="h-[18px] w-[18px]" /></button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5">
          <div className="flex items-end gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/80 bg-[#E3F1EF] text-[#0F766E] shadow-lg">
              {salon.logoImageUrl ? <img src={salon.logoImageUrl} alt={`${salon.name} logo`} className="h-full w-full object-cover" /> : <Scissors className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${salon.isOpen ? 'bg-[#5EE0B4]' : 'bg-[#E58C82]'}`} /><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{salon.isOpen ? 'Open now' : 'Closed'}</span></div>
              <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere]">{salon.name}</h1>
              <p className="mt-1 text-xs font-medium text-white/75">{salon.category || 'Salon & grooming'} · {salon.distanceKm} km away</p>
            </div>
          </div>
          <button
            type="button"
            id="salon-address-trigger"
            onClick={() => setAddressSheetOpen(true)}
            className="mt-3 flex w-full items-start gap-1.5 text-left text-[11px] leading-4 text-white/75 underline decoration-white/30 underline-offset-2"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{salon.address}</span>
          </button>
        </div>
      </section>

      <div className="space-y-5 px-4 py-4">
        <section className="grid grid-cols-4 gap-2">
          <QuickAction icon={<Clock3 />} label={salon.isOpen ? 'Open' : 'Closed'} secondary={salon.openingHours.split('·')[1]?.trim()} />
          <QuickAction icon={<Navigation />} label="Directions" href={directionsUrl} />
          {salon.phoneNumber ? <QuickAction icon={<Phone />} label="Call" href={`tel:${salon.phoneNumber}`} /> : <QuickAction icon={<Store />} label="Branches" disabled={branches.length === 0} secondary={branches.length ? `${branches.length} nearby` : undefined} />}
          <QuickAction icon={<Check />} label={visited ? 'Visited' : 'Been here'} onClick={() => setVisited((value) => !value)} active={visited} />
        </section>

        <section>
          <LiveQueueCard
            waitLabel={compactWaitLabel}
            waitDeltaLabel={waitTrend === 'down' ? '↓ moving' : waitTrend === 'up' ? '↑ busier' : undefined}
            peopleAhead={waiting.length}
            peopleAheadTrend={aheadTrend}
            readyChairs={availableBarbers}
            totalChairs={activeBarbers}
            activityLabel={queueStatusLabel}
          />
          <button onClick={onReserve} id="reserve-slot-btn" className={`mt-2 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-xs font-bold ${GOLD_SURFACE_CLASS}`}>
            <div aria-hidden="true" className={GOLD_SHIMMER_CLASS} />
            <span className="relative flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2A1B04]/20 ring-1 ring-white/40"><CalendarDays className="h-3.5 w-3.5" /></span>
              Reserve a future queue window
              <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${GOLD_BADGE_CLASS}`}><Lock className="h-2.5 w-2.5" />Premium</span>
            </span>
            <ChevronRight className="relative h-4 w-4 shrink-0" />
          </button>
        </section>

        <section className="relative aspect-[2.4/1] min-h-[128px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#173E3A] to-[#3F746D] p-5 text-white">
          <div className="max-w-[72%]"><span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider"><Sparkles className="h-3 w-3" />At {salon.name}</span><h2 className="mt-3 text-lg font-bold leading-tight">Your next grooming visit, without the waiting room.</h2></div>
          <Scissors className="absolute -bottom-4 -right-2 h-28 w-28 rotate-[-12deg] text-white/10" />
        </section>

        {!!profile.offers.length && <section><SectionTitle eyebrow="Savings" title="Available offers" /><div className="flex snap-x gap-3 overflow-x-auto pb-1">{profile.offers.map((offer) => <div key={offer.id} className="min-w-[260px] snap-start rounded-2xl border border-[#E0E6E5] bg-white p-4"><p className="text-xs font-bold text-[#0F766E]">{offer.discount}</p><h3 className="mt-1 text-sm font-bold">{offer.title}</h3>{offer.minimumBill && <p className="mt-2 text-[10px] text-[#778481]">Minimum bill {offer.minimumBill}</p>}<p className="mt-1 text-[10px] text-[#778481]">{offer.validity}</p></div>)}</div></section>}

        <section><SectionTitle eyebrow="Explore" title="Services" /><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <a key={category} href="#service-menu" className="flex min-w-[104px] flex-col items-center rounded-2xl border border-[#E0E7E6] bg-white px-3 py-4 text-center"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E7F3F1] text-[#0F766E]"><Scissors className="h-4 w-4" /></span><span className="mt-2 text-[11px] font-bold">{category}</span></a>)}</div></section>

        <section id="service-menu">
          <SectionTitle eyebrow="Choose your services" title="Service menu" secondary={totals.count ? `${totals.count} selected` : 'Select services'} />
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {SERVICE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setServiceFilter(filter)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold ${serviceFilter === filter ? 'border-[#0F766E] bg-[#0F766E] text-white' : 'border-[#DDE7E5] bg-white text-[#536966]'}`}
              >
                {filter}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            {filteredServices.map((service) => {
              const active = selectedServiceIds.includes(service.id);
              return (
                <button key={service.id} id={`service-opt-${service.id}`} type="button" onClick={() => toggleService(service.id)} aria-pressed={active} className={`flex w-full items-center gap-3 rounded-2xl border bg-white p-4 text-left ${active ? 'border-[#4F9D95] ring-1 ring-[#4F9D95] bg-[#F1FAF9]' : 'border-[#E0E7E6]'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border ${active ? 'border-[#0F766E] bg-[#0F766E] text-white' : 'border-[#C7D0CE] text-transparent'}`}><Check className="h-3 w-3" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{service.name}</span>{service.description && <span className="mt-1 block text-[10px] leading-4 text-[#788582]">{service.description}</span>}<span className="mt-2 block text-[10px] font-semibold text-[#60716E]">{formatDuration(service.durationMin)}</span></span>
                  <span className="self-start text-sm font-bold">₹{service.priceInr}</span>
                </button>
              );
            })}
            {filteredServices.length === 0 && <p className="rounded-2xl border border-[#E0E7E6] bg-white p-5 text-center text-xs text-[#788582]">No services in this filter yet.</p>}
          </div>
        </section>

        {!!profile.gallery.length && <section><SectionTitle eyebrow="Inside the salon" title="Vibes" /><div className="flex snap-x gap-3 overflow-x-auto">{profile.gallery.map((item) => <div key={item.id} className="relative aspect-[4/5] min-w-[160px] snap-start overflow-hidden rounded-2xl bg-[#DDE9E7]"><img src={item.imageUrl} alt={item.label || salon.name} className="h-full w-full object-cover" />{item.type === 'video' && <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[9px] font-bold text-white">Video · muted</span>}</div>)}</div></section>}

        <section className="rounded-2xl border border-[#E0E7E6] bg-white p-4"><SectionTitle eyebrow="Our story" title={`About ${salon.name}`} /><p className={`text-xs leading-5 text-[#657471] ${aboutExpanded ? '' : 'line-clamp-3'}`}>{profile.description}</p><button onClick={() => setAboutExpanded((value) => !value)} className="mt-2 flex items-center gap-1 text-xs font-bold text-[#0F766E]">Read {aboutExpanded ? 'less' : 'more'}<ChevronDown className={`h-3.5 w-3.5 transition ${aboutExpanded ? 'rotate-180' : ''}`} /></button>{!!profile.amenities.length && <div className="mt-4 flex flex-wrap gap-2">{profile.amenities.map((amenity) => <span key={amenity} className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F5F4] px-3 py-1.5 text-[10px] font-semibold text-[#536966]">{amenity.includes('Wi-Fi') ? <Wifi className="h-3 w-3" /> : amenity.includes('Air') ? <Wind className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}{amenity}</span>)}</div>}</section>

        <section className="rounded-2xl border border-[#E0E7E6] bg-white p-4"><SectionTitle eyebrow="Visit" title="Location & hours" /><p className="text-xs leading-5 text-[#657471]">{salon.address}</p><p className="mt-2 text-xs font-semibold">{profile.openingHours}</p><a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#BED7D3] text-xs font-bold text-[#0F766E]"><Navigation className="h-4 w-4" />View directions<ExternalLink className="h-3 w-3" /></a></section>

        {!!branches.length && <section><SectionTitle eyebrow="More nearby" title="Other branches near you" /><div className="space-y-2">{branches.map((branch) => <div key={branch.id} className="rounded-2xl border border-[#E0E7E6] bg-white p-4"><p className="text-sm font-bold">{branch.name}</p><p className="mt-1 text-[10px] text-[#788582]">{branch.distanceKm} km · {branch.liveWaitMinutes ? `${formatDuration(branch.liveWaitMinutes)} wait` : 'No wait'}</p></div>)}</div></section>}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DDE5E3] bg-white/95 px-3 pt-2.5 pb-[max(.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        {!userEntry && totals.count > 0 && (
          <button
            type="button"
            id="selected-price-summary-btn"
            onClick={() => setPriceSheetOpen(true)}
            aria-label="View price breakdown"
            className="mx-auto mb-2 flex w-full max-w-xl items-center justify-between text-[11px] font-semibold text-[#4C5A58]"
          >
            <span>{totals.count} {totals.count === 1 ? 'service' : 'services'} selected</span>
            <span className="flex items-center gap-1 text-sm font-bold text-[#17201F]">
              ₹{totals.totalPriceInr}
              <ChevronRight className="h-3.5 w-3.5 text-[#0F766E]" />
            </span>
          </button>
        )}
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto] gap-2">
          <button id="join-live-queue-btn" onClick={onJoin} disabled={!userEntry && totals.count === 0} className="min-h-13 min-w-0 rounded-xl bg-[#0F766E] px-3 text-xs font-bold text-white sm:text-sm disabled:opacity-50">{userEntry ? 'View live queue' : 'Join Queue'}</button>
          <button
            type="button"
            onClick={() => setPremiumSheetOpen(true)}
            aria-label="Premium features, coming soon"
            className={`relative min-h-13 flex items-center justify-center gap-1.5 overflow-hidden rounded-xl px-3.5 text-xs font-bold ${GOLD_SURFACE_CLASS}`}
          >
            <div aria-hidden="true" className={GOLD_SHIMMER_CLASS} />
            <Lock className="relative h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {addressSheetOpen && (
        <StoreAddressSheet
          salonName={salon.name}
          address={salon.address}
          phoneNumber={salon.phoneNumber}
          directionsUrl={directionsUrl}
          onClose={() => setAddressSheetOpen(false)}
        />
      )}
      {premiumSheetOpen && <PremiumLockedSheet onClose={() => setPremiumSheetOpen(false)} />}
      {priceSheetOpen && (
        <PriceBreakdownSheet
          services={profile.services.filter((service) => selectedServiceIds.includes(service.id))}
          totalPriceInr={totals.totalPriceInr}
          onClose={() => setPriceSheetOpen(false)}
        />
      )}
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; href?: string; onClick?: () => void; active?: boolean; disabled?: boolean }> = ({ icon, label, secondary, href, onClick, active, disabled }) => {
  const content = <><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-[#B9E4DC] text-[#075E55]' : 'bg-white/10 text-white'} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span><span className="mt-2 text-[10px] font-bold leading-tight">{label}</span>{secondary && <span className="mt-0.5 line-clamp-1 text-[8px] text-white/55">{secondary}</span>}</>;
  const classes = `flex min-h-[92px] flex-col items-center rounded-2xl bg-[#1D3734] px-1.5 py-2.5 text-center text-white ${disabled ? 'opacity-45' : ''}`;
  return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={classes}>{content}</a> : <button type="button" onClick={onClick} disabled={disabled} className={classes}>{content}</button>;
};

const SectionTitle: React.FC<{ eyebrow: string; title: string; secondary?: string }> = ({ eyebrow, title, secondary }) => <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#73827F]">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em]">{title}</h2></div>{secondary && <span className="text-[10px] font-semibold text-[#0F766E]">{secondary}</span>}</div>;

/** Premium bottom sheet for the salon's full address, matching the reference design. */
const StoreAddressSheet: React.FC<{ salonName: string; address: string; phoneNumber?: string; directionsUrl: string; onClose: () => void }> = ({ salonName, address, phoneNumber, directionsUrl, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Store address" className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0] sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">Store address</p>
          <h2 className="mt-1 truncate text-xl font-bold text-[#17201F]">{salonName}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E2EAE9]"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-4 rounded-2xl border border-[#E1E7E6] bg-white p-4 text-xs leading-5 text-[#4C5A58] [overflow-wrap:anywhere]">{address}</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {phoneNumber ? (
          <a href={`tel:${phoneNumber}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#DDE7E5] bg-white text-xs font-bold text-[#17201F]"><Phone className="h-4 w-4 text-[#0F766E]" />Call salon</a>
        ) : (
          <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E1E7E6] bg-[#F1F4F3] text-xs font-semibold text-[#9AA6A3]"><Phone className="h-4 w-4" />No number listed</span>
        )}
        <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-xs font-bold text-white"><Navigation className="h-4 w-4" />Directions</a>
      </div>
    </section>
  </div>
);

/**
 * Real, honest price breakdown for the currently selected services — the
 * subtotal is the total, since nothing here fabricates a coupon or discount.
 * Structured with a distinct "future benefits" slot so promo codes,
 * discounts and membership benefits can be added later without reshaping
 * this sheet.
 */
const PriceBreakdownSheet: React.FC<{ services: { id: string; name: string; priceInr: number }[]; totalPriceInr: number; onClose: () => void }> = ({ services, totalPriceInr, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Price breakdown" className="flex max-h-[80vh] w-full flex-col rounded-t-3xl bg-[#F8FAFA] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
      <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-[#C9D2D0] sm:hidden" />
      <div className="flex shrink-0 items-start justify-between gap-3 px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E7F5F2] text-[#0F766E]"><Receipt className="h-4 w-4" /></span>
          <h2 className="text-lg font-bold text-[#17201F]">Price breakdown</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E2EAE9]"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto px-5">
        {services.map((service) => (
          <div key={service.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
            <span className="truncate text-sm font-semibold text-[#17201F]">{service.name}</span>
            <span className="shrink-0 text-sm font-bold text-[#17201F]">₹{service.priceInr}</span>
          </div>
        ))}
        {services.length === 0 && <p className="rounded-2xl border border-[#E1E7E6] bg-white p-4 text-center text-xs text-[#788582]">No services selected yet.</p>}
      </div>
      {/* Reserved for coupons, discounts, and membership benefits — none exist
          yet, so nothing fake is shown here. */}
      <div className="shrink-0 space-y-2 border-t border-[#E1E7E6] px-5 pt-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#4C5A58]">
          <span>Subtotal</span>
          <span>₹{totalPriceInr}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold text-[#17201F]">
          <span>Total</span>
          <span>₹{totalPriceInr}</span>
        </div>
      </div>
    </section>
  </div>
);

/** Coming-soon preview for premium capabilities — never a fake purchase flow. */
const PremiumLockedSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Premium features" className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0] sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ${GOLD_SURFACE_CLASS}`}><div aria-hidden="true" className={GOLD_SHIMMER_CLASS} /><Lock className="relative h-4 w-4" /></span>
          <h2 className="text-lg font-bold text-[#17201F]">Premium, coming soon</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E2EAE9]"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#657471]">A preview of what a premium membership will unlock. Nothing here is billed yet.</p>
      <div className="mt-4 space-y-2">
        {['Priority queue placement', 'Advance reservation windows', 'Favourite-stylist auto-hold'].map((feature) => (
          <div key={feature} className="flex items-center gap-3 rounded-xl border border-[#D9BE84] bg-white p-3">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${GOLD_BADGE_CLASS}`}><Lock className="h-3.5 w-3.5" /></span>
            <span className="text-xs font-semibold text-[#3B4644]">{feature}</span>
          </div>
        ))}
      </div>
    </section>
  </div>
);
