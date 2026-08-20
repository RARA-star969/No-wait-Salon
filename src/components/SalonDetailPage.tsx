import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  ExternalLink,
  Lock,
  MapPin,
  Navigation,
  Plus,
  Scissors,
  Share2,
  Sparkles,
  Store,
  Timer,
  Wifi,
  Wind,
  X,
} from 'lucide-react';
import type { Barber, NearbySalon, QueueItem, Salon } from '../types';
import { toSalonProfile } from '../shared/salonProfile';
import { formatDuration } from '../shared/duration';
import { LiveQueueCard, type QueueTrend } from './LiveQueueCard';
import { LiveQueueCapsule } from './LiveQueueCapsule';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';
import { SalonQuickSheets, type SalonSheetKind } from './SalonQuickSheets';
import { PriceBreakdownSheet } from './PriceBreakdownSheet';

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

/** First ~4 words of a description, so the card stays a fixed height until the customer opts in to read more. */
function clampWords(text: string, count = 4): { clipped: string; truncated: boolean } {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= count) return { clipped: text, truncated: false };
  return { clipped: `${words.slice(0, count).join(' ')}…`, truncated: true };
}

/** Best-effort haptic tick. Silently no-ops where unsupported (iOS Safari, older WebViews). */
function tick(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

export const SalonDetailPage: React.FC<Props> = ({ salon, nearbySalons, queue, barbers, selectedService, setSelectedService, selectedServiceIds, setSelectedServiceIds, onBack, onJoin, onReserve, userEntry }) => {
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [payBillOpen, setPayBillOpen] = useState(false);
  const [priceSheetOpen, setPriceSheetOpen] = useState(false);
  const [sheetKind, setSheetKind] = useState<SalonSheetKind>(null);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('All');
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [dockPulse, setDockPulse] = useState(false);
  const [flights, setFlights] = useState<{ id: string; x: number; y: number; dx: number; dy: number }[]>([]);

  const scrollRootRef = useRef<HTMLDivElement>(null);
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const dockAnchorRef = useRef<HTMLDivElement>(null);
  const [capsuleVisible, setCapsuleVisible] = useState(false);

  const waiting = queue.filter((item) => ['Waiting', 'Called'].includes(item.status));
  const activeBarbers = barbers.filter((barber) => barber.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((barber) => barber.status === 'available').length;
  const waitMinutes = activeBarbers ? Math.ceil(waiting.length * 15 / activeBarbers) : 0;
  // Shared with the public web page so the same salon never reads differently.
  const profile = useMemo(
    () => toSalonProfile(salon, { liveWaitMinutes: waitMinutes, waitingCustomers: waiting.length }),
    [salon, waitMinutes, waiting.length],
  );
  const timeValue = waitMinutes > 0 ? formatDuration(waitMinutes) : 'Ready';
  const categories = useMemo(() => Array.from(new Set(profile.services.map((service) => serviceCategory(service.name)))), [profile.services]);
  const branches = nearbySalons.filter((item) => item.id !== salon.id && salon.brandKey && item.brandKey === salon.brandKey);
  const selectedServices = useMemo(() => profile.services.filter((service) => selectedServiceIds.includes(service.id)), [profile.services, selectedServiceIds]);

  // Default to whatever the top-level app already had selected, so the two
  // pickers (legacy single-service string, new multi-select ids) never fight.
  useEffect(() => {
    if (selectedServiceIds.length || !profile.services.length) return;
    const match = profile.services.find((service) => service.name === selectedService) || profile.services[0];
    if (match) setSelectedServiceIds([match.id]);
  }, [profile.services, selectedService, selectedServiceIds.length, setSelectedServiceIds]);

  const filteredServices = useMemo(() => filterServices(profile.services, serviceFilter), [profile.services, serviceFilter]);
  const totals = useMemo(() => selectionTotals(profile.services, selectedServiceIds), [profile.services, selectedServiceIds]);

  // The live capsule takes over once the hero's live card scrolls out of view.
  useEffect(() => {
    const root = scrollRootRef.current;
    const target = heroSentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(([entry]) => setCapsuleVisible(!entry.isIntersecting), {
      root,
      rootMargin: '-64px 0px 0px 0px',
      threshold: 0,
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  // Trend arrows compare against the previous render's numbers, purely a
  // client-side visual cue layered on top of the server-authoritative queue.
  const previousStats = useRef({ waitMinutes, waitingCount: waiting.length });
  const [aheadTrend, setAheadTrend] = useState<QueueTrend>('steady');
  useEffect(() => {
    const prev = previousStats.current;
    setAheadTrend(waiting.length < prev.waitingCount ? 'down' : waiting.length > prev.waitingCount ? 'up' : 'steady');
    previousStats.current = { waitMinutes, waitingCount: waiting.length };
  }, [waitMinutes, waiting.length]);

  const directionsUrl = `https://maps.google.com/?q=${salon.latitude},${salon.longitude}`;
  const shareSalon = async () => {
    const shareData = { title: salon.name, text: `${salon.name}\n${salon.address}`, url: directionsUrl };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`).catch(() => undefined);
  };

  const toggleDescription = (id: string) => {
    setExpandedDescriptions((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addService = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const wasSelected = selectedServiceIds.includes(id);
    const next = wasSelected ? selectedServiceIds.filter((value) => value !== id) : [...selectedServiceIds, id];
    setSelectedServiceIds(next);
    const names = profile.services.filter((service) => next.includes(service.id)).map((service) => service.name);
    setSelectedService(names.join(' + ') || profile.services[0]?.name || '');

    if (wasSelected) return;
    tick(14);
    const dockRect = dockAnchorRef.current?.getBoundingClientRect();
    if (dockRect) {
      const originX = event.clientX;
      const originY = event.clientY;
      const dx = dockRect.left + dockRect.width / 2 - originX;
      const dy = dockRect.top - originY;
      const flightId = `${id}-${Date.now()}`;
      setFlights((current) => [...current, { id: flightId, x: originX, y: originY, dx, dy }]);
      setTimeout(() => setFlights((current) => current.filter((flight) => flight.id !== flightId)), 500);
    }
    setDockPulse(true);
    setTimeout(() => setDockPulse(false), 440);
  };

  return (
    <div id="customer-salon-screen" ref={scrollRootRef} className="relative min-h-full overflow-y-auto bg-[#F5F7F6] pb-[calc(9rem+env(safe-area-inset-bottom))] text-[#17201F] animate-in fade-in duration-200">
      <LiveQueueCapsule
        visible={capsuleVisible}
        waitLabel={timeValue}
        peopleAhead={waiting.length}
        readyChairs={availableBarbers}
        totalChairs={activeBarbers}
        live={salon.isOpen}
      />

      {/* Decorative flight dots: a service card's "Add" tap arcs toward the dock. */}
      {flights.map((flight) => (
        <span
          key={flight.id}
          aria-hidden="true"
          className="pointer-events-none fixed z-[70] h-2.5 w-2.5 rounded-full bg-[#0F766E] [animation:add-fly_480ms_ease-in_forwards]"
          style={{ left: flight.x, top: flight.y, ['--fly-x' as string]: `${flight.dx}px`, ['--fly-y' as string]: `${flight.dy}px` }}
        />
      ))}

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
            id="salon-address-row"
            onClick={() => setSheetKind('address')}
            className="mt-3 flex w-full items-start gap-1.5 rounded-lg text-left text-[11px] leading-4 text-white/75 transition active:opacity-70"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 underline decoration-white/30 underline-offset-2">{salon.address}</span>
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50" />
          </button>
        </div>
      </section>

      <div className="space-y-5 px-4 py-4">
        <section className="grid grid-cols-4 gap-2">
          <QuickAction icon={<Clock3 />} label={salon.isOpen ? 'Open' : 'Closed'} secondary={salon.openingHours.split('·')[1]?.trim()} onClick={() => setSheetKind('open')} />
          <QuickAction icon={<Navigation />} label="Directions" onClick={() => setSheetKind('directions')} />
          <QuickAction icon={<Store />} label="Branches" onClick={() => setSheetKind('branches')} secondary={branches.length ? `${branches.length} nearby` : undefined} />
          <QuickAction icon={<Check />} label={visited ? 'Visited' : 'Been here'} onClick={() => setSheetKind('been-here')} active={visited} />
        </section>

        <section>
          <LiveQueueCard
            waitLabel={timeValue}
            peopleAhead={waiting.length}
            peopleAheadTrend={aheadTrend}
            readyChairs={availableBarbers}
            totalChairs={activeBarbers}
            live={salon.isOpen}
          />
          <div ref={heroSentinelRef} aria-hidden="true" />

          <button
            onClick={onReserve}
            className="group relative mt-2.5 flex w-full items-center justify-between overflow-hidden rounded-2xl bg-[linear-gradient(120deg,#8A6215_0%,#E9C468_28%,#FCEBB0_46%,#D9A93B_62%,#8A6215_100%)] px-4 py-3.5 shadow-[0_10px_24px_-12px_rgba(138,98,21,0.55),inset_0_1px_0_rgba(255,255,255,0.5)]"
          >
            <span className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-black/15">
                <CalendarDays className="h-4 w-4 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]" />
              </span>
              <span className="text-[13.5px] font-extrabold tracking-[-0.01em] text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]">
                Reserve your slot
              </span>
            </span>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] transition-transform group-active:translate-x-0.5 animate-[cta-nudge_2.6s_ease-in-out_infinite]" />
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
              const expanded = expandedDescriptions.has(service.id);
              const { clipped, truncated } = clampWords(service.description || '');
              return (
                <div key={service.id} id={`service-opt-${service.id}`} className={`rounded-2xl border bg-white p-4 transition ${active ? 'border-[#4F9D95] ring-1 ring-[#4F9D95] bg-[#F1FAF9]' : 'border-[#E0E7E6]'}`}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{service.name}</span>
                      {service.description && (
                        <button
                          type="button"
                          onClick={() => truncated && toggleDescription(service.id)}
                          className="mt-1 block text-left text-[10px] leading-4 text-[#788582]"
                        >
                          {expanded ? service.description : clipped}
                          {truncated && <span className="ml-1 font-bold text-[#0F766E]">{expanded ? 'less' : 'more'}</span>}
                        </button>
                      )}
                      <span className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-[#60716E]">
                        <Timer className="h-3 w-3 text-[#0F766E]" /> Session time : {formatDuration(service.durationMin)}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="block text-sm font-bold">₹{service.priceInr}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => addService(service.id, event)}
                    aria-pressed={active}
                    className={`mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition active:scale-[0.98] ${
                      active ? 'bg-[#0F766E] text-white' : 'border border-[#0F766E]/35 text-[#0F766E]'
                    }`}
                  >
                    {active ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Added
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </>
                    )}
                  </button>
                </div>
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

      {/* Sticky action dock: elevated glass panel, alive when a service is added. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/40 bg-white/85 px-3 pt-2.5 pb-[max(.75rem,env(safe-area-inset-bottom))] shadow-[0_-14px_36px_-18px_rgba(6,26,24,0.35)] backdrop-blur-2xl transition-transform duration-300 ${
          dockPulse ? '[animation:dock-bounce_420ms_ease-out]' : ''
        }`}
      >
        <div ref={dockAnchorRef} className="mx-auto max-w-xl">
          {!userEntry && totals.count > 0 && (
            <button
              type="button"
              onClick={() => setPriceSheetOpen(true)}
              className="mb-2 flex w-full items-center justify-between rounded-xl px-1 py-0.5 text-left"
            >
              <span className="text-[11px] font-semibold text-[#4C5A58]">
                Session time: approx. {formatDuration(totals.totalDurationMin)}
              </span>
              <span className="flex items-center gap-1 text-sm font-bold text-[#17201F] underline decoration-[#0F766E]/30 underline-offset-2">
                ₹{totals.totalPriceInr}
              </span>
            </button>
          )}
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <button id="join-live-queue-btn" onClick={onJoin} disabled={!userEntry && totals.count === 0} className="min-h-13 min-w-0 rounded-xl bg-[#0F766E] px-3 text-xs font-bold text-white sm:text-sm disabled:opacity-50">
              {userEntry ? 'View live queue' : 'Join Queue'}
            </button>
            <button
              onClick={() => setPayBillOpen(true)}
              className="relative min-h-13 rounded-xl bg-[linear-gradient(120deg,#8A6215_0%,#E9C468_28%,#FCEBB0_46%,#D9A93B_62%,#8A6215_100%)] px-4 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
            >
              <span className="[text-shadow:0_1px_1px_rgba(0,0,0,0.25)]">Pay Bill</span>
              <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-[#8A6215] ring-2 ring-[#F5F7F6]">
                <Lock className="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <PriceBreakdownSheet open={priceSheetOpen} services={selectedServices} onClose={() => setPriceSheetOpen(false)} />

      <SalonQuickSheets
        kind={sheetKind}
        onClose={() => setSheetKind(null)}
        salon={salon}
        address={salon.address}
        directionsUrl={directionsUrl}
        openingHours={profile.openingHours}
        branches={branches}
        visited={visited}
        onToggleVisited={() => setVisited((value) => !value)}
      />

      {payBillOpen && <PayBillSheet salonName={salon.name} onClose={() => setPayBillOpen(false)} />}
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; href?: string; onClick?: () => void; active?: boolean; disabled?: boolean }> = ({ icon, label, secondary, href, onClick, active, disabled }) => {
  const content = <><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? 'bg-[#B9E4DC] text-[#075E55]' : 'bg-white/10 text-white'} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span><span className="mt-2 text-[10px] font-bold leading-tight">{label}</span>{secondary && <span className="mt-0.5 line-clamp-1 text-[8px] text-white/55">{secondary}</span>}</>;
  const classes = `flex min-h-[92px] flex-col items-center rounded-2xl bg-[#1D3734] px-1.5 py-2.5 text-center text-white transition active:scale-[0.97] ${disabled ? 'opacity-45' : ''}`;
  return href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className={classes}>{content}</a> : <button type="button" onClick={onClick} disabled={disabled} className={classes}>{content}</button>;
};

const SectionTitle: React.FC<{ eyebrow: string; title: string; secondary?: string }> = ({ eyebrow, title, secondary }) => <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#73827F]">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em]">{title}</h2></div>{secondary && <span className="text-[10px] font-semibold text-[#0F766E]">{secondary}</span>}</div>;

const PayBillSheet: React.FC<{ salonName: string; onClose: () => void }> = ({ salonName, onClose }) => {
  const [amount, setAmount] = useState('');
  return <div className="fixed inset-0 z-50 flex items-end bg-black/55" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label="Pay salon bill" className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"><div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0]" /><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">Pay Bill</p><h2 className="mt-1 text-xl font-bold">{salonName}</h2></div><button onClick={onClose} aria-label="Close Pay Bill" className="flex h-9 w-9 items-center justify-center rounded-full bg-white"><X className="h-4 w-4" /></button></div><label className="mt-5 block text-xs font-semibold">Bill amount</label><div className="mt-2 flex h-14 items-center rounded-xl border border-[#D8E2E0] bg-white px-4"><span className="text-lg font-bold">₹</span><input value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, '').slice(0, 7))} inputMode="numeric" placeholder="0" className="h-full min-w-0 flex-1 bg-transparent px-2 text-xl font-bold outline-none" /></div><div className="mt-4 rounded-xl border border-[#DCE5E3] bg-white p-3 text-[11px] leading-5 text-[#647370]">Secure payment provider is not connected yet. No payment will be processed or marked successful from this preview.</div><button disabled className="mt-4 h-12 w-full rounded-xl bg-[#0F766E] text-sm font-bold text-white opacity-45">Continue to secure payment</button></section></div>;
};
