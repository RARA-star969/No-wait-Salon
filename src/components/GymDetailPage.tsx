import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Share2,
  Star,
  MapPin,
  Clock,
  Users,
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
  X,
  QrCode,
  BadgeCheck,
  TrendingUp,
} from 'lucide-react';
import { NearbySalon, Salon, SalonOffer, ServiceItem, CustomerAuthSession, CustomerProfile } from '../types';
import { fetchSalonProfile } from '../services/salonDiscoveryService';
import { gymCustomerService, GymPublicOverview, GymClass, GymTrainer, GymOffering, GymMyMembershipResponse } from '../services/gymCustomerService';
import { businessQrService, type QrBusiness } from '../services/businessQrService';
import { evaluateCoupon } from '../shared/couponPricing';
import { resolveAppReadiness } from '../shared/profileReadiness';
import { GymLiveCard } from './GymLiveCard';
import { GymHeroGallery } from './GymHeroGallery';
import { PublicReviewsSection } from './PublicReviewsSection';
import { AnimatedSalonName } from './AnimatedSalonName';
import { gymProfileIcon, socialPlatformIcon } from './gymProfileIcons';
import { defaultQuickActions } from '../shared/gymProfileCms';
import { GymFloatingCapsule } from './GymFloatingCapsule';
import { AccountOnboarding } from './AccountOnboarding';
import { QrScannerModal } from './QrScannerModal';
import { QuickAction, SectionTitle, AddressSheet, OpenHoursSheet, DirectionsSheet, BranchesSheet, BeenHereSheet } from './DetailPageKit';
import { CategoryActionBar } from './CategoryActionBar';
import { formatGymClock, gymVisitDurationLabel } from '../shared/gymTime';
import { activeAccessHeading, splitRecommendedOfferings } from '../shared/gymLiveFloor';
import { RatingSummaryBadge } from './RatingSummaryBadge';

// Gym's own violet/purple quick-action tile surface — QuickAction is shared
// with Salon (which keeps its default teal), so Gym passes its own gradient
// instead of a copy of the component.
const GYM_QUICK_ACTION_GRADIENT = 'linear-gradient(160deg, #2E1B4A 0%, #170F29 75%)';
const GYM_QUICK_ACTION_MEMBER_GRADIENT = 'linear-gradient(160deg, #5B21B6 0%, #2E1065 75%)';

interface GymDetailPageProps {
  salon: Salon;
  nearbySalons?: NearbySalon[];
  onBack: () => void;
  onApplyOffer?: (offerId: string) => void;
  appliedOfferId?: string | null;
  customerAuth?: CustomerAuthSession | null;
  customerProfile?: CustomerProfile | null;
  profileLoading?: boolean;
  onIdentityVerified?: (auth: CustomerAuthSession) => void;
  onProfileSaved?: (profile: CustomerProfile) => void;
}

export const GymDetailPage: React.FC<GymDetailPageProps> = ({
  salon: salonProp,
  nearbySalons = [],
  onBack,
  onApplyOffer,
  appliedOfferId,
  customerAuth = null,
  customerProfile = null,
  profileLoading = false,
  onIdentityVerified,
  onProfileSaved,
}) => {
  // Mirrors the real /api/salons/:id/profile source (the same one the
  // initial `salon` prop came from) on a short cadence while this page is
  // open, so an owner's Manage Profile save (description, address, gallery,
  // amenities, quick actions, social links) reaches the customer within a
  // few seconds — never a full page reload, and never a second/fake data
  // source: this endpoint already only ever reflects the live, Admin-
  // approved row, so a moderation hold keeps the customer on the last
  // approved state automatically, with no extra logic needed here.
  const [salon, setSalon] = useState<Salon>(salonProp);
  useEffect(() => { setSalon(salonProp); }, [salonProp]);
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;
    const refreshProfile = async () => {
      if (inFlight || cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      inFlight = true;
      try {
        const fresh = await fetchSalonProfile(salonProp.id);
        if (!cancelled && fresh) setSalon(fresh);
      } catch {
        // Keep showing the last known profile; the next tick retries.
      } finally {
        inFlight = false;
      }
    };
    const intervalId = setInterval(refreshProfile, 3000);
    const onVisibilityChange = () => { if (!document.hidden) void refreshProfile(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [salonProp.id]);
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
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [openHoursSheetOpen, setOpenHoursSheetOpen] = useState(false);
  const [directionsSheetOpen, setDirectionsSheetOpen] = useState(false);
  const [branchesSheetOpen, setBranchesSheetOpen] = useState(false);
  const [beenHereSheetOpen, setBeenHereSheetOpen] = useState(false);

  // --- Membership, payment & check-in state ---
  const [myMembership, setMyMembership] = useState<GymMyMembershipResponse | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const [gatePendingAction, setGatePendingAction] = useState<null | 'claim' | 'offering' | 'scan' | 'review'>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [claimName, setClaimName] = useState('');
  const [claimMobile, setClaimMobile] = useState('');
  const [claimJoinDate, setClaimJoinDate] = useState('');
  const [claimExpiryDate, setClaimExpiryDate] = useState('');
  const [claimPlanText, setClaimPlanText] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState('');
  const [offeringPickerOpen, setOfferingPickerOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<GymOffering | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseResultMsg, setPurchaseResultMsg] = useState<string | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  // Access state machine (see the CTA block below):
  //   A  nothing selected          -> "Choose Access"
  //   B  selected, not purchased   -> selected access + price, button "Payment"
  //   -> Payment sheet -> real purchase intent -> pending payment
  //   -> staff Accept & Check In / Confirm Check-In -> Active Visit
  // Selecting or paying never creates a visit; only the gym's confirmation
  // does, which is why none of this state ever touches Inside Now.
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('cash');
  const [upgradeMode, setUpgradeMode] = useState(false);
  // Ticks the live "inside for Xm" label between membership polls. It only
  // moves "now" forward — the duration itself is always recomputed from the
  // visit's server checkedInAt, so a reload never resets it.
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const readiness = resolveAppReadiness(customerAuth, customerProfile, { profileLoading });

  const requireReady = (action: 'claim' | 'offering' | 'scan' | 'review', run: () => void) => {
    if (readiness.kind === 'loading') return;
    if (readiness.kind !== 'ready') {
      setGatePendingAction(action);
      setGateOpen(true);
      return;
    }
    run();
  };

  // Poll this customer's membership/attendance state for this gym once
  // signed in — same source of truth the dashboard writes (memberships,
  // payments, visits), never a locally-computed guess.
  useEffect(() => {
    if (readiness.kind !== 'ready') {
      setMyMembership(null);
      return;
    }
    let active = true;
    const fetchMine = async () => {
      try {
        const data = await gymCustomerService.getMyMembership(salon.id);
        if (active) setMyMembership(data);
      } catch {
        /* keep last known state */
      }
    };
    fetchMine();
    const interval = setInterval(fetchMine, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [salon.id, readiness.kind]);

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

  const refreshMine = async () => {
    try {
      const data = await gymCustomerService.getMyMembership(salon.id);
      setMyMembership(data);
    } catch {
      /* keep last known state */
    }
  };

  const submitClaim = async () => {
    if (!claimName.trim() || !claimMobile.trim() || !claimJoinDate || !claimExpiryDate) {
      setClaimError('Please fill in your name, mobile number, joining date and expiry date.');
      return;
    }
    setClaimBusy(true);
    setClaimError('');
    try {
      await gymCustomerService.submitMembershipClaim(salon.id, {
        name: claimName.trim(),
        mobile: claimMobile.trim(),
        joiningDate: claimJoinDate,
        expiryDate: claimExpiryDate,
        planText: claimPlanText.trim() || undefined,
      });
      setClaimModalOpen(false);
      setBookingSuccessMessage('Membership claim submitted — the gym will verify and approve it shortly.');
      setTimeout(() => setBookingSuccessMessage(null), 5000);
      await refreshMine();
    } catch (err: any) {
      setClaimError(err.message || 'Unable to submit your membership claim.');
    } finally {
      setClaimBusy(false);
    }
  };

  const submitPurchase = async (method: 'online' | 'cash') => {
    if (!selectedOffering) return;
    setPurchaseBusy(true);
    setPurchaseError('');
    try {
      if (method === 'online') {
        // No online gateway is integrated in this build. Rather than fake a
        // successful Razorpay/UPI capture (which would show the gym a real
        // "ONLINE PAID" row for money that never moved), the online path is
        // honestly blocked here until a real integration lands.
        setPurchaseError('Online payment is not live yet at this gym. Choose "Cash at gym" and pay at the front desk.');
        return;
      }
      // Creates a real pending GymPayment only. It does NOT create a visit and
      // does NOT increment Inside Now — the gym still has to accept it.
      await gymCustomerService.createPurchaseIntent(salon.id, selectedOffering.id, method);
      setPaymentSheetOpen(false);
      setOfferingPickerOpen(false);
      setPurchaseResultMsg(
        `"${selectedOffering.name}" is reserved for you. Pay \u20b9${finalAmountInr} in cash at the front desk \u2014 your visit starts when the gym accepts it and checks you in.`,
      );
      await refreshMine();
    } catch (err: any) {
      setPurchaseError(err.message || 'Unable to start this purchase.');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleScanResolved = async (token: string, business: QrBusiness) => {
    setQrScannerOpen(false);
    if (business.id !== salon.id) {
      setBookingSuccessMessage("That QR belongs to a different gym — scan this gym's entry QR to check in.");
      setTimeout(() => setBookingSuccessMessage(null), 5000);
      return;
    }
    setScanBusy(true);
    try {
      const result = await gymCustomerService.checkinScan(salon.id, token);
      setBookingSuccessMessage(result.result === 'queued' ? "Gym is at full capacity — you've joined the entry queue." : "✓ Checked in! Enjoy your workout.");
      setTimeout(() => setBookingSuccessMessage(null), 5000);
      await refreshMine();
      const updated = await gymCustomerService.getPublicOverview(salon.id);
      setOverview(updated);
    } catch (err: any) {
      setBookingSuccessMessage(err.message || 'Unable to check you in with this QR.');
      setTimeout(() => setBookingSuccessMessage(null), 5000);
    } finally {
      setScanBusy(false);
    }
  };

  const membership = myMembership?.membership || null;
  const activeVisit = myMembership?.activeVisit || null;
  const isCheckedIn = Boolean(activeVisit);
  const isQueued = Boolean(myMembership?.queued);
  const hasValidAccess = Boolean(
    (membership && (membership.displayStatus === 'active' || membership.displayStatus === 'expiring_soon' || membership.displayStatus === 'expires_today')) ||
    myMembership?.paidPass,
  );
  const isExpiredMember = Boolean(membership && membership.displayStatus === 'expired');
  const offerings = overview?.offerings ?? [];
  // The real payment this customer is waiting on, if any. Its presence is what
  // puts the CTA into the "waiting for the gym" state — never a local flag we
  // set optimistically after tapping Pay.
  const awaitingPayment = (myMembership?.pendingPayments ?? [])[0] || null;
  // Access currently backing the open visit, resolved from real offerings.
  const activeAccessName = activeVisit
    ? activeVisit.customEntry
      ? 'Custom Entry'
      : offerings.find((o) => o.id === activeVisit.offeringId)?.name || membership?.planName || 'Gym access'
    : '';
  const activeHeading = activeVisit ? activeAccessHeading(activeVisit) : 'ACTIVE VISIT';
  const activeDurationLabel = activeVisit ? gymVisitDurationLabel(activeVisit, nowTick) : '';
  // A visitor pass that is already being used cannot be bought again; the same
  // rule is enforced on the server, so hiding it here is presentation only.
  const passLocked = isCheckedIn;

  type BottomCtaState =
    | 'checked_in'
    | 'queued'
    | 'awaiting_payment'
    | 'selected'
    | 'scan'
    | 'renew'
    | 'choose_access';
  const bottomCtaState: BottomCtaState = isCheckedIn
    ? 'checked_in'
    : isQueued
    ? 'queued'
    : awaitingPayment
    ? 'awaiting_payment'
    : hasValidAccess
    ? 'scan'
    : selectedOffering
    ? 'selected'
    : isExpiredMember
    ? 'renew'
    : 'choose_access';

  const bottomCtaLabel: Record<BottomCtaState, string> = {
    checked_in: 'Check Out',
    queued: 'In Entry Queue\u2026',
    awaiting_payment: 'Waiting for gym',
    selected: 'Payment',
    scan: 'Scan to Check In',
    renew: 'Renew Membership',
    choose_access: 'Choose Access',
  };

  const durationText = (o: GymOffering) =>
    `${o.durationValue} ${o.durationUnit}${o.durationValue === 1 ? '' : 's'}`;

  // Coupon breakdown for the Payment sheet. This reuses the SAME
  // evaluateCoupon engine the Salon price breakdown and the server use \u2014 no
  // second discount implementation. `eligibleServiceIds` is a salon-services
  // concept that gym offerings have no ids in, so an offer restricted to
  // specific services simply will not apply here; nothing is invented.
  const paymentOffer = (salon.offers || []).find((offer) => offer.id === appliedOfferId);
  const paymentSubtotalInr = selectedOffering?.priceInr ?? 0;
  const paymentCoupon = paymentOffer
    ? evaluateCoupon(paymentOffer, { subtotalInr: paymentSubtotalInr, serviceIds: [] })
    : undefined;
  const discountInr = paymentCoupon?.eligible ? paymentCoupon.discountInr : 0;
  const finalAmountInr = Math.max(0, paymentSubtotalInr - discountInr);

  const handleSelfCheckout = async () => {
    if (!myMembership?.activeVisit || checkoutBusy) return;
    if (!window.confirm(`Are you leaving ${salon.name}?`)) return;
    setCheckoutBusy(true);
    try {
      await gymCustomerService.selfCheckout(salon.id, myMembership.activeVisit.id);
      setBookingSuccessMessage('✓ Checked out. See you next time!');
      setTimeout(() => setBookingSuccessMessage(null), 4000);
      await refreshMine();
      const updated = await gymCustomerService.getPublicOverview(salon.id);
      setOverview(updated);
    } catch (err: any) {
      setBookingSuccessMessage(err.message || 'Unable to check you out right now.');
      setTimeout(() => setBookingSuccessMessage(null), 5000);
    } finally {
      setCheckoutBusy(false);
    }
  };

  // Opens the premium access sheet. `upgrade` sources the same real
  // offerings but frames them as an upgrade of the visit already in progress.
  const openAccessSheet = (upgrade = false) =>
    requireReady('offering', () => {
      setUpgradeMode(upgrade);
      setPurchaseError('');
      setOfferingPickerOpen(true);
    });

  const handleBottomCta = () => {
    if (bottomCtaState === 'checked_in') {
      void handleSelfCheckout();
      return;
    }
    if (bottomCtaState === 'queued' || bottomCtaState === 'awaiting_payment') return;
    if (bottomCtaState === 'scan') {
      requireReady('scan', () => setQrScannerOpen(true));
      return;
    }
    // State B -> the payment sheet. Still no visit, still no Inside Now change.
    if (bottomCtaState === 'selected') {
      requireReady('offering', () => {
        setPaymentMethod(
          selectedOffering?.paymentOptions.includes('cash') ? 'cash' : 'online',
        );
        setPurchaseError('');
        setPaymentSheetOpen(true);
      });
      return;
    }
    // renew or choose_access both open the access sheet.
    openAccessSheet(false);
  };

  // The dock's expanded state sits on an opaque white "lens" (dark text
  // reads fine there, same as Salon's light page); its collapsed state is a
  // much more translucent glass that lets this page's own dark background
  // bleed through, so the same dark text goes unreadable — collapsed rows
  // switch to light text instead.
  const dockExpanded = bottomCtaState === 'selected' || bottomCtaState === 'checked_in' || bottomCtaState === 'awaiting_payment';

  return (
    <div id="gym-detail-page" className="min-h-full bg-[#0A0714] pb-[calc(8.5rem+env(safe-area-inset-bottom))] text-white">
      {/* Bottom padding matches the Salon page: enough clearance for the
          shared sticky dock at its tallest (expanded summary + action row)
          plus the device safe area, so the last section is never hidden
          behind it at customer mobile width. */}
      {/* Toast Notification Banner */}
      {bookingSuccessMessage && (
        <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between rounded-xl border border-[var(--category-primary-dark)]/40 bg-[var(--category-primary-dark)] px-4 py-3 text-xs font-bold text-white shadow-lg animate-in fade-in slide-in-from-top-2">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--category-accent)]" />
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
      <div className="relative bg-[#120B1D] text-white">
        <GymHeroGallery gallery={salon.gallery} coverImageUrl={salon.coverImageUrl} name={salon.name} />
        <div className="pointer-events-none absolute inset-0">
          {/* Top Bar Navigation */}
          <div className="pointer-events-auto absolute top-4 left-4 right-4 flex items-center justify-between">
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
                className={`flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95 ${saved ? 'bg-white text-[var(--category-primary-dark)]' : 'bg-black/40 text-white'}`}
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
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${salon.isOpen ? 'bg-[#5EE0B4] open-dot-bounce' : 'bg-[#E58C82]'}`} />
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/80">{salon.isOpen ? 'Open now' : 'Closed'}</span>
          </div>

          <AnimatedSalonName name={salon.name} className="mt-1 text-2xl font-bold leading-tight tracking-[-0.03em] text-white [overflow-wrap:anywhere]" />

          <div className="mt-1">
            <RatingSummaryBadge businessId={salon.id} tone="dark" />
          </div>

          <p className="mt-1 text-xs font-medium text-[var(--category-accent,#C084FC)]">
            Fitness & Strength Center · {salon.distanceKm} km away
          </p>

          <button
            type="button"
            id="gym-address-row"
            onClick={() => setAddressSheetOpen(true)}
            aria-label="View gym address and contact"
            className="mt-3 flex w-full items-start gap-1.5 text-left text-[11px] leading-4 text-white/75 underline decoration-white/25 underline-offset-2 transition active:text-white"
          >
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{salon.address}</span>
          </button>
        </div>
      </div>

      {/* Premium action tiles — same interaction pattern as the salon detail page. */}
      <div className="px-5 pt-4">
        <div className="grid grid-cols-4 gap-2.5">
          {(salon.quickActions && salon.quickActions.length ? salon.quickActions : defaultQuickActions())
            .filter((action) => action.visible)
            .map((action) => {
              // Every action's real behavior is fixed by its trusted `type`
              // — an owner can restyle/relabel/hide/reorder a slot, never
              // repoint Directions/Been-here at an arbitrary URL.
              const Icon = gymProfileIcon(action.iconKey);
              if (action.type === 'schedule') {
                return <QuickAction key={action.id} icon={<Icon />} label={action.label} onClick={() => setOpenHoursSheetOpen(true)} surfaceGradient={GYM_QUICK_ACTION_GRADIENT} />;
              }
              if (action.type === 'directions') {
                return <QuickAction key={action.id} icon={<Icon />} label={action.label} onClick={() => setDirectionsSheetOpen(true)} surfaceGradient={GYM_QUICK_ACTION_GRADIENT} />;
              }
              if (action.type === 'branches') {
                return <QuickAction key={action.id} icon={<Icon />} label={action.label} secondary={branches.length ? `${branches.length} nearby` : undefined} onClick={() => setBranchesSheetOpen(true)} surfaceGradient={GYM_QUICK_ACTION_GRADIENT} />;
              }
              // been_here — a valid membership is trusted system state that
              // always outranks the owner's cosmetic label/icon for this slot.
              if (membership && membership.displayStatus !== 'expired') {
                return (
                  <QuickAction
                    key={action.id}
                    icon={<BadgeCheck />}
                    label="✓ MEMBER"
                    active
                    secondary={`${membership.daysRemaining} DAYS LEFT`}
                    onClick={() => setBeenHereSheetOpen(true)}
                    surfaceGradient={GYM_QUICK_ACTION_MEMBER_GRADIENT}
                  />
                );
              }
              return <QuickAction key={action.id} icon={<Icon />} label={visited ? 'Visited' : action.label} active={visited} onClick={() => setBeenHereSheetOpen(true)} surfaceGradient={GYM_QUICK_ACTION_GRADIENT} />;
            })}
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

        {/* MEMBERSHIP & ATTENDANCE — real, server-backed identity for this gym. */}
        <div id="gym-membership-section" className="space-y-3">
          {membership ? (
            <div className="rounded-2xl border border-[var(--category-primary-dark)]/20 bg-white/[0.04] p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-[var(--category-accent)]" />
                  <h2 className="text-xs font-extrabold text-white">{membership.planName}</h2>
                </div>
                <span
                  className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                    membership.displayStatus === 'expired'
                      ? 'bg-rose-500/15 text-rose-300'
                      : membership.displayStatus === 'expires_today' || membership.displayStatus === 'expiring_soon'
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-[var(--category-tint-10)] text-[var(--category-accent)]'
                  }`}
                >
                  {membership.displayStatus === 'expired'
                    ? 'Expired'
                    : membership.displayStatus === 'expires_today'
                    ? 'Expires today'
                    : membership.displayStatus === 'expiring_soon'
                    ? 'Expiring soon'
                    : 'Active'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/50">
                {membership.displayStatus === 'expired'
                  ? `Expired on ${new Date(membership.expiryDate).toLocaleDateString()}`
                  : `${membership.daysRemaining} day${membership.daysRemaining === 1 ? '' : 's'} left · valid till ${new Date(membership.expiryDate).toLocaleDateString()}`}
              </p>

              {myMembership?.attendance && (
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-black/20 p-2">
                    <div className="text-sm font-extrabold text-white">{myMembership.attendance.visitsThisMonth}</div>
                    <div className="text-[9px] font-semibold text-white/50">This month</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2">
                    <div className="text-sm font-extrabold text-white">{myMembership.attendance.avgVisitsPerWeek.toFixed(1)}</div>
                    <div className="text-[9px] font-semibold text-white/50">Avg/week</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2">
                    <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-[var(--category-accent)]">
                      <Flame className="h-3.5 w-3.5" />
                      {myMembership.attendance.currentStreak}
                    </div>
                    <div className="text-[9px] font-semibold text-white/50">Streak</div>
                  </div>
                  <div className="rounded-xl bg-black/20 p-2">
                    <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-white">
                      <TrendingUp className="h-3.5 w-3.5 text-[var(--category-accent)]" />
                      {myMembership.attendance.bestStreak}
                    </div>
                    <div className="text-[9px] font-semibold text-white/50">Best</div>
                  </div>
                </div>
              )}
            </div>
          ) : myMembership?.pendingClaim ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-xs font-semibold text-amber-200">
              Your membership claim is pending gym approval. You'll see your member status here once the front desk verifies it.
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
              <div>
                <h2 className="text-xs font-extrabold text-white">Already a member here?</h2>
                <p className="mt-0.5 text-[11px] text-white/50">Link your existing membership for a "Scan to Check In" pass.</p>
              </div>
              <button
                onClick={() => requireReady('claim', () => setClaimModalOpen(true))}
                className="shrink-0 rounded-xl border border-[var(--category-primary-dark)]/30 bg-white/[0.06] px-3.5 py-2 text-[11px] font-bold text-[var(--category-accent)] transition active:scale-95"
              >
                I'm Already a Member
              </button>
            </div>
          )}
        </div>

        {/* 3. TODAY'S CLASSES */}
        <div id="gym-classes-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Today's Scheduled Classes</h2>
              <p className="text-[11px] text-white/50">Book group workout sessions</p>
            </div>
            <span className="text-[11px] font-bold text-[var(--category-accent)]">
              {(overview?.classesToday || []).length} Available Today
            </span>
          </div>

          <div className="space-y-2.5">
            {(overview?.classesToday ?? []).map((c) => {
              const seatsLeft = c.maxCapacity - c.enrolled;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
                  <div>
                    <h3 className="text-xs font-extrabold text-white">{c.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-[var(--category-accent)]" />
                        {c.time}
                      </span>
                      <span>·</span>
                      <span>{c.trainer}</span>
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-[var(--category-accent)]">
                      {seatsLeft > 0 ? `${seatsLeft} seats left (${c.enrolled}/${c.maxCapacity} enrolled)` : 'Full'}
                    </div>
                  </div>

                  <button
                    onClick={() => setClassBookingModalOpen(c)}
                    disabled={seatsLeft <= 0}
                    className="rounded-xl bg-[var(--category-primary-dark)] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-40"
                  >
                    Book Class
                  </button>
                </div>
              );
            })}
            {!loading && (overview?.classesToday ?? []).length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-white/40">No classes scheduled today.</p>
            )}
          </div>
        </div>

        {/* 4. TRAINERS & COACHES */}
        <div id="gym-trainers-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white">Certified Coaches & Trainers</h2>
              <p className="text-[11px] text-white/50">1-on-1 personal training experts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(overview?.trainers ?? []).map((t) => (
              <div key={t.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-white">{t.name}</h3>
                    <p className="text-[11px] font-semibold text-[var(--category-accent)]">{t.role}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold ${
                    t.status === 'Available' ? 'bg-[var(--category-tint-10)] text-[var(--category-accent)]' : 'bg-amber-500/15 text-amber-300'
                  }`}>
                    {t.status}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-white/50">
                  <span className="flex items-center gap-1 font-bold text-amber-400">
                    ★ {t.rating} ({t.reviewCount})
                  </span>
                  <span>Next: {t.nextSlot || 'Available'}</span>
                </div>

                <button
                  onClick={() => {
                    setSelectedTrainer(t);
                    setPtBookingModalOpen(true);
                  }}
                  className="mt-3 w-full rounded-xl border border-[var(--category-primary-dark)]/30 bg-white/[0.06] py-2 text-xs font-bold text-[var(--category-accent)] transition hover:bg-[var(--category-tint-10)] active:scale-98"
                >
                  Book 1-on-1 PT
                </button>
              </div>
            ))}
          </div>
          {!loading && (overview?.trainers ?? []).length === 0 && (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-white/40">No trainers listed yet.</p>
          )}
        </div>

        {/* 6. SERVICES & PASSES — real owner-defined offerings, not mock services. */}
        <div id="gym-passes-section" className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-white">Gym Passes & Memberships</h2>
            <p className="text-[11px] text-white/50">Buy a visitor pass or membership</p>
          </div>

          <div className="space-y-2.5">
            {offerings.map((offering) => {
              // Active-pass transform (Parts 15-16): while a visit is genuinely
              // open, the pass powering it stops being a buyable card and
              // becomes a live status card. Every other pass is locked out too,
              // so a second concurrent visit can't even be started — and the
              // server refuses it independently, this is not a UI-only guard.
              const isActivePass =
                isCheckedIn && !!activeVisit && activeVisit.offeringId === offering.id;
              const isSelected = selectedOffering?.id === offering.id;
              return (
              <div
                key={offering.id}
                className={`rounded-2xl border bg-white/[0.04] p-4 transition ${
                  isActivePass
                    ? 'border-[var(--category-primary-dark)] shadow-[0_10px_28px_-18px_var(--category-glow)]'
                    : isSelected
                    ? 'border-[var(--category-primary-dark)]/60 shadow-[0_8px_22px_-16px_var(--category-glow)]'
                    : 'border-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${isActivePass ? 'bg-[var(--category-primary-dark)] text-white' : 'bg-[var(--category-tint-10)] text-[var(--category-accent)]'}`}>
                        {isActivePass ? 'Visit pass · Active' : offering.type.replace('_', ' ')}
                      </span>
                      <h3 className="text-xs font-extrabold text-white">{offering.name}</h3>
                    </div>
                    <p className="mt-1 text-[11px] text-white/50">
                      {isActivePass
                        ? `Inside · ${activeDurationLabel}`
                        : offering.description || 'Full equipment and facility access included.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-white">₹{offering.priceInr}</div>
                    <div className="text-[10px] font-semibold text-white/50">{durationText(offering)}</div>
                  </div>
                </div>
                {isActivePass ? (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--category-primary-dark)]/30 bg-[var(--category-tint-10)] py-2 text-xs font-extrabold text-[var(--category-accent)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ✓ ACTIVE VISIT · {activeDurationLabel}
                  </div>
                ) : passLocked ? (
                  <button
                    onClick={() => openAccessSheet(true)}
                    className="mt-3 w-full rounded-xl border border-[var(--category-primary-dark)]/35 bg-white/[0.06] py-2 text-xs font-bold text-[var(--category-accent)] transition active:scale-95"
                  >
                    Upgrade
                  </button>
                ) : (
                  <button
                    onClick={() =>
                      requireReady('offering', () => {
                        setSelectedOffering(offering);
                        setPurchaseError('');
                      })
                    }
                    className={`group relative mt-3 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl py-2.5 text-xs font-extrabold shadow-[0_10px_20px_-12px_var(--category-glow)] transition active:scale-[0.98] ${
                      isSelected ? 'bg-[var(--category-primary-dark)] text-white' : 'bg-[var(--category-primary-dark)] text-white'
                    }`}
                  >
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" aria-hidden="true" />
                    <span className="relative">{isSelected ? '✓ Selected' : 'Choose Access'}</span>
                    {!isSelected && <ChevronRight className="relative h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              );
            })}
            {!loading && offerings.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center text-xs text-white/40">No passes published yet. Check back soon.</p>
            )}
          </div>
        </div>

        {/* 6b. ABOUT — moved out of the hero (which now only carries the
            open-status, name, category/distance and address, matching the
            Salon Detail hierarchy) so the real description still has a
            home, just not crammed above the fold. */}
        {salon.description && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">About {salon.name}</h2>
            <p className={`mt-2 text-xs leading-5 text-white/70 ${aboutExpanded ? '' : 'line-clamp-3'}`}>{salon.description}</p>
            <button onClick={() => setAboutExpanded((value) => !value)} className="mt-2 flex items-center gap-1 text-xs font-bold text-[var(--category-accent)]">
              Read {aboutExpanded ? 'less' : 'more'}
            </button>
          </div>
        )}

        {/* 7. FACILITIES / AMENITIES */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Gym Facilities & Amenities</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {(salon.amenityDetails && salon.amenityDetails.length ? salon.amenityDetails.filter((a) => a.active) : [
              { id: 'd1', name: 'Strength Zone', iconKey: 'Dumbbell' as const },
              { id: 'd2', name: 'Cardio Deck', iconKey: 'HeartPulse' as const },
              { id: 'd3', name: 'Sauna & Recovery Spa', iconKey: 'Flame' as const },
              { id: 'd4', name: 'Locker Room', iconKey: 'Locker' as const },
              { id: 'd5', name: 'Shower', iconKey: 'ShowerHead' as const },
              { id: 'd6', name: 'Parking', iconKey: 'ParkingCircle' as const },
              { id: 'd7', name: 'Wi-Fi', iconKey: 'Wifi' as const },
            ]).map((amenity) => {
              const AmenityIcon = gymProfileIcon(amenity.iconKey);
              return (
                <span key={amenity.id} className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white">
                  <AmenityIcon className="h-3.5 w-3.5 text-[var(--category-accent)]" />
                  {amenity.name}
                </span>
              );
            })}
          </div>
        </div>

        {/* 7b. SOCIAL & LINKS — Detail page only, never the Home listing card.
            Only owner-enabled, resolvable links ever appear here. */}
        {salon.socialLinks && salon.socialLinks.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/50">Social & Links</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {salon.socialLinks.map((link) => {
                const SocialIcon = socialPlatformIcon(link.platform);
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-[0.97]"
                  >
                    <SocialIcon className="h-3.5 w-3.5 text-[var(--category-accent)]" />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. OFFERS & COUPONS */}
        {salon.offers && salon.offers.length > 0 && (
          <div className="rounded-2xl border border-[var(--category-primary-dark)]/20 bg-[var(--category-tint-10)] p-4">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[var(--category-accent)]" />
              <h2 className="text-xs font-extrabold text-[var(--category-accent)]">Active Gym Offers & Coupons</h2>
            </div>
            <div className="mt-2.5 space-y-2">
              {salon.offers.map((offer) => (
                <div key={offer.id} className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-xs">
                  <div>
                    <div className="font-bold text-white">{offer.title}</div>
                    <div className="text-[10px] text-white/50">{offer.discount} · Code: {offer.code || 'GYM20'}</div>
                  </div>
                  {onApplyOffer && (
                    <button
                      onClick={() => onApplyOffer(offer.id)}
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                        appliedOfferId === offer.id ? 'bg-[var(--category-primary-dark)] text-white' : 'border border-[var(--category-primary-dark)] text-[var(--category-primary-dark)]'
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

        {/* 9. REVIEWS — real ratings/reviews shared with Owner Dashboard and
            Admin; average/count always computed from the same rows. */}
        <PublicReviewsSection
          businessId={salon.id}
          ready={readiness.kind === 'ready'}
          onRequireReady={() => requireReady('review', () => {})}
          tone="dark"
        />
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
                <span className="font-bold text-[var(--category-primary-dark)]">{classBookingModalOpen.enrolled}/{classBookingModalOpen.maxCapacity} Enrolled</span>
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
                className="flex-1 rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white shadow-sm"
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
                <span className="font-bold text-[var(--category-primary-dark)]">{selectedTrainer.nextSlot || 'Today 04:00 PM'}</span>
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
                className="flex-1 rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white shadow-sm"
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

      {/* The one Gym CTA state machine, riding the shared premium
          <CategoryActionBar> — the same dock material, radius, safe-area
          handling and motion the Salon detail page uses, with Gym's own
          content. States:
            A  choose_access     nothing selected -> "Choose Access"
            B  selected          access + price + validity -> "Payment"
               awaiting_payment  a real pending payment exists -> waiting
               scan              entitled but not physically in -> QR
               checked_in        ACTIVE VISIT/MEMBERSHIP + live duration
          Crucially: A and B change nothing server-side, and paying only
          creates a pending payment. Inside Now moves only when the gym
          confirms. The dock expands (opaque lens material + summary row) the
          moment there is something real to read. */}
      <CategoryActionBar
        id="gym-action-bar"
        expanded={dockExpanded}
        summary={
          bottomCtaState === 'selected' && selectedOffering ? (
            <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-[#12332E]">{selectedOffering.name}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[#4A5D5A]">Valid for {durationText(selectedOffering)}</span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-[#0B1F1C]">₹{selectedOffering.priceInr}</span>
            </div>
          ) : bottomCtaState === 'checked_in' && activeVisit ? (
            <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-[#12332E]">{activeAccessName}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[#4A5D5A]">
                  Since {formatGymClock(activeVisit.checkedInAt)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => openAccessSheet(true)}
                className="shrink-0 rounded-lg border border-[var(--category-primary-dark)]/40 bg-white/70 px-3 py-1.5 text-[10px] font-extrabold text-[var(--category-primary-dark)]"
              >
                Upgrade
              </button>
            </div>
          ) : bottomCtaState === 'awaiting_payment' && awaitingPayment ? (
            <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-[#12332E]">{awaitingPayment.offeringName}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[#4A5D5A]">
                  {awaitingPayment.status === 'paid'
                    ? 'Paid · the gym will check you in'
                    : awaitingPayment.method === 'cash'
                    ? 'Pay at the front desk to start your visit'
                    : 'Awaiting payment confirmation'}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-[#0B1F1C]">₹{awaitingPayment.amountInr}</span>
            </div>
          ) : null
        }
      >
        <div className="flex min-w-0 flex-col justify-center pl-1">
          <div className={`text-[10px] font-bold uppercase tracking-wider ${dockExpanded ? 'text-[#4A5D5A]' : 'text-white/60'}`}>
            {bottomCtaState === 'checked_in'
              ? activeHeading
              : bottomCtaState === 'queued'
              ? 'Entry queue'
              : bottomCtaState === 'awaiting_payment'
              ? 'Payment pending'
              : 'Gym access'}
          </div>
          <div className={`truncate text-xs font-extrabold ${dockExpanded ? 'text-[#12332E]' : 'text-white'}`}>
            {bottomCtaState === 'checked_in'
              ? `Inside · ${activeDurationLabel}`
              : bottomCtaState === 'queued'
              ? 'Waiting for a space'
              : bottomCtaState === 'awaiting_payment'
              ? 'Waiting for the gym to confirm'
              : bottomCtaState === 'selected' && selectedOffering
              ? `₹${selectedOffering.priceInr} · ${durationText(selectedOffering)}`
              : bottomCtaState === 'scan'
              ? membership?.planName || myMembership?.paidPass?.offeringName || 'Ready to check in'
              : bottomCtaState === 'renew'
              ? membership?.planName || 'Membership expired'
              : 'Select an access option to continue'}
          </div>
        </div>
        <button
          id="gym-primary-cta"
          onClick={handleBottomCta}
          disabled={
            bottomCtaState === 'queued' ||
            bottomCtaState === 'awaiting_payment' ||
            scanBusy ||
            (bottomCtaState === 'checked_in' && checkoutBusy)
          }
          className={`relative flex min-h-13 shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-2xl px-5 text-xs font-extrabold text-white shadow-[0_10px_20px_-10px_var(--category-glow)] transition active:scale-[0.98] disabled:opacity-70 ${
            bottomCtaState === 'renew' ? 'bg-amber-600' : 'bg-[var(--category-primary-dark)]'
          }`}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" aria-hidden="true" />
          {bottomCtaState === 'scan' && <QrCode className="relative h-3.5 w-3.5" />}
          <span className="relative">
            {scanBusy
              ? 'Checking in…'
              : bottomCtaState === 'checked_in' && checkoutBusy
              ? 'Checking out…'
              : bottomCtaLabel[bottomCtaState]}
          </span>
        </button>
      </CategoryActionBar>

      {/* Verification gate: opens instead of a gated action (claim / buy / scan)
          when the customer isn't a verified, complete profile yet. */}
      {gateOpen && (() => {
        const gate = resolveAppReadiness(customerAuth, customerProfile, { profileLoading });
        if (gate.kind !== 'onboarding_required') return null;
        return (
          <div className="fixed inset-0 z-[95] bg-[#F8FAFA]">
            <AccountOnboarding
              gate={gate}
              onVerified={(auth) => onIdentityVerified?.(auth)}
              onProfileSaved={(profile) => {
                onProfileSaved?.(profile);
                setGateOpen(false);
                if (gatePendingAction === 'claim') setClaimModalOpen(true);
                else if (gatePendingAction === 'offering') setOfferingPickerOpen(true);
                else if (gatePendingAction === 'scan') setQrScannerOpen(true);
                setGatePendingAction(null);
              }}
              onCancel={() => { setGateOpen(false); setGatePendingAction(null); }}
              intro={{
                eyebrow: 'Verify to continue',
                title: 'One quick check before gym access.',
                description: "Verify your mobile number, then add your name and gender so the gym can recognize you.",
              }}
            />
          </div>
        );
      })()}

      {/* "I'm Already a Member" claim form — creates a pending claim, never a
          self-declared verified membership. The gym staff approves it. */}
      {claimModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#17201F]">I'm Already a Member</h3>
              <button onClick={() => setClaimModalOpen(false)} aria-label="Close">
                <X className="h-4 w-4 text-[#6F7C7A]" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[#6F7C7A]">Tell us your existing membership details. The gym will verify and approve it.</p>
            <div className="mt-4 space-y-2.5">
              <input
                value={claimName}
                onChange={(e) => setClaimName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-xl border border-[#DDE5E3] px-3 py-2.5 text-xs outline-none focus:border-[var(--category-primary-dark)]"
              />
              <input
                value={claimMobile}
                onChange={(e) => setClaimMobile(e.target.value)}
                placeholder="Mobile number"
                className="w-full rounded-xl border border-[#DDE5E3] px-3 py-2.5 text-xs outline-none focus:border-[var(--category-primary-dark)]"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#6F7C7A]">Joining date</label>
                  <input
                    type="date"
                    value={claimJoinDate}
                    onChange={(e) => setClaimJoinDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#DDE5E3] px-3 py-2.5 text-xs outline-none focus:border-[var(--category-primary-dark)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#6F7C7A]">Expiry date</label>
                  <input
                    type="date"
                    value={claimExpiryDate}
                    onChange={(e) => setClaimExpiryDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#DDE5E3] px-3 py-2.5 text-xs outline-none focus:border-[var(--category-primary-dark)]"
                  />
                </div>
              </div>
              <input
                value={claimPlanText}
                onChange={(e) => setClaimPlanText(e.target.value)}
                placeholder="Plan name (optional)"
                className="w-full rounded-xl border border-[#DDE5E3] px-3 py-2.5 text-xs outline-none focus:border-[var(--category-primary-dark)]"
              />
              {claimError && <p className="text-[11px] font-semibold text-rose-600">{claimError}</p>}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setClaimModalOpen(false)} className="flex-1 rounded-xl border border-[#DDE5E3] py-2.5 text-xs font-bold text-[#17201F]">
                Cancel
              </button>
              <button
                onClick={submitClaim}
                disabled={claimBusy}
                className="flex-1 rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
              >
                {claimBusy ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access sheet — the same sheet backs "Choose Access" and "Upgrade".
          "Recommended for you" is rendered ONLY from offerings the owner
          actually flagged (GymOffering.recommended); when nothing is flagged
          the section does not exist at all — no auto-promoting the priciest
          plan. Plan names are never hardcoded here. */}
      {offeringPickerOpen && (() => {
        const sections = splitRecommendedOfferings(offerings, {
          excludeOfferingId: upgradeMode ? activeVisit?.offeringId : undefined,
        });
        const Card: React.FC<{ offering: GymOffering }> = ({ offering }) => (
          <button
            type="button"
            onClick={() => {
              setSelectedOffering(offering);
              setPurchaseError('');
              setOfferingPickerOpen(false);
              // Upgrading from an active visit goes straight to payment;
              // from state A the customer lands in state B on the dock first.
              if (upgradeMode) {
                setPaymentMethod(offering.paymentOptions.includes('cash') ? 'cash' : 'online');
                setPaymentSheetOpen(true);
              }
            }}
            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[#DDE5E3] bg-white p-3.5 text-left transition active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-xs font-extrabold text-[#17201F]">{offering.name}</span>
              <span className="mt-0.5 block text-[11px] text-[#6F7C7A]">
                {offering.description || `Valid for ${durationText(offering)}`}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-extrabold text-[#17201F]">₹{offering.priceInr}</span>
              <span className="block text-[10px] font-semibold text-[#6F7C7A]">{durationText(offering)}</span>
            </span>
          </button>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-t-[28px] bg-[#F8FAFA] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D4DEDC]" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F7C7A]">
                    {upgradeMode ? 'Upgrade your access' : 'Gym access'}
                  </p>
                  <h3 className="text-base font-extrabold text-[#17201F]">
                    {upgradeMode ? 'Move up to a bigger plan' : 'Choose your access'}
                  </h3>
                </div>
                <button onClick={() => { setOfferingPickerOpen(false); setUpgradeMode(false); }} aria-label="Close">
                  <X className="h-4 w-4 text-[#6F7C7A]" />
                </button>
              </div>
              <div className="mt-4 max-h-[55vh] space-y-4 overflow-y-auto">
                {sections.recommended.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--category-primary-dark)]">Recommended for you</p>
                    {sections.recommended.map((offering) => <Card key={offering.id} offering={offering} />)}
                  </div>
                )}
                {sections.others.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#6F7C7A]">
                      {sections.recommended.length > 0 ? 'Other options' : 'Available access'}
                    </p>
                    {sections.others.map((offering) => <Card key={offering.id} offering={offering} />)}
                  </div>
                )}
                {sections.recommended.length === 0 && sections.others.length === 0 && (
                  <p className="rounded-2xl border border-[#DDE5E3] bg-white p-4 text-center text-xs text-[#788582]">
                    {upgradeMode
                      ? 'No other access options are published right now.'
                      : 'This gym has not published any access options yet.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Payment sheet — the same price/coupon breakdown language the Salon
          flow uses, on real numbers. Nothing here settles money by itself:
          "Cash at gym" creates a real pending payment the gym must accept,
          and the online path is honestly disabled until a real gateway is
          integrated rather than faking a successful capture. */}
      {paymentSheetOpen && selectedOffering && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D4DEDC]" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6F7C7A]">Payment</p>
                <h3 className="text-base font-extrabold text-[#17201F]">{selectedOffering.name}</h3>
              </div>
              <button onClick={() => setPaymentSheetOpen(false)} aria-label="Close">
                <X className="h-4 w-4 text-[#6F7C7A]" />
              </button>
            </div>

            <div className="mt-4 space-y-2 rounded-2xl bg-[#F8FAFA] p-4 text-xs">
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Selected access</span>
                <span className="font-bold text-[#17201F]">{selectedOffering.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Validity</span>
                <span className="font-bold text-[#17201F]">{durationText(selectedOffering)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6F7C7A]">Price</span>
                <span className="font-bold text-[#17201F]">₹{paymentSubtotalInr}</span>
              </div>
              {discountInr > 0 && paymentOffer && (
                <div className="flex justify-between text-[var(--category-primary-dark)]">
                  <span className="flex items-center gap-1 font-semibold"><Tag className="h-3 w-3" />{paymentOffer.title}</span>
                  <span className="font-bold">− ₹{discountInr}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-[#E4ECEA] pt-2">
                <span className="font-bold text-[#17201F]">Final amount</span>
                <span className="text-sm font-extrabold text-[var(--category-primary-dark)]">₹{finalAmountInr}</span>
              </div>
            </div>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#6F7C7A]">Payment method</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['online', 'cash'] as const).map((method) => {
                const offered = selectedOffering.paymentOptions.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={!offered}
                    onClick={() => setPaymentMethod(method)}
                    className={`rounded-xl border px-3 py-2.5 text-[11px] font-bold transition disabled:opacity-40 ${
                      paymentMethod === method
                        ? 'border-[var(--category-primary-dark)] bg-[var(--category-tint-10)] text-[var(--category-primary-dark)]'
                        : 'border-[#DDE5E3] bg-white text-[#17201F]'
                    }`}
                  >
                    {method === 'online' ? 'ONLINE' : 'CASH AT GYM'}
                  </button>
                );
              })}
            </div>
            {paymentMethod === 'online' && (
              <p className="mt-2 rounded-xl bg-[#FFF7ED] px-3 py-2 text-[10px] font-semibold text-[#9A5B12]">
                Online payment is not live at this gym yet — no card or UPI gateway is connected, so we won't pretend a payment went through. Choose “Cash at gym”.
              </p>
            )}
            <p className="mt-3 text-[10px] leading-4 text-[#6F7C7A]">
              Paying reserves your access. It does not check you in — your visit starts, and the gym's Inside count changes, only once the front desk confirms you're here.
            </p>
            {purchaseError && <p className="mt-3 text-[11px] font-semibold text-rose-600">{purchaseError}</p>}
            <button
              id="gym-pay-btn"
              onClick={() => submitPurchase(paymentMethod)}
              disabled={purchaseBusy}
              className="mt-4 w-full rounded-xl bg-[var(--category-primary-dark)] py-3 text-xs font-extrabold text-white shadow-[0_10px_20px_-10px_var(--category-glow)] transition active:scale-[0.98] disabled:opacity-60"
            >
              {purchaseBusy
                ? 'Reserving…'
                : paymentMethod === 'cash'
                ? `Reserve & pay ₹${finalAmountInr} at gym`
                : `Pay ₹${finalAmountInr} online`}
            </button>
          </div>
        </div>
      )}

      {purchaseResultMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--category-primary-dark)]" />
            <p className="mt-3 text-sm font-semibold text-[#17201F]">{purchaseResultMsg}</p>
            <button
              onClick={() => setPurchaseResultMsg(null)}
              className="mt-5 w-full rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white shadow-sm"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Scan to Check In — the mandatory QR gate. Server validates gym
          binding, entitlement, duplicate check-in and capacity; this page
          only surfaces the outcome, it never decides check-in itself. */}
      <QrScannerModal open={qrScannerOpen} onClose={() => setQrScannerOpen(false)} onResolved={handleScanResolved} />
    </div>
  );
};
