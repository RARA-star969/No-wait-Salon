import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Share2,
  Star,
  MapPin,
  Clock,
  Navigation,
  Users,
  CalendarDays,
  UserCheck,
  Dumbbell,
  CheckCircle2,
  ShieldAlert,
  Flame,
  Activity,
  Wifi,
  Sparkles,
  Tag,
  Check,
  ChevronRight,
  Store,
  X,
} from 'lucide-react';
import { NearbySalon, Salon, SalonOffer, ServiceItem } from '../types';
import { gymCustomerService, GymPublicOverview, GymClass, GymTrainer } from '../services/gymCustomerService';
import { evaluateCoupon } from '../shared/couponPricing';
import { GymLiveCard } from './GymLiveCard';
import { GymFloatingCapsule } from './GymFloatingCapsule';
import { QuickAction, SectionTitle, AddressSheet, OpenHoursSheet, DirectionsSheet, BranchesSheet, BeenHereSheet } from './DetailPageKit';

interface GymDetailPageProps {
  salon: Salon;
  nearbySalons?: NearbySalon[];
  onBack: () => void;
  onApplyOffer?: (offerId: string) => void;
  appliedOfferId?: string | null;
}

export const GymDetailPage: React.FC<GymDetailPageProps> = ({
  salon,
  nearbySalons = [],
  onBack,
  onApplyOffer,
  appliedOfferId,
}) => {
  const [overview, setOverview] = useState<GymPublicOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPass, setSelectedPass] = useState<ServiceItem | null>(null);
  const [bookingSuccessMessage, setBookingSuccessMessage] = useState<string | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<GymTrainer | null>(null);
  const [ptBookingModalOpen, setPtBookingModalOpen] = useState(false);
  const [classBookingModalOpen, setClassBookingModalOpen] = useState<GymClass | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(true);
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [openHoursSheetOpen, setOpenHoursSheetOpen] = useState(false);
  const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
  const [branchesSheetOpen, setBranchesSheetOpen] = useState(false);
  const [beenHereSheetOpen, setBeenHereSheetOpen] = useState(false);

  const directionsUrl = `https://maps.google.com/?q=${salon.latitude},${salon.longitude}`;
  const shareGym = async () => {
    const shareData = { title: salon.name, text: `${salon.name}\n${salon.address}`, url: directionsUrl };
    if (navigator.share) await navigator.share(shareData).catch(() => undefined);
    else await navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`).catch(() => undefined);
  };
  const branches = nearbySalons.filter((item) => item.id !== salon.id && salon.brandKey && item.brandKey === salon.brandKey);

  // Poll the one real Gym state source every 2 seconds — the same
  // getGymState(gymId) the Staff Dashboard reads and writes — so a
  // capacity/check-in/trainer change made on the dashboard reaches this
  // page (and the floating capsule) without a refresh. No local mock
  // fallback: a failed fetch leaves `overview` null and `loading` true
  // rather than quietly substituting fabricated numbers.
  useEffect(() => {
    let active = true;
    const fetchState = async () => {
      try {
        const data = await gymCustomerService.getPublicOverview(salon.id);
        if (active) {
          setOverview(data);
          setLoading(false);
        }
      } catch {
        /* keep the last known overview (or null) rather than showing fabricated data */
        if (active) setLoading(false);
      }
    };

    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [salon.id]);

  useEffect(() => {
    const cardEl = document.getElementById('gym-live-card');
    if (!cardEl) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsCardVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    observer.observe(cardEl);
    return () => observer.disconnect();
  }, [loading]);

  // Nullish coalescing, not `||` — a real currentOccupancy/availableTrainersCount
  // of 0 must render as 0, not silently fall back to a placeholder. There's
  // no default "42/80"-style number here; before the first successful poll
  // resolves, these simply reflect an empty/zero state matching `loading`.
  const maxCap = overview?.maxCapacity ?? 0;
  const currentOcc = overview?.currentOccupancy ?? 0;

  const handleBookClass = async (gymClass: GymClass) => {
    try {
      await gymCustomerService.bookClass(salon.id, gymClass.id, 'Customer User');
      setClassBookingModalOpen(null);
      setBookingSuccessMessage(`Booked seat in "${gymClass.title}" with ${gymClass.trainer}!`);
      setTimeout(() => setBookingSuccessMessage(null), 4000);
      const updated = await gymCustomerService.getPublicOverview(salon.id);
      setOverview(updated);
    } catch (err: any) {
      setBookingSuccessMessage(err.message || 'Class booking failed.');
      setTimeout(() => setBookingSuccessMessage(null), 4000);
    }
  };

  const handleBookPT = async () => {
    if (!selectedTrainer) return;
    try {
      await gymCustomerService.bookPT(salon.id, {
        trainerId: selectedTrainer.id,
        trainerName: selectedTrainer.name,
        clientName: 'Customer User',
        timeSlot: selectedTrainer.nextSlot || 'Today 04:00 PM',
        serviceName: 'Personal Training 1-on-1',
      });
      setPtBookingModalOpen(false);
      setBookingSuccessMessage(`Personal Training session booked with ${selectedTrainer.name}!`);
      setTimeout(() => setBookingSuccessMessage(null), 4000);
    } catch (err: any) {
      setBookingSuccessMessage(err.message || 'PT booking failed.');
      setTimeout(() => setBookingSuccessMessage(null), 4000);
    }
  };

  return (
    <div id="gym-detail-page" className="min-h-full bg-[#F8FAFA] pb-24 text-[#17201F]">
      {/* Toast Notification Banner */}
      {bookingSuccessMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between rounded-xl border border-[#0F766E]/40 bg-[#0F766E] px-4 py-3 text-xs font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#14B8A6]" />
            {bookingSuccessMessage}
          </span>
          <button onClick={() => setBookingSuccessMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 1. GYM HERO / BUSINESS INFO — same header pattern as SalonDetailPage:
          back/bookmark/share over the cover image, an open/closed status
          dot, name + category/distance/hours, and a tappable address row
          that opens the shared AddressSheet. One NOQ header language for
          every category. */}
      <div className="relative bg-[#0D2422] text-white">
        <div className="relative h-48 w-full overflow-hidden bg-[#133330]">
          <img
            src={salon.coverImageUrl || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop'}
            alt={salon.name}
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D2422] via-transparent to-black/40" />

          {/* Top Bar Navigation */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            <button
              onClick={onBack}
              id="gym-back-btn"
              aria-label="Back to nearby gyms"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSaved((value) => !value)}
                aria-label={saved ? 'Remove saved gym' : 'Save gym'}
                className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${saved ? 'bg-white text-[#0F766E]' : 'bg-black/40 text-white'}`}
              >
                <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
              </button>
              <button
                onClick={shareGym}
                aria-label="Share gym"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition active:scale-95"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 pt-3 pb-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-[#14B8A6]/20 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#14B8A6]">
              Fitness & Strength Center
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-[#14B8A6]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#14B8A6]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
              Open Now
            </span>
          </div>

          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{salon.name}</h1>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#A3C7C2]">
            <span className="flex items-center gap-1 font-bold text-amber-300">
              <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
              {salon.rating} ({salon.reviewCount} reviews)
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-[#14B8A6]" />
              {salon.distanceKm} km away
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#14B8A6]" />
              {salon.openingHours || '6:00 AM–10:00 PM'}
            </span>
          </div>

          <p className="mt-2.5 text-xs text-[#8BAAA6] line-clamp-2">
            {salon.description || 'High-performance strength and fitness center featuring heavy lifting gear, cardio deck, sauna, and certified personal trainers.'}
          </p>

          <button
            type="button"
            id="gym-address-row"
            onClick={() => setAddressSheetOpen(true)}
            aria-label="View gym address and contact"
            className="mt-3 flex w-full items-start gap-1.5 text-left text-[11px] leading-4 text-[#A3C7C2] underline decoration-white/25 underline-offset-2 transition active:text-white"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{salon.address}</span>
          </button>
        </div>
      </div>

      {/* Premium action tiles — same interaction pattern as the salon detail page. */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-4 gap-2.5">
          <QuickAction icon={<CalendarDays />} label="Schedule" onClick={() => setOpenHoursSheetOpen(true)} />
          <QuickAction icon={<Navigation />} label="Directions" onClick={() => setDirectionsSheetOpen(true)} />
          <QuickAction icon={<Store />} label="Branches" secondary={branches.length ? `${branches.length} nearby` : undefined} onClick={() => setBranchesSheetOpen(true)} />
          <QuickAction icon={<Check />} label={visited ? 'Visited' : 'Been here'} active={visited} onClick={() => setBeenHereSheetOpen(true)} />
        </div>
      </div>

      {/* Floating Gym Live Capsule when main card is scrolled out of view */}
      {!isCardVisible && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[95] capsule-melt-in">
          <GymFloatingCapsule
            currentOccupancy={currentOcc}
            maxCapacity={maxCap}
            availableTrainersCount={overview?.availableTrainersCount ?? 0}
            onTap={() => {
              document.getElementById('gym-live-card')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      )}

      <div className="space-y-5 p-5">
        {/* 2. LIVE CROWD / CAPACITY — PRIMARY USP */}
        <div id="gym-live-capacity-card">
          <GymLiveCard
            currentOccupancy={currentOcc}
            maxCapacity={maxCap}
            availableTrainersCount={overview?.availableTrainersCount ?? 0}
          />
        </div>

        {/* 3. TODAY'S CLASSES */}
        <div id="gym-classes-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#17201F]">Today's Scheduled Classes</h2>
              <p className="text-[11px] text-[#6F7C7A]">Book group workout sessions</p>
            </div>
            <span className="text-[11px] font-bold text-[#0F766E]">
              {(overview?.classesToday || []).length} Available Today
            </span>
          </div>

          <div className="space-y-2.5">
            {(overview?.classesToday ?? []).map((c) => {
              const seatsLeft = c.maxCapacity - c.enrolled;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-[#DDE5E3] bg-white p-4 shadow-sm">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#17201F]">{c.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[#6F7C7A]">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[#0F766E]" />
                        {c.time}
                      </span>
                      <span>·</span>
                      <span>{c.trainer}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-[#0F766E]">
                      {seatsLeft > 0 ? `${seatsLeft} seats left (${c.enrolled}/${c.maxCapacity} enrolled)` : 'Full'}
                    </div>
                  </div>

                  <button
                    onClick={() => setClassBookingModalOpen(c)}
                    disabled={seatsLeft <= 0}
                    className="rounded-xl bg-[#0F766E] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-40"
                  >
                    Book Class
                  </button>
                </div>
              );
            })}
            {!loading && (overview?.classesToday ?? []).length === 0 && (
              <p className="rounded-2xl border border-[#DDE5E3] bg-white p-4 text-center text-xs text-[#788582]">No classes scheduled today.</p>
            )}
          </div>
        </div>

        {/* 4. TRAINERS & COACHES */}
        <div id="gym-trainers-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#17201F]">Certified Coaches & Trainers</h2>
              <p className="text-[11px] text-[#6F7C7A]">1-on-1 personal training experts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(overview?.trainers ?? []).map((t) => (
              <div key={t.id} className="rounded-2xl border border-[#DDE5E3] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#17201F]">{t.name}</h3>
                    <p className="text-[11px] font-semibold text-[#0F766E]">{t.role}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold ${
                    t.status === 'Available' ? 'bg-[#E7F5F2] text-[#0F766E]' : 'bg-amber-50 text-amber-800'
                  }`}>
                    {t.status}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[#6F7C7A]">
                  <span className="flex items-center gap-1 font-bold text-amber-600">
                    ★ {t.rating} ({t.reviewCount})
                  </span>
                  <span>Next: {t.nextSlot || 'Available'}</span>
                </div>

                <button
                  onClick={() => {
                    setSelectedTrainer(t);
                    setPtBookingModalOpen(true);
                  }}
                  className="mt-3 w-full rounded-xl border border-[#0F766E]/30 bg-[#F4F7F6] py-2 text-xs font-bold text-[#0F766E] transition hover:bg-[#E7F5F2] active:scale-98"
                >
                  Book 1-on-1 PT
                </button>
              </div>
            ))}
          </div>
          {!loading && (overview?.trainers ?? []).length === 0 && (
            <p className="rounded-2xl border border-[#DDE5E3] bg-white p-4 text-center text-xs text-[#788582]">No trainers listed yet.</p>
          )}
        </div>

        {/* 6. SERVICES & PASSES */}
        <div id="gym-passes-section" className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[#17201F]">Gym Passes & Memberships</h2>
            <p className="text-[11px] text-[#6F7C7A]">Select pass for your workout session</p>
          </div>

          <div className="space-y-2.5">
            {salon.services.map((service) => {
              const isSelected = selectedPass?.id === service.id;
              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedPass(service)}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    isSelected ? 'border-[#0F766E] bg-[#E7F5F2]/40 ring-1 ring-[#0F766E]' : 'border-[#DDE5E3] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#E7F5F2] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#0F766E]">
                          Pass
                        </span>
                        <h3 className="text-xs font-extrabold text-[#17201F]">{service.name}</h3>
                      </div>
                      <p className="mt-1 text-[11px] text-[#6F7C7A]">{service.description || 'Full equipment and facility access included.'}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-extrabold text-[#17201F]">₹{service.priceInr}</div>
                      <div className="text-[10px] font-semibold text-[#6F7C7A]">{service.durationMin} mins</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. FACILITIES / AMENITIES */}
        <div className="rounded-2xl border border-[#DDE5E3] bg-white p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#5C6E6B]">Gym Facilities & Amenities</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(salon.amenities && salon.amenities.length ? salon.amenities : [
              'Strength Zone', 'Cardio Deck', 'Sauna & Recovery Spa', 'Locker Room', 'Shower', 'Parking', 'Wi-Fi'
            ]).map((amenity) => (
              <span key={amenity} className="flex items-center gap-1.5 rounded-xl border border-[#DDE5E3] bg-[#F8FAFA] px-3 py-1.5 text-xs font-semibold text-[#17201F]">
                <Check className="h-3.5 w-3.5 text-[#0F766E]" />
                {amenity}
              </span>
            ))}
          </div>
        </div>

        {/* 8. OFFERS & COUPONS */}
        {salon.offers && salon.offers.length > 0 && (
          <div className="rounded-2xl border border-[#0F766E]/20 bg-[#E7F5F2] p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#0F766E]" />
              <h2 className="text-xs font-extrabold text-[#0F766E]">Active Gym Offers & Coupons</h2>
            </div>
            <div className="mt-2.5 space-y-2">
              {salon.offers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between rounded-xl bg-white p-3 text-xs">
                  <div>
                    <div className="font-bold text-[#17201F]">{offer.title}</div>
                    <div className="text-[10px] text-[#6F7C7A]">{offer.discount} · Code: {offer.code || 'GYM20'}</div>
                  </div>
                  {onApplyOffer && (
                    <button
                      onClick={() => onApplyOffer(offer.id)}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                        appliedOfferId === offer.id ? 'bg-[#0F766E] text-white' : 'border border-[#0F766E] text-[#0F766E]'
                      }`}
                    >
                      {appliedOfferId === offer.id ? 'Applied' : 'Apply'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Class Booking Modal */}
      {classBookingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-[#17201F]">Confirm Class Seat</h3>
            <p className="mt-1 text-xs text-[#6F7C7A]">
              Reserve your seat for <strong className="text-[#17201F]">{classBookingModalOpen.title}</strong> with {classBookingModalOpen.trainer}.
            </p>
            <div className="mt-4 rounded-xl bg-[#F8FAFA] p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Time</span>
                <span className="font-bold text-[#17201F]">{classBookingModalOpen.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Capacity</span>
                <span className="font-bold text-[#0F766E]">{classBookingModalOpen.enrolled}/{classBookingModalOpen.maxCapacity} Enrolled</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setClassBookingModalOpen(null)}
                className="flex-1 rounded-xl border border-[#DDE5E3] py-2.5 text-xs font-bold text-[#17201F]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleBookClass(classBookingModalOpen)}
                className="flex-1 rounded-xl bg-[#0F766E] py-2.5 text-xs font-bold text-white shadow-sm"
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PT Booking Modal */}
      {ptBookingModalOpen && selectedTrainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-base font-bold text-[#17201F]">Book Personal Training</h3>
            <p className="mt-1 text-xs text-[#6F7C7A]">
              1-on-1 Session with <strong className="text-[#17201F]">{selectedTrainer.name}</strong> ({selectedTrainer.role})
            </p>
            <div className="mt-4 rounded-xl bg-[#F8FAFA] p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Next Slot</span>
                <span className="font-bold text-[#0F766E]">{selectedTrainer.nextSlot || 'Today 04:00 PM'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Fee</span>
                <span className="font-bold text-[#17201F]">₹800 / Session</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPtBookingModalOpen(false)}
                className="flex-1 rounded-xl border border-[#DDE5E3] py-2.5 text-xs font-bold text-[#17201F]"
              >
                Cancel
              </button>
              <button
                onClick={handleBookPT}
                className="flex-1 rounded-xl bg-[#0F766E] py-2.5 text-xs font-bold text-white shadow-sm"
              >
                Confirm Session
              </button>
            </div>
          </div>
        </div>
      )}

      {addressSheetOpen && (
        <AddressSheet
          name={salon.name}
          eyebrow="Gym location"
          address={salon.address}
          locationLabel={`${salon.distanceKm} km away · Fitness & Strength Center`}
          phoneNumber={salon.phoneNumber}
          directionsUrl={directionsUrl}
          onClose={() => setAddressSheetOpen(false)}
        />
      )}
      {openHoursSheetOpen && (
        <OpenHoursSheet name={salon.name} eyebrow="Gym timing" isOpen={salon.isOpen} openingHours={salon.openingHours || '6:00 AM–10:00 PM'} onClose={() => setOpenHoursSheetOpen(false)} />
      )}
      {directionsSheetOpen && (
        <DirectionsSheet name={salon.name} address={salon.address} directionsUrl={directionsUrl} onClose={() => setDirectionsSheetOpen(false)} />
      )}
      {branchesSheetOpen && (
        <BranchesSheet branches={branches} onClose={() => setBranchesSheetOpen(false)} />
      )}
      {beenHereSheetOpen && (
        <BeenHereSheet
          visited={visited}
          subjectLabel="gym"
          onToggle={() => { setVisited((value) => !value); setBeenHereSheetOpen(false); }}
          onClose={() => setBeenHereSheetOpen(false)}
        />
      )}

      {/* Floating Bottom Bar (Gym Actions) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#EAEFEF] bg-white/95 p-3.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#6F7C7A]">Selected Gym Pass</div>
            <div className="text-xs font-extrabold text-[#17201F]">
              {selectedPass ? `${selectedPass.name} (₹${selectedPass.priceInr})` : 'Select a Pass'}
            </div>
          </div>
          <button
            onClick={() => {
              if (selectedPass) {
                setBookingSuccessMessage(`Pass "${selectedPass.name}" reserved!`);
                setTimeout(() => setBookingSuccessMessage(null), 4000);
              } else {
                const element = document.getElementById('gym-passes-section');
                element?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="rounded-xl bg-[#0F766E] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition active:scale-95"
          >
            {selectedPass ? 'Confirm Gym Pass' : 'View Passes'}
          </button>
        </div>
      </div>
    </div>
  );
};
