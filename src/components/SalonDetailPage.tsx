import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Brush, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, CreditCard, Droplet, ExternalLink, Lock, MapPin, Navigation, Phone, Scissors, Share2, Sparkles, Store, Waves, Wifi, Wind, X } from 'lucide-react';
import type { Barber, NearbySalon, QueueItem, Salon } from '../types';
import { toSalonProfile } from '../shared/salonProfile';
import { getQueueReadyState, LiveQueueCard, queueCtaLabel, type QueueTrend } from './LiveQueueCard';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';

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

const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  Beard: <Brush className="h-4 w-4" />,
  'Massage & Spa': <Waves className="h-4 w-4" />,
  'Hair Colour': <Droplet className="h-4 w-4" />,
  Facial: <Sparkles className="h-4 w-4" />,
  'Hair Care': <Scissors className="h-4 w-4" />,
};

export const SalonDetailPage: React.FC<Props> = ({ salon, nearbySalons, queue, barbers, selectedService, setSelectedService, selectedServiceIds, setSelectedServiceIds, onBack, onJoin, onReserve, userEntry }) => {
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(false);
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
  const waitLabel = waitMinutes > 0 ? `${waitMinutes} min` : 'Ready now';
  const readyState = getQueueReadyState(waiting.length, availableBarbers);
  const primaryCtaLabel = queueCtaLabel(readyState);
  const categories = useMemo(() => Array.from(new Set(profile.services.map((service) => serviceCategory(service.name)))), [profile.services]);
  const branches = nearbySalons.filter((item) => item.id !== salon.id && salon.brandKey && item.brandKey === salon.brandKey);

  // Every screen switch reuses the same scroll container (see CustomerApp),
  // so without this the salon page can open mid-scroll from wherever the
  // previous screen left off. Snap this page's own root to the top too, in
  // case it ever hosts its own scroll (e.g. a taller viewport).
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Floating live capsule appears once the main live card has scrolled out
  // of view, so it always reads as a condensed continuation of that card.
  const liveCardSentinelRef = useRef<HTMLDivElement>(null);
  const [showCapsule, setShowCapsule] = useState(false);
  useEffect(() => {
    const node = liveCardSentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setShowCapsule(!entry.isIntersecting), { threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
    <div ref={rootRef} id="customer-salon-screen" className="relative min-h-full overflow-y-auto bg-[#F5F7F6] pb-[calc(8.5rem+env(safe-area-inset-bottom))] text-[#17201F] animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out">
      <section className="relative min-h-[270px] overflow-hidden bg-[#173B38] text-white shadow-[0_16px_36px_-20px_rgba(6,30,27,0.75)]">
        {salon.coverImageUrl ? <img src={salon.coverImageUrl} alt={`${salon.name} interior`} className="absolute inset-0 h-full w-full object-cover opacity-80" /> : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_22%,#4A7C76_0,transparent_38%),linear-gradient(145deg,#102B28,#224C47_58%,#C3A66A)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/5 to-[#0B211F]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#F5F7F6] to-transparent" />
        <div className="relative z-10 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button onClick={onBack} id="back-to-salons-btn" aria-label="Back to nearby salons" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)] backdrop-blur-md"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex gap-2">
            <button onClick={() => setSaved((value) => !value)} aria-label={saved ? 'Remove saved salon' : 'Save salon'} className={`flex h-10 w-10 items-center justify-center rounded-full shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)] backdrop-blur-md ${saved ? 'bg-white text-[#0F766E]' : 'bg-black/35 text-white'}`}><Bookmark className={`h-[18px] w-[18px] ${saved ? 'fill-current' : ''}`} /></button>
            <button onClick={shareSalon} aria-label="Share salon" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white shadow-[0_4px_14px_-4px_rgba(0,0,0,0.5)] backdrop-blur-md"><Share2 className="h-[18px] w-[18px]" /></button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5">
          <div className="flex items-end gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/80 bg-[#E3F1EF] text-[#0F766E] shadow-xl">
              {salon.logoImageUrl ? <img src={salon.logoImageUrl} alt={`${salon.name} logo`} className="h-full w-full object-cover" /> : <Scissors className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-1.5">
                {salon.isOpen ? (
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span className="absolute h-2 w-2 animate-[status-dot-ring_2.4s_ease-out_infinite] rounded-full bg-[#5EE0B4]" aria-hidden="true" />
                    <span className="relative h-2 w-2 animate-[status-dot-pulse_2.4s_ease-in-out_infinite] rounded-full bg-[#5EE0B4] shadow-[0_0_8px_1px_rgba(94,224,180,0.75)]" />
                  </span>
                ) : (
                  <span className="h-2 w-2 rounded-full bg-[#E58C82]" />
                )}
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{salon.isOpen ? 'Open now' : 'Closed'}</span>
              </div>
              <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere]">{salon.name}</h1>
              <p className="mt-1 text-xs font-medium text-white/75">{salon.category || 'Salon & grooming'} · {salon.distanceKm} km away</p>
            </div>
          </div>
          <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-white/75"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{salon.address}</a>
        </div>
      </section>

      <div className="relative z-10 -mt-2 space-y-5 rounded-t-[26px] bg-[#F5F7F6] px-4 py-4 shadow-[0_-12px_24px_-20px_rgba(6,30,27,0.35)]">
        <section className="grid grid-cols-4 gap-2">
          <QuickAction icon={<CalendarDays />} label="Schedule" onClick={() => setHoursOpen(true)} />
          <QuickAction icon={<Navigation />} label="Directions" href={directionsUrl} />
          {salon.phoneNumber ? <QuickAction icon={<Phone />} label="Call" href={`tel:${salon.phoneNumber}`} /> : <QuickAction icon={<Store />} label="Branches" disabled={branches.length === 0} secondary={branches.length ? `${branches.length} nearby` : undefined} />}
          <QuickAction icon={<Check />} label={visited ? 'Visited' : 'Been here'} onClick={() => setVisited((value) => !value)} active={visited} />
        </section>

        <section>
          <LiveQueueCard
            waitLabel={waitLabel}
            waitDeltaLabel={waitTrend === 'down' ? '↓ moving' : waitTrend === 'up' ? '↑ busier' : undefined}
            peopleAhead={waiting.length}
            peopleAheadTrend={aheadTrend}
            readyChairs={availableBarbers}
            totalChairs={activeBarbers}
          />
          <div ref={liveCardSentinelRef} aria-hidden="true" />
          <button onClick={onReserve} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-[#C9E2DE]/80 bg-gradient-to-r from-[#F4FAF9] to-[#E9F5F3] px-4 py-2.5 text-left shadow-[0_6px_16px_-10px_rgba(15,118,110,0.4)]">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F766E] to-[#0B5C56] text-white shadow-[0_4px_10px_-3px_rgba(15,118,110,0.6)]">
              <CalendarDays className="h-4 w-4" />
              <Lock className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#E9C46A] p-[3px] text-[#3A2E0A] shadow" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold tracking-[-0.01em] text-[#17453F]">Reserve your slot</span>
              <span className="block text-[10.5px] font-medium text-[#5D746F]">Arrive when it matters</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[#5D746F]" />
          </button>
        </section>

        <section className="relative aspect-[2.4/1] min-h-[128px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#173E3A] to-[#3F746D] p-5 text-white">
          <div className="max-w-[72%]"><span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider"><Sparkles className="h-3 w-3" />At {salon.name}</span><h2 className="mt-3 text-lg font-bold leading-tight">Your next grooming visit, without the waiting room.</h2></div>
          <Scissors className="absolute -bottom-4 -right-2 h-28 w-28 rotate-[-12deg] text-white/10" />
        </section>

        {!!profile.offers.length && <section><SectionTitle eyebrow="Savings" title="Available offers" /><div className="flex snap-x gap-3 overflow-x-auto pb-1">{profile.offers.map((offer) => <div key={offer.id} className="min-w-[260px] snap-start rounded-2xl border border-[#E0E6E5] bg-white p-4"><p className="text-xs font-bold text-[#0F766E]">{offer.discount}</p><h3 className="mt-1 text-sm font-bold">{offer.title}</h3>{offer.minimumBill && <p className="mt-2 text-[10px] text-[#778481]">Minimum bill {offer.minimumBill}</p>}<p className="mt-1 text-[10px] text-[#778481]">{offer.validity}</p></div>)}</div></section>}

        <section><SectionTitle eyebrow="Explore" title="Services" /><div className="flex gap-2 overflow-x-auto pb-1">{categories.map((category) => <a key={category} href="#service-menu" className="flex min-w-[104px] flex-col items-center rounded-2xl border border-[#E0E7E6] bg-white px-3 py-4 text-center shadow-[0_8px_18px_-14px_rgba(15,60,54,0.5)] transition active:scale-[0.97]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#E7F3F1] to-[#CFEAE5] text-[#0F766E] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_3px_8px_-4px_rgba(15,118,110,0.5)]">{CATEGORY_ICONS[category] || <Scissors className="h-4 w-4" />}</span><span className="mt-2 text-[11px] font-bold">{category}</span></a>)}</div></section>

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
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{service.name}</span>{service.description && <span className="mt-1 block text-[10px] leading-4 text-[#788582]">{service.description}</span>}<span className="mt-2 block text-[10px] font-semibold text-[#60716E]">{service.durationMin} min</span></span>
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

        {!!branches.length && <section><SectionTitle eyebrow="More nearby" title="Other branches near you" /><div className="space-y-2">{branches.map((branch) => <div key={branch.id} className="rounded-2xl border border-[#E0E7E6] bg-white p-4"><p className="text-sm font-bold">{branch.name}</p><p className="mt-1 text-[10px] text-[#788582]">{branch.distanceKm} km · {branch.liveWaitMinutes ? `${branch.liveWaitMinutes} min wait` : 'No wait'}</p></div>)}</div></section>}
      </div>

      {/* Floating live capsule: a condensed morph of the main live card, surfacing once it scrolls out of view. */}
      <div
        className={`fixed inset-x-0 top-[max(.75rem,env(safe-area-inset-top))] z-30 flex justify-center px-4 transition-all duration-300 ease-out ${showCapsule ? 'translate-y-0 opacity-100' : '-translate-y-3 pointer-events-none opacity-0'}`}
        aria-hidden={!showCapsule}
      >
        <div className="flex w-full max-w-xl items-center gap-3 rounded-full bg-gradient-to-r from-[#0B4A44] via-[#0F6B62] to-[#0F766E] px-4 py-2.5 text-white shadow-[0_14px_30px_-12px_rgba(6,44,40,0.65)] ring-1 ring-white/10 backdrop-blur-md">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EF4444]/90 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Live
          </span>
          <CapsuleStat icon={<Clock3 className="h-3 w-3" />} value={readyState === 'normal' ? waitLabel : readyState === 'yourTurnNow' ? '#1' : 'Now'} label="Time" />
          <CapsuleStat value={String(waiting.length)} label="Position" />
          <CapsuleStat value={String(availableBarbers)} label="Chairs" />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#DDE5E3] bg-white/95 px-3 pt-2.5 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgba(6,30,27,0.3)] backdrop-blur-md">
        {!userEntry && totals.count > 0 && (
          <div className="mx-auto mb-2 flex max-w-xl items-center justify-between text-[11px] font-semibold text-[#4C5A58]">
            <span>{totals.count} {totals.count === 1 ? 'service' : 'services'} selected · {totals.totalDurationMin} min</span>
            <span className="text-sm font-bold text-[#17201F]">₹{totals.totalPriceInr}</span>
          </div>
        )}
        <div className="mx-auto grid max-w-xl grid-cols-[1fr_auto] gap-2">
          <button id="join-live-queue-btn" onClick={onJoin} disabled={!userEntry && totals.count === 0} className="min-h-13 min-w-0 rounded-xl bg-[#0F766E] px-3 text-xs font-bold text-white shadow-[0_6px_16px_-8px_rgba(15,118,110,0.7)] sm:text-sm disabled:opacity-50">{userEntry ? 'View live queue' : `${primaryCtaLabel} · ${selectedService}`}</button>
          <button onClick={() => setComingSoonOpen(true)} aria-label="Reserve a future slot — coming soon" className="relative flex min-h-13 items-center justify-center rounded-xl border border-[#BFD6D2] bg-white px-4 text-[#0F766E]">
            <CalendarDays className="h-[18px] w-[18px]" />
            <Lock className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#E9C46A] p-[3px] text-[#3A2E0A] shadow" />
          </button>
        </div>
      </div>
      {comingSoonOpen && <ComingSoonSheet salonName={salon.name} onClose={() => setComingSoonOpen(false)} />}
      {hoursOpen && <HoursSheet salon={salon} onClose={() => setHoursOpen(false)} />}
    </div>
  );
};

const CapsuleStat: React.FC<{ icon?: React.ReactElement; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center leading-tight">
    <span className="flex items-center gap-1 text-[12px] font-bold tabular-nums">{icon}{value}</span>
    <span className="text-[7px] font-bold uppercase tracking-[0.14em] text-white/60">{label}</span>
  </div>
);

const QuickAction: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; href?: string; onClick?: () => void; active?: boolean; disabled?: boolean }> = ({ icon, label, secondary, href, onClick, active, disabled }) => {
  const content = <><span className={`flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4 ${active ? 'bg-gradient-to-br from-[#B9E4DC] to-[#8FD3C6] text-[#075E55] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]' : 'bg-gradient-to-br from-white/15 to-white/5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-white/10'}`}>{icon}</span><span className="mt-2 text-[10px] font-bold leading-tight">{label}</span>{secondary && <span className="mt-0.5 line-clamp-1 text-[8px] text-white/55">{secondary}</span>}</>;
  const classes = `flex min-h-[92px] flex-col items-center rounded-2xl bg-[#1D3734] px-1.5 py-2.5 text-center text-white shadow-[0_8px_18px_-14px_rgba(0,0,0,0.6)] transition active:scale-[0.97] ${disabled ? 'opacity-45' : ''}`;
  return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={classes}>{content}</a> : <button type="button" onClick={onClick} disabled={disabled} className={classes}>{content}</button>;
};

const SectionTitle: React.FC<{ eyebrow: string; title: string; secondary?: string }> = ({ eyebrow, title, secondary }) => <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#73827F]">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em]">{title}</h2></div>{secondary && <span className="text-[10px] font-semibold text-[#0F766E]">{secondary}</span>}</div>;

const HoursSheet: React.FC<{ salon: Salon; onClose: () => void }> = ({ salon, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end bg-black/55" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Salon schedule" className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0]" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">Schedule</p>
          <h2 className="mt-1 text-xl font-bold">{salon.name}</h2>
        </div>
        <button onClick={onClose} aria-label="Close schedule" className="flex h-9 w-9 items-center justify-center rounded-full bg-white"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#DCE5E3] bg-white p-3.5">
        <span className={`flex h-2.5 w-2.5 shrink-0 rounded-full ${salon.isOpen ? 'bg-[#5EE0B4]' : 'bg-[#E58C82]'}`} />
        <div>
          <p className="text-xs font-bold">{salon.isOpen ? 'Open now' : 'Closed now'}</p>
          <p className="mt-0.5 text-[11px] text-[#647370]">{salon.openingHours}</p>
        </div>
      </div>
    </section>
  </div>
);

const COMING_SOON_PERKS = [
  'Lock in an arrival window so you never lose your place in line',
  'Get an SMS the moment your chair is ready',
  'Reschedule or cancel free, right up to your slot',
];

const ComingSoonSheet: React.FC<{ salonName: string; onClose: () => void }> = ({ salonName, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-end bg-black/55" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Advance reservations coming soon" className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0]" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#0B5C56] text-white shadow-[0_6px_16px_-6px_rgba(15,118,110,0.6)]">
            <CalendarDays className="h-5 w-5" />
            <Lock className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#E9C46A] p-[3px] text-[#3A2E0A] shadow" />
          </span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">Coming soon</p>
            <h2 className="mt-0.5 text-lg font-bold leading-tight">Reserve at {salonName}</h2>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"><X className="h-4 w-4" /></button>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#647370]">We're polishing advance reservations for this dock shortcut. Here's what it'll unlock once it's live:</p>
      <ul className="mt-3 space-y-2.5">
        {COMING_SOON_PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2.5 rounded-xl border border-[#DCE5E3] bg-white p-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E7F3F1] text-[#0F766E]"><Check className="h-3 w-3" /></span>
            <span className="text-[11px] leading-5 text-[#3B4644]">{perk}</span>
          </li>
        ))}
      </ul>
      <button onClick={onClose} className="mt-4 h-12 w-full rounded-xl bg-[#0F766E] text-sm font-bold text-white">Got it</button>
    </section>
  </div>
);
