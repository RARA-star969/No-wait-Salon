import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bookmark, Brush, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, Clock, Clock3, CreditCard, Dumbbell, ExternalLink, Flame, Info, Lock, MapPin, Navigation, Palette, PhoneCall, Plus, ScanFace, Scissors, Share2, Sparkles, Store, Tag, Timer, Waves, Wifi, Wind, X, Zap, Activity } from 'lucide-react';
import type { Barber, NearbySalon, QueueItem, Salon, ServiceItem } from '../types';
import { toSalonProfile } from '../shared/salonProfile';
import { liveQueuePosition } from '../shared/liveQueueDisplayMetrics';
import { evaluateCoupon } from '../shared/couponPricing';
import { LiveQueueCard } from './LiveQueueCard';
import { LiveQueueScoreboard } from './LiveQueueScoreboard';
import { AnimatedSalonName } from './AnimatedSalonName';
import { TimeValue } from './TimeValue';
import { PriceBreakdownSheet } from './PriceBreakdownSheet';
import { filterServices, selectionTotals, SERVICE_FILTERS, type ServiceFilter } from '../shared/serviceSelection';
import { formatDurationLabel } from '../shared/durationFormat';
import { LockedCalendarIcon } from './LockedCalendarIcon';
import { HairCare3DIcon, Beard3DIcon, MassageSpa3DIcon, HairColour3DIcon, Facial3DIcon } from './ExploreService3DIcons';

type Props = {
  salon: Salon;
  nearbySalons: NearbySalon[];
  queue: QueueItem[];
  barbers: Barber[];
  selectedService: string;
  setSelectedService: (service: string) => void;
  selectedServiceIds: string[];
  setSelectedServiceIds: (ids: string[]) => void;
  appliedOfferId: string | null;
  onApplyOffer: (offerId: string) => void;
  onRemoveOffer: () => void;
  onBack: () => void;
  onJoin: () => void;
  onReserve: () => void;
  userEntry: QueueItem | null;
  isJoinSheetOpen?: boolean;
};

const serviceCategory = (name: string, mainCategoryId?: string) => {
  const value = name.toLocaleLowerCase();
  if (mainCategoryId === 'gym') {
    if (value.includes('strength') || value.includes('pass') || value.includes('day')) return 'Strength';
    if (value.includes('personal') || value.includes('training') || value.includes('coach')) return 'Personal Training';
    if (value.includes('cardio') || value.includes('hiit') || value.includes('zone')) return 'Cardio & HIIT';
    if (value.includes('functional') || value.includes('conditioning')) return 'Functional';
    return 'Fitness & Gym';
  }
  if (value.includes('beard')) return 'Beard';
  if (value.includes('massage') || value.includes('spa')) return 'Massage & Spa';
  if (value.includes('colour')) return 'Hair Colour';
  if (value.includes('facial')) return 'Facial';
  return 'Hair Care';
};

/** One recognizable glyph per Explore/Services category, rather than a
 *  single icon repeated across every card. */
const CATEGORY_ICONS: Record<string, React.ReactElement> = {
  'Hair Care': <HairCare3DIcon className="h-7 w-7" />,
  'Beard': <Beard3DIcon className="h-7 w-7" />,
  'Massage & Spa': <MassageSpa3DIcon className="h-7 w-7" />,
  'Hair Colour': <HairColour3DIcon className="h-7 w-7" />,
  'Facial': <Facial3DIcon className="h-7 w-7" />,
  'Strength': <Dumbbell className="h-6 w-6 text-[#0F766E]" />,
  'Personal Training': <Zap className="h-6 w-6 text-[#0F766E]" />,
  'Cardio & HIIT': <Flame className="h-6 w-6 text-[#0F766E]" />,
  'Functional': <Activity className="h-6 w-6 text-[#0F766E]" />,
  'Fitness & Gym': <Dumbbell className="h-6 w-6 text-[#0F766E]" />,
};

export const SalonDetailPage: React.FC<Props> = ({ salon, nearbySalons, queue, barbers, selectedService, setSelectedService, selectedServiceIds, setSelectedServiceIds, appliedOfferId, onApplyOffer, onRemoveOffer, onBack, onJoin, onReserve, userEntry, isJoinSheetOpen }) => {
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('All');
  const liveQueueSectionRef = useRef<HTMLDivElement>(null);
  const [showScoreboard, setShowScoreboard] = useState(false);
  // Quick-action / address bottom sheets — honest placeholder structures for
  // now (no timings/branch backend wired yet), matching APK45.
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [openHoursSheetOpen, setOpenHoursSheetOpen] = useState(false);
  const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
  const [branchesSheetOpen, setBranchesSheetOpen] = useState(false);
  const [beenHereSheetOpen, setBeenHereSheetOpen] = useState(false);
  // Micro-bounce on the sticky dock whenever the selection count changes.
  const [dockBounce, setDockBounce] = useState(false);
  const previousServiceCount = useRef(0);

  const isGym = (salon.mainCategoryId || '').toLowerCase() === 'gym';
  const waiting = queue.filter((item) => ['Waiting', 'Called'].includes(item.status));
  const activeBarbers = barbers.filter((barber) => barber.status !== 'unavailable').length;
  const availableBarbers = barbers.filter((barber) => barber.status === 'available').length;
  const waitMinutes = activeBarbers ? Math.ceil((waiting.length * 15) / activeBarbers) : 0;
  const waitLabel = waitMinutes > 0 ? `${waitMinutes} min` : 'Ready now';
  // Shared with the public web page so the same salon never reads differently.
  const profile = useMemo(
    () => toSalonProfile(salon, { liveWaitMinutes: waitMinutes, waitingCustomers: waiting.length }),
    [salon, waitMinutes, waiting.length],
  );
  const categories = useMemo(() => Array.from(new Set(profile.services.map((service) => serviceCategory(service.name, salon.mainCategoryId)))), [profile.services, salon.mainCategoryId]);
  const branches = nearbySalons.filter((item) => item.id !== salon.id && salon.brandKey && item.brandKey === salon.brandKey);

  const filteredServices = useMemo(() => filterServices(profile.services, serviceFilter), [profile.services, serviceFilter]);
  const totals = useMemo(() => selectionTotals(profile.services, selectedServiceIds), [profile.services, selectedServiceIds]);
  const selectedServices = useMemo(() => profile.services.filter((service) => selectedServiceIds.includes(service.id)), [profile.services, selectedServiceIds]);
  const appliedOffer = profile.offers.find((offer) => offer.id === appliedOfferId);
  const appliedResult = appliedOffer ? evaluateCoupon(appliedOffer, { subtotalInr: totals.totalPriceInr, serviceIds: selectedServiceIds }) : undefined;
  const dockDiscountInr = appliedResult?.eligible ? appliedResult.discountInr : 0;
  const dockFinalTotalInr = Math.max(0, totals.totalPriceInr - dockDiscountInr);

  // No service starts selected — the customer must explicitly add one, and
  // genuinely can have zero selected (Join Queue stays enabled either way).
  const toggleService = (id: string) => {
    let wasAdding = false;
    setSelectedServiceIds((prev) => {
      wasAdding = !prev.includes(id);
      const next = wasAdding ? [...prev, id] : prev.filter((value) => value !== id);
      const names = profile.services.filter((service) => next.includes(service.id)).map((service) => service.name);
      if (names.length) setSelectedService(names.join(' + '));
      return next;
    });
    if (wasAdding) {
      try { navigator.vibrate?.(15); } catch { /* unsupported or blocked */ }
    }
  };

  useEffect(() => {
    if (totals.count > previousServiceCount.current) {
      setDockBounce(true);
      const timer = setTimeout(() => setDockBounce(false), 420);
      previousServiceCount.current = totals.count;
      return () => clearTimeout(timer);
    }
    previousServiceCount.current = totals.count;
  }, [totals.count]);

  // The signature sticky scoreboard: appears the moment the main live-queue
  // card scrolls out of view, and morphs back away the moment it returns.
  useEffect(() => {
    const node = liveQueueSectionRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowScoreboard(!entry.isIntersecting),
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isScoreboardActive = !isGym && (showScoreboard || Boolean(isJoinSheetOpen));

  // Remounts the capsule's inner element each time it becomes visible, so
  // its one-shot "lift and settle" animation replays on every re-entry.
  const [capsuleEnterKey, setCapsuleEnterKey] = useState(0);
  useEffect(() => {
    if (isScoreboardActive) setCapsuleEnterKey((key) => key + 1);
  }, [isScoreboardActive]);

  const scrollToLiveQueue = () => {
    if (isJoinSheetOpen) return;
    liveQueueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Same Position field the full card shows — one shared derivation so the
  // capsule and the card can never disagree, and a change pulses identically.
  const position = liveQueuePosition(waiting.length, availableBarbers);
  const scoreboardMetrics = [
    { key: 'time', label: 'Time', value: waitMinutes > 0 ? <TimeValue label={waitLabel} /> : 'Now' },
    { key: 'position', label: 'Position', value: position.positionLabel },
    { key: 'chairs', label: 'Chairs', value: availableBarbers },
  ];

  const directionsUrl = `https://maps.google.com/?q=${salon.latitude},${salon.longitude}`;
  const shareSalon = async () => {
    const shareData = { title: salon.name, text: `${salon.name}\n${salon.address}`, url: directionsUrl };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`).catch(() => undefined);
  };

  return (
    <div id="customer-salon-screen" className="relative min-h-full overflow-y-auto bg-[#F5F7F6] pb-[calc(8.5rem+env(safe-area-inset-bottom))] text-[#17201F] animate-in fade-in duration-200">
      {!isGym && (
        <div
          aria-hidden={!isScoreboardActive}
          className={`fixed inset-x-0 top-0 z-[95] flex justify-center px-4 pt-[max(1.4rem,calc(env(safe-area-inset-top)+0.6rem))] transition-all duration-300 ease-out motion-reduce:transition-none ${
            isScoreboardActive ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-3 opacity-0'
          }`}
        >
          <div key={capsuleEnterKey} className="capsule-melt-in">
            <LiveQueueScoreboard metrics={scoreboardMetrics} onTap={scrollToLiveQueue} />
          </div>
        </div>
      )}

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
              {salon.logoImageUrl ? <img src={salon.logoImageUrl} alt={`${salon.name} logo`} className="h-full w-full object-cover" /> : isGym ? <Dumbbell className="h-7 w-7" /> : <Scissors className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${salon.isOpen ? 'bg-[#5EE0B4] open-dot-bounce' : 'bg-[#E58C82]'}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{salon.isOpen ? 'Open now' : 'Closed'}</span>
              </div>
              <AnimatedSalonName name={salon.name} className="mt-1 text-[26px] font-bold leading-tight tracking-[-0.04em] [overflow-wrap:anywhere]" />
              <p className="mt-1 text-xs font-medium text-white/75">{salon.category || (isGym ? 'Fitness & Strength Gym' : 'Salon & grooming')} · {salon.distanceKm} km away</p>
            </div>
          </div>
          <button
            type="button"
            id="salon-address-row"
            onClick={() => setAddressSheetOpen(true)}
            aria-label="View salon address and contact"
            className="mt-3 flex w-full items-start gap-1.5 text-left text-[11px] leading-4 text-white/75 underline decoration-white/25 underline-offset-2 transition active:text-white"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{salon.address}</span>
          </button>
        </div>
      </section>

      <div className="space-y-5 px-4 py-4">
        <section className="grid grid-cols-4 gap-2.5">
          <QuickAction icon={<CalendarDays />} label="Schedule" onClick={() => setOpenHoursSheetOpen(true)} />
          <QuickAction icon={<Navigation />} label="Directions" onClick={() => setDirectionsSheetOpen(true)} />
          <QuickAction icon={<Store />} label="Branches" secondary={branches.length ? `${branches.length} nearby` : undefined} onClick={() => setBranchesSheetOpen(true)} />
          <QuickAction icon={<Check />} label={visited ? 'Visited' : 'Been here'} onClick={() => setBeenHereSheetOpen(true)} active={visited} />
        </section>

        {!isGym && (
          <section ref={liveQueueSectionRef} className="relative">
            <LiveQueueCard
              variant="salon"
              waitLabel={waitLabel}
              peopleAhead={waiting.length}
              readyChairs={availableBarbers}
              totalChairs={activeBarbers}
            />

            {/* Warm ambient blob behind the glass CTA — same decorative-glow
                pattern used in LiveQueueCard, so the backdrop-blur below has
                real content to filter. Purely decorative. */}
            <div className="pointer-events-none absolute -bottom-6 left-4 -z-10 h-28 w-48 rounded-full bg-[#C9A24B]/55 blur-2xl" aria-hidden="true" />
            <div className="pointer-events-none absolute -bottom-6 right-4 -z-10 h-24 w-32 rounded-full bg-[#0F766E]/30 blur-2xl" aria-hidden="true" />

            {/* Secondary future-booking CTA: translucent warm glass, deliberately
                quieter than the Live Queue hero above it — "later", not "now".
                Calls the real reserve flow (setScreen('slots') in CustomerApp),
                not a locked placeholder. */}
            <button
              onClick={onReserve}
              id="reserve-future-window-btn"
              className="relative mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-[#E7C673]/55 bg-[#8A6A2C]/22 px-3.5 py-2.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_20px_-16px_rgba(90,64,20,0.5)] backdrop-blur-md backdrop-saturate-[1.8]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <LockedCalendarIcon size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-bold text-[#3E2F13]">Choose a future time</span>
                  <span className="mt-0.5 block truncate text-[10px] font-medium text-[#5C4A28]">Skip the wait — reserve ahead</span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[#E7C673]/60 bg-white/20 px-2.5 py-1 text-[10px] font-bold text-[#5B420F] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-sm">
                Reserve
                <ChevronRight className="h-3 w-3" />
              </span>
            </button>
          </section>
        )}

        <section className="relative aspect-[2.4/1] min-h-[128px] overflow-hidden rounded-2xl bg-gradient-to-r from-[#173E3A] to-[#3F746D] p-5 text-white">
          <div className="max-w-[72%]">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[9px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              At {salon.name}
            </span>
            <h2 className="mt-3 text-lg font-bold leading-tight">
              {isGym ? 'Your next fitness session, on your schedule.' : 'Your next grooming visit, without the waiting room.'}
            </h2>
          </div>
          {isGym ? (
            <Dumbbell className="absolute -bottom-4 -right-2 h-28 w-28 rotate-[-12deg] text-white/10" />
          ) : (
            <Scissors className="absolute -bottom-4 -right-2 h-28 w-28 rotate-[-12deg] text-white/10" />
          )}
        </section>

        {!!profile.offers.length && <section><SectionTitle eyebrow="Savings" title="Available offers" /><div className="flex snap-x gap-3 overflow-x-auto pb-1">{profile.offers.map((offer) => <div key={offer.id} className="min-w-[260px] snap-start rounded-2xl border border-[#E0E6E5] bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,40,37,0.18)]"><p className="text-xs font-bold text-[#0F766E]">{offer.discount}</p><h3 className="mt-1 text-sm font-bold">{offer.title}</h3>{offer.minimumBill && <p className="mt-2 text-[10px] text-[#778481]">Minimum bill {offer.minimumBill}</p>}<p className="mt-1 text-[10px] text-[#778481]">{offer.validity}</p></div>)}</div></section>}

        <section>
          <SectionTitle eyebrow="Explore" title="Services" />
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {categories.map((category) => (
              <a
                key={category}
                href="#service-menu"
                className="group flex min-w-[104px] flex-1 flex-col items-center rounded-2xl border border-[#E0E7E6] bg-white px-3 py-3.5 text-center shadow-[0_4px_14px_-8px_rgba(15,40,37,0.08)] transition active:scale-[0.98]"
              >
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0F766E]/20 bg-gradient-to-b from-white via-[#F2FAF8] to-[#DEF3EF] shadow-[inset_0_1.5px_0_rgba(255,255,255,1),inset_0_-1px_2px_rgba(15,118,110,0.06),0_3px_8px_-2px_rgba(15,118,110,0.16)] transition-transform duration-200 group-hover:scale-105">
                  {CATEGORY_ICONS[category] || <HairCare3DIcon className="h-6 w-6" />}
                </span>
                <span className="mt-2 text-[11px] font-bold text-[#17201F]">{category}</span>
              </a>
            ))}
          </div>
        </section>

        <section id="service-menu">
          <SectionTitle eyebrow="Choose your services" title="Service menu" />
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
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                active={selectedServiceIds.includes(service.id)}
                onToggle={() => toggleService(service.id)}
              />
            ))}
            {filteredServices.length === 0 && <p className="rounded-2xl border border-[#E0E7E6] bg-white p-5 text-center text-xs text-[#788582]">No services in this filter yet.</p>}
          </div>
        </section>

        {!!profile.gallery.length && <section><SectionTitle eyebrow="Inside the salon" title="Vibes" /><div className="flex snap-x gap-3 overflow-x-auto">{profile.gallery.map((item) => <div key={item.id} className="relative aspect-[4/5] min-w-[160px] snap-start overflow-hidden rounded-2xl bg-[#DDE9E7]"><img src={item.imageUrl} alt={item.label || salon.name} className="h-full w-full object-cover" />{item.type === 'video' && <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2 py-1 text-[9px] font-bold text-white">Video · muted</span>}</div>)}</div></section>}

        <section className="rounded-2xl border border-[#E0E7E6] bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,40,37,0.18)]"><SectionTitle eyebrow="Our story" title={`About ${salon.name}`} /><p className={`text-xs leading-5 text-[#657471] ${aboutExpanded ? '' : 'line-clamp-3'}`}>{profile.description}</p><button onClick={() => setAboutExpanded((value) => !value)} className="mt-2 flex items-center gap-1 text-xs font-bold text-[#0F766E]">Read {aboutExpanded ? 'less' : 'more'}<ChevronDown className={`h-3.5 w-3.5 transition ${aboutExpanded ? 'rotate-180' : ''}`} /></button>{!!profile.amenities.length && <div className="mt-4 flex flex-wrap gap-2">{profile.amenities.map((amenity) => <span key={amenity} className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F5F4] px-3 py-1.5 text-[10px] font-semibold text-[#536966]">{amenity.includes('Wi-Fi') ? <Wifi className="h-3 w-3" /> : amenity.includes('Air') ? <Wind className="h-3 w-3" /> : <CreditCard className="h-3 w-3" />}{amenity}</span>)}</div>}</section>

        <section className="rounded-2xl border border-[#E0E7E6] bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,40,37,0.18)]"><SectionTitle eyebrow="Visit" title="Location & hours" /><p className="text-xs leading-5 text-[#657471]">{salon.address}</p><p className="mt-2 text-xs font-semibold">{profile.openingHours}</p><a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#BED7D3] text-xs font-bold text-[#0F766E]"><Navigation className="h-4 w-4" />View directions<ExternalLink className="h-3 w-3" /></a></section>

        {!!branches.length && <section><SectionTitle eyebrow="More nearby" title="Other branches near you" /><div className="space-y-2">{branches.map((branch) => <div key={branch.id} className="rounded-2xl border border-[#E0E7E6] bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,40,37,0.18)]"><p className="text-sm font-bold">{branch.name}</p><p className="mt-1 text-[10px] text-[#788582]">{branch.distanceKm} km · {branch.liveWaitMinutes ? `${branch.liveWaitMinutes} min wait` : 'No wait'}</p></div>)}</div></section>}
      </div>

      {/* Premium sticky action dock. Zero-state stays the simpler translucent
          floating glass (nothing to protect readability-wise). The instant a
          service is selected, the dock switches to an opaque warm
          ivory/stone blurred-mirror lens material — glossy masked-gradient
          rim, soft mirror sheen, a hint of fine noise, no page content
          showing through — so the summary/Session text stays fully solid
          and readable. Safe-area aware, with a micro-bounce whenever the
          selection changes. The selected-service summary is always mounted
          — never conditionally rendered — so it can animate open/closed via
          a grid-rows transition instead of popping in/out or remounting. */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <div
          className={`relative mx-auto max-w-xl overflow-hidden rounded-[22px] p-2.5 transition-all duration-300 ${
            totals.count > 0
              ? 'border border-white/75 bg-gradient-to-b from-white/78 via-white/58 to-white/72 shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),inset_0_0_24px_rgba(255,255,255,0.35),0_-14px_32px_-12px_rgba(15,70,65,0.25),0_12px_36px_-10px_rgba(10,35,32,0.22)] backdrop-blur-2xl backdrop-saturate-[2.2] backdrop-brightness-[1.06]'
              : 'border border-white/35 bg-gradient-to-br from-white/16 via-white/[0.06] to-[#0F766E]/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_0_0_1px_rgba(255,255,255,0.06),0_-14px_30px_-16px_rgba(10,30,27,0.35),0_8px_24px_-10px_rgba(10,30,27,0.22)] backdrop-blur-2xl backdrop-saturate-[1.8]'
          } ${dockBounce ? 'dock-bounce' : ''}`}
        >
          {totals.count > 0 && (
            <>
              {/* Premium blurred mirror / frosted glass material highlights */}
              <div
                className="pointer-events-none absolute inset-0 rounded-[22px] p-px"
                style={{
                  background:
                    'linear-gradient(125deg, rgba(255,255,255,0.95), rgba(15,118,110,0.22) 35%, rgba(255,255,255,0.35) 55%, rgba(231,198,115,0.24) 75%, rgba(255,255,255,0.85))',
                  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-0 rounded-[22px] opacity-[0.14] mix-blend-overlay"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
                  backgroundSize: '140px 140px',
                }}
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute -inset-x-[10%] -inset-y-[20%] rounded-[22px] blur-[5px]"
                style={{ background: 'linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.45) 45%, rgba(255,255,255,0.12) 58%, transparent 75%)' }}
                aria-hidden="true"
              />
            </>
          )}
          {/* Faint top sheen for the zero-state glass — purely decorative. */}
          {totals.count === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/[0.16] to-transparent" aria-hidden="true" />
          )}
          <div
            className="relative grid transition-[grid-template-rows] duration-[280ms] ease-out"
            style={{ gridTemplateRows: !userEntry && totals.count > 0 ? '1fr' : '0fr' }}
          >
            <div className="overflow-hidden">
              <div
                className={`transition-all duration-[280ms] ease-out ${
                  !userEntry && totals.count > 0 ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0'
                }`}
              >
                <button
                  type="button"
                  id="dock-summary-btn"
                  onClick={() => setBreakdownOpen(true)}
                  className="flex w-full items-center justify-between rounded-xl px-2 py-1 text-left transition active:bg-white/10"
                >
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold leading-4 text-[#12332E]">
                      {totals.count} {totals.count === 1 ? 'service' : 'services'} selected
                    </span>
                    {dockDiscountInr > 0 && appliedOffer && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-[#0F766E]"><Tag className="h-2.5 w-2.5" />{appliedOffer.title} applied</span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {dockDiscountInr > 0 ? (
                      <span className="flex items-baseline gap-1.5">
                        <span className="text-[11px] text-[#A3ADAB] line-through">₹{totals.totalPriceInr}</span>
                        <span className="text-sm font-bold text-[#0B1F1C] underline decoration-[#0B1F1C]/25 decoration-dashed underline-offset-4">₹{dockFinalTotalInr}</span>
                      </span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-[#0B1F1C] underline decoration-[#0B1F1C]/25 decoration-dashed underline-offset-4">
                        ₹{totals.totalPriceInr}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-[#788582]" />
                  </span>
                </button>
                {/* Same Session treatment as the Join Queue sheet's "To pay"
                    card — same icon, label, type and shared duration calc —
                    just riding on the dock's glass surface instead of a
                    separate solid card. */}
                {totals.totalDurationMin > 0 && (
                  <div className="mt-1 flex items-center gap-2.5 rounded-xl border border-white/70 bg-white/60 px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),0_2px_6px_-2px_rgba(15,118,110,0.12)] backdrop-blur-md">
                    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-[#0F766E] to-[#0B4A44] text-white shadow-[0_1px_3px_rgba(11,61,56,0.35)]">
                      <Clock className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-[10.5px] font-bold uppercase tracking-[0.05em] text-[#173832]">Session</span>
                      <span className="text-xs font-extrabold text-[#0B211E]">{formatDurationLabel(totals.totalDurationMin)}</span>
                    </span>
                  </div>
                )}
                <div className="h-2" />
              </div>
            </div>
          </div>
          {isGym ? (
            <a
              id="gym-view-services-btn"
              href="#service-menu"
              className="relative flex min-h-13 w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-[#0F766E] px-4 text-xs font-bold text-white shadow-[0_10px_20px_-10px_rgba(15,118,110,0.6)] transition active:scale-[0.98] sm:text-sm"
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" aria-hidden="true" />
              <span className="relative min-w-0 truncate">View Services & Pricing</span>
            </a>
          ) : (
            <div className="relative grid grid-cols-[1fr_auto] gap-2">
              <button
                id="join-live-queue-btn"
                onClick={onJoin}
                className={`relative flex min-h-13 min-w-0 items-center justify-center overflow-hidden rounded-2xl bg-[#0F766E] px-3 text-xs font-bold text-white shadow-[0_10px_20px_-10px_rgba(15,118,110,0.6)] transition active:scale-[0.98] sm:text-sm ${dockBounce ? 'dock-bounce' : ''}`}
              >
                <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" aria-hidden="true" />
                <span className="relative min-w-0 truncate">{userEntry ? 'View live queue' : 'Join Queue'}</span>
              </button>
              <button
                id="reserve-slot-btn"
                type="button"
                onClick={onReserve}
                aria-label="Reserve a future queue window"
                className="relative flex min-h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[#E7C673]/60 bg-[#8A6A2C]/22 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_18px_-12px_rgba(90,64,20,0.45)] backdrop-blur-md backdrop-saturate-[1.7] transition active:scale-[0.98]"
              >
                <CalendarDays className="relative h-4.5 w-4.5 text-[#3E2D0C]" />
                <span className="absolute -right-1 -top-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-white bg-[#3B2A08] text-[#F1D68A] shadow-sm">
                  <Lock className="h-2 w-2" />
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {addressSheetOpen && (
        <StoreAddressSheet
          salonName={salon.name}
          address={salon.address}
          locationLabel={`${salon.distanceKm} km away · ${salon.category || 'Salon & grooming'}`}
          phoneNumber={salon.phoneNumber}
          directionsUrl={directionsUrl}
          onClose={() => setAddressSheetOpen(false)}
        />
      )}
      {openHoursSheetOpen && (
        <OpenHoursSheet salonName={salon.name} isOpen={salon.isOpen} openingHours={profile.openingHours} onClose={() => setOpenHoursSheetOpen(false)} />
      )}
      {directionsSheetOpen && (
        <DirectionsSheet salonName={salon.name} address={salon.address} directionsUrl={directionsUrl} onClose={() => setDirectionsSheetOpen(false)} />
      )}
      {branchesSheetOpen && (
        <BranchesSheet branches={branches} onClose={() => setBranchesSheetOpen(false)} />
      )}
      {beenHereSheetOpen && (
        <BeenHereSheet
          visited={visited}
          onToggle={() => { setVisited((value) => !value); setBeenHereSheetOpen(false); }}
          onClose={() => setBeenHereSheetOpen(false)}
        />
      )}
      {breakdownOpen && (
        <PriceBreakdownSheet
          services={selectedServices}
          offers={profile.offers}
          appliedOfferId={appliedOfferId}
          onApplyOffer={onApplyOffer}
          onRemoveOffer={onRemoveOffer}
          onClose={() => setBreakdownOpen(false)}
        />
      )}
    </div>
  );
};

/** ~4 words of description, then a tappable "…more" — expands in place. */
const DESCRIPTION_PREVIEW_WORDS = 4;

const ServiceCard: React.FC<{ service: ServiceItem; active: boolean; onToggle: () => void }> = ({ service, active, onToggle }) => {
  const [descExpanded, setDescExpanded] = useState(false);
  const [showAddPing, setShowAddPing] = useState(false);
  const hasSaving = Boolean(service.originalPriceInr && service.originalPriceInr > service.priceInr);
  const savePercent = hasSaving ? Math.round((1 - service.priceInr / (service.originalPriceInr as number)) * 100) : 0;
  const words = service.description?.trim().split(/\s+/) ?? [];
  const isLong = words.length > DESCRIPTION_PREVIEW_WORDS;
  const preview = isLong ? words.slice(0, DESCRIPTION_PREVIEW_WORDS).join(' ') : service.description;

  const handleAdd = () => {
    const adding = !active;
    onToggle();
    if (adding) {
      setShowAddPing(true);
      setTimeout(() => setShowAddPing(false), 600);
    }
  };

  return (
    <div
      id={`service-opt-${service.id}`}
      className={`flex w-full items-start gap-3 rounded-2xl border bg-white p-4 shadow-[0_4px_16px_-10px_rgba(15,40,37,0.16)] transition-all ${
        active ? 'border-[#4F9D95] ring-1 ring-[#4F9D95] bg-[#F1FAF9] shadow-[0_6px_20px_-10px_rgba(79,157,149,0.35)]' : 'border-[#E0E7E6]'
      }`}
    >
      <div className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[#17201F]">{service.name}</span>
        {service.description && (
          <p className="mt-1 text-[10px] leading-4 text-[#788582]">
            {descExpanded || !isLong ? service.description : (
              <>
                {preview}
                <button type="button" onClick={() => setDescExpanded(true)} className="ml-1 font-bold text-[#0F766E]">…more</button>
              </>
            )}
          </p>
        )}
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#EFF4F3] px-2 py-0.5 text-[10px] font-bold text-[#4C5A58]">
          <Timer className="h-3 w-3 text-[#0F766E]" />
          Session time : {service.durationMin} min
        </span>
      </div>
      <div className="relative shrink-0 self-start text-right">
        <span className="block text-sm font-bold text-[#17201F]">₹{service.priceInr}</span>
        {hasSaving && (
          <span className="mt-0.5 flex items-center justify-end gap-1">
            <span className="text-[10px] text-[#A3ADAB] line-through">₹{service.originalPriceInr}</span>
            <span className="rounded-full bg-[#FDECEA] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-[#B4463A]">{savePercent}% off</span>
          </span>
        )}
        {showAddPing && (
          <span className="add-to-dock-ping pointer-events-none absolute -top-3 right-0 inline-flex items-center gap-0.5 rounded-full bg-[#0F766E] px-2 py-0.5 text-[9px] font-bold text-white">
            <Check className="h-2.5 w-2.5" /> Added
          </span>
        )}
        <button
          id={`service-toggle-${service.id}`}
          type="button"
          onClick={handleAdd}
          aria-pressed={active}
          aria-label={active ? `Remove ${service.name}` : `Add ${service.name}`}
          className={`group relative mt-2 flex h-8 min-w-[76px] select-none items-center justify-center gap-1.5 rounded-full px-3 text-[11px] font-extrabold tracking-[-0.01em] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:translate-y-[1px] active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:transform-none ${
            active
              ? 'border border-[#094E48] bg-gradient-to-b from-[#138E86] via-[#0F766E] to-[#0A5A53] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_3px_8px_-2px_rgba(15,118,110,0.5),0_1.5px_0_rgba(8,68,62,0.85)] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.35)]'
              : 'border border-[#0F766E]/30 bg-gradient-to-b from-[#FFFFFF] via-[#F3FAF8] to-[#E3F2EF] text-[#0F766E] shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_5px_-1px_rgba(15,118,110,0.18),0_1.5px_0_rgba(15,118,110,0.14)] active:shadow-[inset_0_2px_4px_rgba(15,118,110,0.22)]'
          }`}
        >
          {/* Subtle top specular sheen */}
          <span
            className={`pointer-events-none absolute inset-x-2 top-0 h-[35%] rounded-full transition-opacity duration-300 ${
              active ? 'bg-gradient-to-b from-white/25 to-transparent opacity-100' : 'bg-gradient-to-b from-white/60 to-transparent opacity-80'
            }`}
            aria-hidden="true"
          />

          {/* Morphing 3D Glyph */}
          <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            <Plus
              className={`absolute h-3 w-3 stroke-[2.75] text-[#0F766E] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                active ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
              }`}
            />
            <span
              className={`absolute grid h-3.5 w-3.5 place-items-center rounded-full bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                active ? 'rotate-0 scale-100 opacity-100' : '-rotate-45 scale-0 opacity-0'
              }`}
            >
              <Check className="h-2.5 w-2.5 stroke-[3] text-white" />
            </span>
          </span>

          {/* 3D Vertical Text Flip (Zero Layout Shift) */}
          <span className="relative block h-4 w-[36px] overflow-hidden text-left text-[11px] font-extrabold leading-4">
            <span
              className={`absolute inset-0 block transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                active ? '-translate-y-full opacity-0' : 'translate-y-0 opacity-100'
              }`}
            >
              Add
            </span>
            <span
              className={`absolute inset-0 block transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                active ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
              }`}
            >
              Added
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

const QuickAction: React.FC<{ icon: React.ReactElement; label: string; secondary?: string; onClick?: () => void; active?: boolean; disabled?: boolean }> = ({ icon, label, secondary, onClick, active, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`relative flex min-h-[92px] flex-col items-center justify-center overflow-hidden rounded-2xl px-1.5 py-3 text-center shadow-[0_12px_24px_-16px_rgba(4,16,14,0.7)] ring-1 ring-white/[0.06] transition ${disabled ? 'opacity-45' : 'active:scale-[0.97]'}`}
    style={{ background: 'linear-gradient(160deg, #234742 0%, #16302C 75%)' }}
  >
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-full shadow-[0_6px_14px_-4px_rgba(0,0,0,0.45)] ring-1 ring-black/5 [&>svg]:h-[18px] [&>svg]:w-[18px] ${
        active ? 'bg-[#5EE0B4] text-[#0B3A34]' : 'bg-white text-[#0F766E]'
      }`}
    >
      {icon}
    </span>
    <span className="mt-2.5 text-[10px] font-bold leading-tight text-white">{label}</span>
    {secondary && <span className="mt-0.5 line-clamp-1 text-[8px] text-white/55">{secondary}</span>}
  </button>
);

const SectionTitle: React.FC<{ eyebrow: string; title: string; secondary?: string }> = ({ eyebrow, title, secondary }) => <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#73827F]">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold tracking-[-0.025em]">{title}</h2></div>{secondary && <span className="text-[10px] font-semibold text-[#0F766E]">{secondary}</span>}</div>;

/** Generic bottom-sheet shell shared by the quick-action placeholder sheets below. */
const QuickActionSheetShell: React.FC<{ icon: React.ReactElement; eyebrow: string; title: string; onClose: () => void; children: React.ReactNode }> = ({ icon, eyebrow, title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="w-full rounded-t-3xl bg-[#F8FAFA] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:max-w-sm sm:rounded-3xl sm:pb-6">
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#C9D2D0] sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E7F5F2] text-[#0F766E]">{icon}</span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#0F766E]">{eyebrow}</p>
            <h2 className="truncate text-lg font-bold text-[#17201F]">{title}</h2>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#E2EAE9]"><X className="h-4 w-4" /></button>
      </div>
      {children}
    </section>
  </div>
);

/** Salon address + reach-out actions — real UI, dummy CTA wiring for now. */
const StoreAddressSheet: React.FC<{ salonName: string; address: string; locationLabel: string; phoneNumber?: string; directionsUrl: string; onClose: () => void }> = ({ salonName, address, locationLabel, phoneNumber, directionsUrl, onClose }) => (
  <QuickActionSheetShell icon={<MapPin className="h-4 w-4" />} eyebrow="Store location" title={salonName} onClose={onClose}>
    <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-[#0F766E]"><MapPin className="h-3.5 w-3.5 shrink-0" />{locationLabel}</p>
    <p className="mt-2 rounded-2xl border border-[#E1E7E6] bg-white p-4 text-xs leading-5 text-[#4C5A58] shadow-[0_2px_10px_-6px_rgba(15,40,37,0.15)] [overflow-wrap:anywhere]">{address}</p>
    <div className="mt-4 grid grid-cols-2 gap-2.5">
      {phoneNumber ? (
        <a href={`tel:${phoneNumber}`} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#DDE7E5] bg-white text-xs font-bold text-[#17201F]"><PhoneCall className="h-4 w-4 text-[#0F766E]" />Call salon</a>
      ) : (
        <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#E1E7E6] bg-[#F1F4F3] text-xs font-semibold text-[#9AA6A3]"><PhoneCall className="h-4 w-4" />No number listed</span>
      )}
      <a href={directionsUrl} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-xs font-bold text-white"><Navigation className="h-4 w-4" />Directions</a>
    </div>
  </QuickActionSheetShell>
);

/** Salon timing overview — placeholder structure, ready for a real weekly schedule later. */
const OpenHoursSheet: React.FC<{ salonName: string; isOpen: boolean; openingHours: string; onClose: () => void }> = ({ salonName, isOpen, openingHours, onClose }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <QuickActionSheetShell icon={<Clock3 className="h-4 w-4" />} eyebrow="Salon timing" title={salonName} onClose={onClose}>
      <div className={`mt-4 flex items-center gap-2 rounded-2xl border p-3.5 text-xs font-bold ${isOpen ? 'border-[#BFE0DC] bg-[#EDF8F6] text-[#0F766E]' : 'border-[#F0D6D1] bg-[#FFF7F5] text-[#8A3E35]'}`}>
        <span className={`h-2 w-2 rounded-full ${isOpen ? 'bg-[#14B8A6]' : 'bg-[#E58C82]'}`} />
        {isOpen ? 'Open right now' : 'Closed right now'} · {openingHours}
      </div>
      <div className="mt-3 space-y-1 rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
        {days.map((day) => (
          <div key={day} className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#4C5A58]">{day}</span>
            <span className="text-[#788582]">{openingHours}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-[#9AA6A3]"><Info className="mt-0.5 h-3 w-3 shrink-0" />Per-day timing isn't wired up yet — every day shows the salon's general hours for now.</p>
    </QuickActionSheetShell>
  );
};

/** Directions/help sheet — placeholder structure alongside the real maps link. */
const DirectionsSheet: React.FC<{ salonName: string; address: string; directionsUrl: string; onClose: () => void }> = ({ salonName, address, directionsUrl, onClose }) => (
  <QuickActionSheetShell icon={<Navigation className="h-4 w-4" />} eyebrow="Get there" title={`Directions to ${salonName}`} onClose={onClose}>
    <p className="mt-4 text-xs leading-5 text-[#657471] [overflow-wrap:anywhere]">{address}</p>
    <a href={directionsUrl} target="_blank" rel="noreferrer" className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-xs font-bold text-white"><Navigation className="h-4 w-4" />Open in Maps<ExternalLink className="h-3 w-3" /></a>
    <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-4 text-[#9AA6A3]"><Info className="mt-0.5 h-3 w-3 shrink-0" />In-app turn-by-turn guidance isn't available yet — this opens your device's maps app instead.</p>
  </QuickActionSheetShell>
);

/** Other branches of the same brand — real list when available, honest empty state otherwise. */
const BranchesSheet: React.FC<{ branches: NearbySalon[]; onClose: () => void }> = ({ branches, onClose }) => (
  <QuickActionSheetShell icon={<Store className="h-4 w-4" />} eyebrow="Same brand" title="Other branches" onClose={onClose}>
    <div className="mt-4 space-y-2">
      {branches.map((branch) => (
        <div key={branch.id} className="rounded-2xl border border-[#E1E7E6] bg-white p-3.5">
          <p className="text-sm font-bold text-[#17201F]">{branch.name}</p>
          <p className="mt-1 text-[10px] text-[#788582]">{branch.distanceKm} km · {branch.liveWaitMinutes ? `${branch.liveWaitMinutes} min wait` : 'No wait'}</p>
        </div>
      ))}
      {branches.length === 0 && (
        <p className="rounded-2xl border border-[#E1E7E6] bg-white p-4 text-center text-xs text-[#788582]">No other branches nearby yet.</p>
      )}
    </div>
  </QuickActionSheetShell>
);

/** "Been here" — a simple honest visited toggle; no fake visit history invented. */
const BeenHereSheet: React.FC<{ visited: boolean; onToggle: () => void; onClose: () => void }> = ({ visited, onToggle, onClose }) => (
  <QuickActionSheetShell icon={<CheckCircle2 className="h-4 w-4" />} eyebrow="Your visits" title="Been here?" onClose={onClose}>
    <p className="mt-4 text-xs leading-5 text-[#657471]">Mark this salon as one you've visited before. Your visit history isn't tracked yet — this is just a personal reminder for now.</p>
    <button
      type="button"
      onClick={onToggle}
      className={`mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold transition ${visited ? 'bg-[#F1F4F3] text-[#4C5A58]' : 'bg-[#0F766E] text-white'}`}
    >
      <CheckCircle2 className="h-4 w-4" />
      {visited ? 'Marked as visited' : 'Mark as visited'}
    </button>
  </QuickActionSheetShell>
);
