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
  Crown,
  CalendarDays,
} from 'lucide-react';
import { NearbySalon, Salon, SalonOffer, ServiceItem, CustomerAuthSession, CustomerProfile } from '../types';
import { fetchSalonProfile } from '../services/salonDiscoveryService';
import { gymCustomerService, GymPublicOverview, GymClass, GymTrainer, GymOffering, GymMyMembershipResponse } from '../services/gymCustomerService';
import { businessQrService, type QrBusiness } from '../services/businessQrService';
import { evaluateCoupon, offerDiscountLabel } from '../shared/couponPricing';
import { CategoryGlassSheet } from './CategoryGlassSheet';
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
import { workoutPlanService, todaysWorkoutDay, nextWorkoutDay, workoutDayLabel, type WorkoutPlan, type WorkoutDay } from '../services/workoutPlanService';
import { TodaysWorkoutSheet } from './TodaysWorkoutSheet';
import { AttendanceCalendarSheet } from './AttendanceCalendarSheet';
import { WorkoutPlanEditor } from './WorkoutPlanEditor';
import { resolveGymAccessBarCopy, type GymAccessBarState } from '../shared/gymAccessBar';

// Gym's own violet/purple quick-action tile surface — QuickAction is shared
// with Salon (which keeps its default teal), so Gym passes its own gradient.
// Sourced from CATEGORY_THEME_MAP.gym.ctaGradient (the single canonical
// source for Gym's CTA gradient) via the --category-cta-gradient custom
// property, rather than a second hardcoded copy of the same two hex stops.
const GYM_QUICK_ACTION_MEMBER_GRADIENT = 'var(--category-cta-gradient)';

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
  // Customer-owned workout plan (see workoutPlanService) — loaded only once
  // there's a real active membership, since the Member card is the only
  // place it's read from here. Setup itself lives in Customer Profile /
  // the empty-state button below, never in this Owner-facing surface.
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [workoutPlanLoaded, setWorkoutPlanLoaded] = useState(false);
  const [workoutSheetDay, setWorkoutSheetDay] = useState<WorkoutDay | null>(null);
  const [attendanceSheetOpen, setAttendanceSheetOpen] = useState(false);
  const [workoutPlanEditorOpen, setWorkoutPlanEditorOpen] = useState(false);
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
  const [claimPrefilled, setClaimPrefilled] = useState(false);
  const [offeringPickerOpen, setOfferingPickerOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<GymOffering | null>(null);
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [purchaseResult, setPurchaseResult] = useState<{ offeringName: string; isMembership: boolean; amountInr: number; method: 'online' | 'cash' } | null>(null);
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
  // Deliberately NOT the same appliedOfferId/onApplyOffer prop the page also
  // receives from the parent (that one is shared cross-page state) — a Gym
  // coupon must never leak into another Gym's or a Salon's payment sheet.
  // Reset below whenever the gym or the selected offering changes.
  const [gymCouponInput, setGymCouponInput] = useState('');
  const [appliedGymOfferId, setAppliedGymOfferId] = useState<string | null>(null);
  const [gymCouponError, setGymCouponError] = useState('');
  useEffect(() => {
    setGymCouponInput('');
    setAppliedGymOfferId(null);
    setGymCouponError('');
  }, [salon.id, selectedOffering?.id]);
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
    if (!cardEl || typeof IntersectionObserver === 'undefined') return;
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

  // Autofill from the verified customer profile the moment the claim form
  // opens, but only once per open — if the customer edits a field afterward
  // (because the gym has them registered under different details) their
  // edit must never be silently overwritten.
  useEffect(() => {
    if (!claimModalOpen) { setClaimPrefilled(false); return; }
    if (claimPrefilled) return;
    setClaimName((current) => current || customerProfile?.name?.trim() || '');
    setClaimMobile((current) => current || customerAuth?.phoneNumber?.trim() || '');
    setClaimPrefilled(true);
  }, [claimModalOpen, claimPrefilled, customerProfile, customerAuth]);

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
      const { payment } = await gymCustomerService.createPurchaseIntent(salon.id, selectedOffering.id, method, {
        offerId: appliedGymOfferId || undefined,
      });
      setPaymentSheetOpen(false);
      setOfferingPickerOpen(false);
      setPurchaseResult({
        offeringName: selectedOffering.name,
        isMembership: selectedOffering.type === 'membership',
        amountInr: payment.amountInr,
        method,
      });
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
  const isActiveMember = Boolean(membership && membership.displayStatus !== 'expired');

  // Loaded once there's a real active membership — never fetched (and
  // never shown) for a non-member, so nothing here can imply membership
  // that doesn't exist.
  useEffect(() => {
    if (!isActiveMember) { setWorkoutPlan(null); setWorkoutPlanLoaded(false); return; }
    let cancelled = false;
    workoutPlanService.get(salon.id).then(({ plan }) => { if (!cancelled) { setWorkoutPlan(plan); setWorkoutPlanLoaded(true); } }).catch(() => { if (!cancelled) setWorkoutPlanLoaded(true); });
    return () => { cancelled = true; };
  }, [isActiveMember, salon.id]);

  const todaysDay = todaysWorkoutDay(workoutPlan);
  const upcomingDay = todaysDay?.isRest ? nextWorkoutDay(workoutPlan) : null;

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

  const bottomCtaState: GymAccessBarState = isCheckedIn
    ? 'checked_in'
    : isQueued
    ? 'queued'
    : awaitingPayment
    ? 'awaiting_payment'
    : hasValidAccess
    ? 'scan'
    : selectedOffering
    ? 'selected'
    : loading
    ? 'loading_access'
    : offerings.length === 0
    ? 'unavailable'
    : isExpiredMember
    ? 'renew'
    : 'choose_access';

  const durationText = (o: GymOffering) =>
    `${o.durationValue} ${o.durationUnit}${o.durationValue === 1 ? '' : 's'}`;

  const accessBarCopy = resolveGymAccessBarCopy({
    state: bottomCtaState,
    selectedOffering,
    membership,
    paidPassName: myMembership?.paidPass?.offeringName,
    activeHeading,
    activeMain: activeVisit ? `Inside · ${activeDurationLabel}` : undefined,
    pendingName: awaitingPayment?.offeringName,
  });

  // Coupon breakdown for the Payment sheet. This reuses the SAME
  // evaluateCoupon engine the Salon price breakdown and the server use \u2014 no
  // second discount implementation. Gym targets offerings via
  // eligibleOfferingIds (the Salon equivalent, eligibleServiceIds, doesn't
  // apply here \u2014 gym offerings aren't salon services).
  const paymentSubtotalInr = selectedOffering?.priceInr ?? 0;
  const gymOffers = salon.offers || [];
  const paymentOffer = gymOffers.find((offer) => offer.id === appliedGymOfferId);
  const paymentCoupon = paymentOffer && selectedOffering
    ? evaluateCoupon(paymentOffer, { subtotalInr: paymentSubtotalInr, serviceIds: [], offeringId: selectedOffering.id })
    : undefined;
  const discountInr = paymentCoupon?.eligible ? paymentCoupon.discountInr : 0;
  const finalAmountInr = Math.max(0, paymentSubtotalInr - discountInr);

  // "Offers for you" \u2014 every active offer scoped to this business AND this
  // offering (or unscoped, i.e. all Gym Access products), each carrying its
  // own live eligibility so an ineligible one can show a clear reason
  // instead of silently disappearing.
  const offersForSelectedOffering = selectedOffering
    ? gymOffers
        .filter((offer) => offer.active !== false)
        .filter((offer) => !offer.eligibleOfferingIds?.length || offer.eligibleOfferingIds.includes(selectedOffering.id))
        .map((offer) => ({ offer, result: evaluateCoupon(offer, { subtotalInr: paymentSubtotalInr, serviceIds: [], offeringId: selectedOffering.id }) }))
    : [];

  const applyGymCouponCode = () => {
    const code = gymCouponInput.trim();
    if (!code) return;
    const match = gymOffers.find((offer) => (offer.code || '').trim().toLowerCase() === code.toLowerCase());
    if (!match) { setGymCouponError('No offer found for this code.'); return; }
    if (!selectedOffering) { setGymCouponError('This code is not valid right now.'); return; }
    const result = evaluateCoupon(match, { subtotalInr: paymentSubtotalInr, serviceIds: [], offeringId: selectedOffering.id });
    if (result.eligible === false) { setGymCouponError(result.reason); return; }
    setAppliedGymOfferId(match.id);
    setGymCouponError('');
  };

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

  // Upgrade from a SPECIFIC offering card must never re-ask "which plan" —
  // the customer already told us by tapping that card's Upgrade button, so
  // this selects it and opens its Payment sheet directly, skipping the
  // generic "Move up to a bigger plan" picker entirely.
  const openDirectUpgradePayment = (target: GymOffering) =>
    requireReady('offering', () => {
      setSelectedOffering(target);
      setUpgradeMode(true);
      setPurchaseError('');
      setPaymentMethod(target.paymentOptions.includes('cash') ? 'cash' : 'online');
      setPaymentSheetOpen(true);
    });

  const handleBottomCta = () => {
    if (bottomCtaState === 'checked_in') {
      void handleSelfCheckout();
      return;
    }
    if (
      bottomCtaState === 'queued' ||
      bottomCtaState === 'awaiting_payment' ||
      bottomCtaState === 'loading_access' ||
      bottomCtaState === 'unavailable'
    ) return;
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
    <div id="gym-detail-page" className="min-h-full bg-[var(--noq-base)] pb-[calc(8.5rem+env(safe-area-inset-bottom))] text-[var(--noq-ink)]">
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

      {/* 1. GYM HERO / BUSINESS INFO — premium profile hero matching the NOQ
          reference: gallery cover, floating glass controls, a large business
          logo overlapping the cover/identity seam, then the
          open-now/name/category/rating identity block and address. The
          photo stays the visually dominant element — only a short gradient
          right behind the logo/name seam darkens for legibility, never a
          flat opaque rectangle across the whole identity area. */}
      <div className="relative bg-[var(--noq-base)] text-[var(--noq-ink)]">
        <div className="relative">
          <GymHeroGallery gallery={salon.gallery} coverImageUrl={salon.coverImageUrl} name={salon.name} />
          {/* Tiny seam only, just enough for the logo to land on where it
              overlaps the photo — the cover photo itself must stay clearly
              visible at its natural brightness across ~90%+ of its height. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[var(--noq-base)]/70 to-transparent" />
          {/* Top Bar Navigation */}
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto absolute top-4 left-4 right-4 flex items-center justify-between">
              <button
                onClick={onBack}
                id="gym-back-btn"
                aria-label="Back to nearby gyms"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/15 backdrop-blur-md transition active:scale-95"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSaved((value) => !value)}
                  aria-label={saved ? 'Remove saved gym' : 'Save gym'}
                  className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-white/15 backdrop-blur-md transition active:scale-95 ${saved ? 'bg-white text-[var(--category-primary-dark)]' : 'bg-black/40 text-white'}`}
                >
                  <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={shareGym}
                  aria-label="Share gym"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/15 backdrop-blur-md transition active:scale-95"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Identity panel: only the logo overlaps upward into the photo's
            own gradient; the name/category/rating/address text sits on the
            solid base color immediately below the photo, so it's always
            fully legible without needing a large dark overlay on the image
            itself. */}
        <div className="relative px-5 pb-5 pt-0">
          <div className="flex items-end gap-3">
            <div className="-mt-9 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border-[3px] border-[var(--noq-base)] bg-[var(--noq-surface-soft)] text-[var(--category-accent,var(--noq-accent))] shadow-[0_10px_24px_-8px_var(--noq-glow)]">
              {salon.logoImageUrl ? <img src={salon.logoImageUrl} alt={`${salon.name} logo`} className="h-full w-full object-cover" /> : <Dumbbell className="h-8 w-8" />}
            </div>
            <div className="min-w-0 flex-1 pb-0.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${salon.isOpen ? 'bg-[#5EE0B4] open-dot-bounce' : 'bg-[#E58C82]'}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--noq-muted)]">{salon.isOpen ? 'Open now' : 'Closed'}</span>
              </div>

              <AnimatedSalonName name={salon.name} className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.03em] text-[var(--noq-ink)] [overflow-wrap:anywhere]" />

              <p className="mt-0.5 text-xs font-medium text-[var(--category-accent,var(--noq-accent))]">
                Fitness & Strength Center · {salon.distanceKm} km away
              </p>

              <div className="mt-1">
                <RatingSummaryBadge businessId={salon.id} tone="light" />
              </div>
            </div>
          </div>

          <button
            type="button"
            id="gym-address-row"
            onClick={() => setAddressSheetOpen(true)}
            aria-label="View gym address and contact"
            className="mt-3 flex w-full items-start gap-1.5 text-left text-[11px] leading-4 text-[var(--noq-muted)] underline decoration-white/25 underline-offset-2 transition active:text-[var(--noq-ink)]"
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
                return <QuickAction key={action.id} icon={<Icon />} label={action.label} onClick={() => setOpenHoursSheetOpen(true)} tone="gymGlass" />;
              }
              if (action.type === 'directions') {
                return <QuickAction key={action.id} icon={<Icon />} label={action.label} onClick={() => setDirectionsSheetOpen(true)} tone="gymGlass" />;
              }
              if (action.type === 'branches') {
                return <QuickAction key={action.id} icon={<Icon />} label={action.label} secondary={branches.length ? `${branches.length} nearby` : undefined} onClick={() => setBranchesSheetOpen(true)} tone="gymGlass" />;
              }
              // been_here — a valid membership is trusted system state that
              // always outranks the owner's cosmetic label/icon for this slot.
              if (membership && membership.displayStatus !== 'expired') {
                return (
                  <QuickAction
                    key={action.id}
                    icon={<Crown />}
                    goldIcon
                    label="Member"
                    active
                    secondary={`${membership.daysRemaining} DAYS LEFT`}
                    onClick={() => setBeenHereSheetOpen(true)}
                    surfaceGradient={GYM_QUICK_ACTION_MEMBER_GRADIENT}
                  />
                );
              }
              return <QuickAction key={action.id} icon={<Icon />} label={visited ? 'Visited' : action.label} active={visited} onClick={() => setBeenHereSheetOpen(true)} tone="gymGlass" />;
            })}
        </div>
      </div>

      {/* Floating Gym Live Capsule when main card is scrolled out of view.
          Same safe-area-aware, flex-centered wrapper pattern as Salon's own
          floating scoreboard, so it always sits fully inside the viewport
          with breathing room from the top edge on notched devices. */}
      {!isCardVisible && (
        <div className="fixed inset-x-0 top-0 z-[95] flex justify-center px-4 pt-[max(1.4rem,calc(env(safe-area-inset-top)_+_0.6rem))]">
          <div className="capsule-melt-in">
            <GymFloatingCapsule
              currentOccupancy={currentOcc}
              maxCapacity={maxCap}
              availableTrainersCount={overview?.availableTrainersCount ?? 0}
              onTap={() => {
                document.getElementById('gym-live-card')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          </div>
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
          {isActiveMember && membership ? (
            <div
              className="relative overflow-hidden rounded-2xl border p-4 shadow-[0_14px_28px_-18px_rgba(0,0,0,0.7)]"
              style={{ borderColor: 'color-mix(in srgb, var(--category-selected-glow) 25%, transparent)', background: 'linear-gradient(160deg, var(--category-dark-surface) 0%, var(--noq-surface-soft) 75%)' }}
            >
              <div
                className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full blur-3xl"
                style={{ backgroundColor: 'color-mix(in srgb, var(--category-selected-glow) 14%, transparent)' }}
                aria-hidden="true"
              />
              <div className="relative flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-[var(--noq-accent)]">
                  <Crown className="h-3.5 w-3.5 fill-[var(--noq-accent-light)] stroke-[1.75] text-[var(--noq-accent)]" />
                  Active member
                </span>
                <button
                  onClick={() => setAttendanceSheetOpen(true)}
                  aria-label="View membership and attendance calendar"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/75 text-[var(--noq-muted)] transition active:scale-95"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="relative mt-3">
                {!workoutPlanLoaded ? (
                  <div className="h-14 animate-pulse rounded-xl bg-white/70" />
                ) : todaysDay ? (
                  <button
                    type="button"
                    onClick={() => setWorkoutSheetDay(todaysDay)}
                    className="block w-full rounded-xl border border-[var(--noq-glass-border)] bg-white/70 p-3 text-left transition active:scale-[0.99]"
                  >
                    <p className="text-[9px] font-bold uppercase tracking-wider text-[var(--noq-accent)]">
                      {todaysDay.isRest ? 'Today · Recovery day' : `Today · ${todaysDay.label}`}
                    </p>
                    {todaysDay.isRest ? (
                      <p className="mt-0.5 text-xs text-[var(--noq-muted)]">
                        {upcomingDay ? `Next: ${upcomingDay.day.label} · ${upcomingDay.inDays === 1 ? 'Tomorrow' : `in ${upcomingDay.inDays} days`}` : 'Rest and recover.'}
                      </p>
                    ) : (
                      <>
                        <p className="mt-0.5 text-sm font-extrabold text-[var(--noq-ink)]">{todaysDay.label}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--noq-muted)]">{todaysDay.exercises.length} exercise{todaysDay.exercises.length === 1 ? '' : 's'}</p>
                      </>
                    )}
                    {!todaysDay.isRest && (
                      <span className="mt-2 inline-flex items-center gap-1 rounded-lg bg-[var(--noq-accent-deep)] px-2.5 py-1.5 text-[10px] font-bold text-white">
                        View Workout
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWorkoutPlanEditorOpen(true)}
                    className="block w-full rounded-xl border border-dashed border-[var(--noq-glass-border)] bg-white/60 p-3 text-center text-xs font-bold text-[var(--noq-muted)] transition active:scale-[0.99]"
                  >
                    Set up your workout plan
                  </button>
                )}
              </div>

              <p className="relative mt-3 text-[11px] text-[var(--noq-muted)]">
                Member since {new Date(membership.joinedDate).toLocaleDateString()} · Valid till {new Date(membership.expiryDate).toLocaleDateString()}
              </p>
            </div>
          ) : membership ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-rose-600" />
                <h2 className="text-xs font-extrabold text-[var(--noq-ink)]">{membership.planName}</h2>
                <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[9px] font-extrabold uppercase text-rose-700">Expired</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--noq-muted)]">Expired on {new Date(membership.expiryDate).toLocaleDateString()}. Renew to unlock check-in again.</p>
            </div>
          ) : myMembership?.pendingClaim ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
              Your membership claim is pending gym approval. You'll see your member status here once the front desk verifies it.
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 shadow-sm">
              <div>
                <h2 className="text-xs font-extrabold text-[var(--noq-ink)]">Already a member here?</h2>
                <p className="mt-0.5 text-[11px] text-[var(--noq-muted)]">Link your existing membership for a "Scan to Check In" pass.</p>
              </div>
              <button
                onClick={() => requireReady('claim', () => setClaimModalOpen(true))}
                className="shrink-0 rounded-xl border border-[var(--category-primary-dark)]/30 bg-white/75 px-3.5 py-2 text-[11px] font-bold text-[var(--category-accent)] transition active:scale-95"
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
              <h2 className="text-sm font-bold text-[var(--noq-ink)]">Today's Scheduled Classes</h2>
              <p className="text-[11px] text-[var(--noq-muted)]">Book group workout sessions</p>
            </div>
            <span className="text-[11px] font-bold text-[var(--category-accent)]">
              {(overview?.classesToday || []).length} Available Today
            </span>
          </div>

          <div className="space-y-2.5">
            {(overview?.classesToday ?? []).map((c) => {
              const seatsLeft = c.maxCapacity - c.enrolled;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 shadow-sm">
                  <div>
                    <h3 className="text-xs font-extrabold text-[var(--noq-ink)]">{c.title}</h3>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--noq-muted)]">
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
              <p className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 text-center text-xs text-[var(--noq-muted)]">No classes scheduled today.</p>
            )}
          </div>
        </div>

        {/* 4. TRAINERS & COACHES */}
        <div id="gym-trainers-section" className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[var(--noq-ink)]">Certified Coaches & Trainers</h2>
              <p className="text-[11px] text-[var(--noq-muted)]">1-on-1 personal training experts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(overview?.trainers ?? []).map((t) => (
              <div key={t.id} className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-extrabold text-[var(--noq-ink)]">{t.name}</h3>
                    <p className="text-[11px] font-semibold text-[var(--category-accent)]">{t.role}</p>
                  </div>
                  <span className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold ${
                    t.status === 'Available' ? 'bg-[var(--category-tint-10)] text-[var(--category-accent)]' : 'bg-amber-500/15 text-amber-300'
                  }`}>
                    {t.status}
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-[var(--noq-muted)]">
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
                  className="mt-3 w-full rounded-xl border border-[var(--category-primary-dark)]/30 bg-white/75 py-2 text-xs font-bold text-[var(--category-accent)] transition hover:bg-[var(--category-tint-10)] active:scale-98"
                >
                  Book 1-on-1 PT
                </button>
              </div>
            ))}
          </div>
          {!loading && (overview?.trainers ?? []).length === 0 && (
            <p className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 text-center text-xs text-[var(--noq-muted)]">No trainers listed yet.</p>
          )}
        </div>

        {/* 6. SERVICES & PASSES — real owner-defined offerings, not mock services. */}
        <div id="gym-passes-section" className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[var(--noq-ink)]">Gym Passes & Memberships</h2>
            <p className="text-[11px] text-[var(--noq-muted)]">Buy a visitor pass or membership</p>
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
              // The offering backing this customer's CURRENT confirmed access
              // (membership or paid pass), independent of whether they are
              // physically checked in right now. Access state and physical
              // visit state are deliberately separate (Requirement #13):
              // this only ever reflects a real membership/payment record,
              // never an inferred "must be inside" guess.
              const isMine = Boolean(
                hasValidAccess &&
                  !isActivePass &&
                  ((membership && membership.offeringId === offering.id) ||
                    (myMembership?.paidPass && myMembership.paidPass.offeringId === offering.id)),
              );
              // Any other offering while the customer already has a live
              // visit OR a confirmed access elsewhere gets an "Upgrade" path
              // instead of "Choose Access" — buying a second concurrent
              // access is not the flow; moving to a bigger plan is.
              const showUpgrade = !isActivePass && !isMine && hasValidAccess;
              const isSelected = selectedOffering?.id === offering.id;
              return (
              <div
                key={offering.id}
                className={`rounded-2xl border bg-white/70 p-4 transition ${
                  isActivePass || isMine
                    ? 'border-[var(--category-primary-dark)] shadow-[0_10px_28px_-18px_var(--category-glow)]'
                    : isSelected
                    ? 'border-[var(--category-primary-dark)]/60 shadow-[0_8px_22px_-16px_var(--category-glow)]'
                    : 'border-[var(--noq-glass-border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${isActivePass || isMine ? 'bg-[var(--category-primary-dark)] text-white' : 'bg-[var(--category-tint-10)] text-[var(--category-accent)]'}`}>
                        {isActivePass ? 'Checked in' : isMine ? 'Activated' : offering.type.replace('_', ' ')}
                      </span>
                      <h3 className="text-xs font-extrabold text-[var(--noq-ink)]">{offering.name}</h3>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--noq-muted)]">
                      {isActivePass
                        ? `Inside · ${activeDurationLabel}`
                        : isMine
                        ? 'Your active access at this gym'
                        : offering.description || 'Full equipment and facility access included.'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-extrabold text-[var(--noq-ink)]">₹{offering.priceInr}</div>
                    <div className="text-[10px] font-semibold text-[var(--noq-muted)]">{durationText(offering)}</div>
                  </div>
                </div>
                {isActivePass ? (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--category-primary-dark)]/30 bg-[var(--category-tint-10)] py-2 text-xs font-extrabold text-[var(--category-accent)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Inside · {activeDurationLabel}
                  </div>
                ) : isMine ? (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[var(--category-primary-dark)]/30 bg-[var(--category-tint-10)] py-2 text-xs font-extrabold text-[var(--category-accent)] shadow-[0_0_20px_-6px_var(--category-glow)]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ✓ ACTIVATED
                  </div>
                ) : showUpgrade ? (
                  <button
                    onClick={() => openDirectUpgradePayment(offering)}
                    className="mt-3 w-full rounded-xl border border-[var(--category-primary-dark)]/35 bg-white/75 py-2 text-xs font-bold text-[var(--category-accent)] transition active:scale-95"
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
              <p className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 text-center text-xs text-[var(--noq-muted)]">No passes published yet. Check back soon.</p>
            )}
          </div>
        </div>

        {/* 6b. ABOUT — moved out of the hero (which now only carries the
            open-status, name, category/distance and address, matching the
            Salon Detail hierarchy) so the real description still has a
            home, just not crammed above the fold. */}
        {salon.description && (
          <div className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--noq-muted)]">About {salon.name}</h2>
            <p className={`mt-2 text-xs leading-5 text-[var(--noq-muted)] ${aboutExpanded ? '' : 'line-clamp-3'}`}>{salon.description}</p>
            <button onClick={() => setAboutExpanded((value) => !value)} className="mt-2 flex items-center gap-1 text-xs font-bold text-[var(--category-accent)]">
              Read {aboutExpanded ? 'less' : 'more'}
            </button>
          </div>
        )}

        {/* 7. FACILITIES / AMENITIES */}
        <div className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 shadow-sm">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--noq-muted)]">Gym Facilities & Amenities</h2>
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
                <span key={amenity.id} className="flex items-center gap-1.5 rounded-xl border border-[var(--noq-glass-border)] bg-[var(--noq-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--noq-ink)]">
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
          <div className="rounded-2xl border border-[var(--noq-glass-border)] bg-white/70 p-4 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--noq-muted)]">Social & Links</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {salon.socialLinks.map((link) => {
                const SocialIcon = socialPlatformIcon(link.platform);
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--noq-glass-border)] bg-[var(--noq-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--noq-ink)] transition active:scale-[0.97]"
                  >
                    <SocialIcon className="h-3.5 w-3.5 text-[var(--category-accent)]" />
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* 8. OFFERS & COUPONS — moved into the Payment sheet itself
            ("Apply coupon" + "Offers for you", scoped to the selected
            offering) so an offer is always applied in the context of a
            real purchase, never floating disconnected from one plan. */}

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
            <h3 className="text-base font-bold text-[var(--noq-ink)]">Confirm Class Seat</h3>
            <p className="mt-1 text-xs text-[var(--noq-muted)]">
              Reserve your seat for <strong className="text-[var(--noq-ink)]">{classBookingModalOpen.title}</strong> with {classBookingModalOpen.trainer}.
            </p>
            <div className="mt-4 rounded-xl bg-[var(--noq-base)] p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--noq-muted)]">Time</span>
                <span className="font-bold text-[var(--noq-ink)]">{classBookingModalOpen.time}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--noq-muted)]">Capacity</span>
                <span className="font-bold text-[var(--category-primary-dark)]">{classBookingModalOpen.enrolled}/{classBookingModalOpen.maxCapacity} Enrolled</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setClassBookingModalOpen(null)}
                className="flex-1 rounded-xl border border-[var(--noq-border)] py-2.5 text-xs font-bold text-[var(--noq-ink)]"
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
            <h3 className="text-base font-bold text-[var(--noq-ink)]">Book Personal Training</h3>
            <p className="mt-1 text-xs text-[var(--noq-muted)]">
              1-on-1 Session with <strong className="text-[var(--noq-ink)]">{selectedTrainer.name}</strong> ({selectedTrainer.role})
            </p>
            <div className="mt-4 rounded-xl bg-[var(--noq-base)] p-3 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-[var(--noq-muted)]">Next Slot</span>
                <span className="font-bold text-[var(--category-primary-dark)]">{selectedTrainer.nextSlot || 'Today 04:00 PM'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--noq-muted)]">Fee</span>
                <span className="font-bold text-[var(--noq-ink)]">₹800 / Session</span>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPtBookingModalOpen(false)}
                className="flex-1 rounded-xl border border-[var(--noq-border)] py-2.5 text-xs font-bold text-[var(--noq-ink)]"
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

      {workoutSheetDay && (
        <TodaysWorkoutSheet day={workoutSheetDay} onClose={() => setWorkoutSheetDay(null)} />
      )}
      {attendanceSheetOpen && (
        <AttendanceCalendarSheet gymId={salon.id} onClose={() => setAttendanceSheetOpen(false)} />
      )}
      {workoutPlanEditorOpen && (
        <WorkoutPlanEditor gymId={salon.id} gymName={salon.name} onClose={() => setWorkoutPlanEditorOpen(false)} onSaved={(plan) => setWorkoutPlan(plan)} />
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
                <span className="block break-words text-[11px] font-bold leading-tight text-[var(--noq-ink)]">{selectedOffering.name}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[var(--noq-muted)]">Valid for {durationText(selectedOffering)}</span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-[var(--noq-ink)]">₹{selectedOffering.priceInr}</span>
            </div>
          ) : bottomCtaState === 'checked_in' && activeVisit ? (
            <div className="flex items-center justify-between gap-3 rounded-xl px-2 py-1">
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-bold text-[var(--noq-ink)]">{activeAccessName}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[var(--noq-muted)]">
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
                <span className="block truncate text-[11px] font-bold text-[var(--noq-ink)]">{awaitingPayment.offeringName}</span>
                <span className="mt-0.5 block text-[10px] font-semibold text-[var(--noq-muted)]">
                  {awaitingPayment.status === 'paid'
                    ? 'Paid · the gym will check you in'
                    : awaitingPayment.method === 'cash'
                    ? 'Pay at the front desk to start your visit'
                    : 'Awaiting payment confirmation'}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-[var(--noq-ink)]">₹{awaitingPayment.amountInr}</span>
            </div>
          ) : null
        }
      >
        <div className="flex min-w-0 flex-col justify-center py-0.5 pl-1 pr-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.11em] text-[var(--noq-muted)] sm:text-[10px]">
            {accessBarCopy.eyebrow}
          </div>
          <div id="gym-access-copy" className="mt-0.5 break-words text-[11px] font-extrabold leading-[1.2] text-[var(--noq-ink)] sm:text-xs">
            {accessBarCopy.main}
          </div>
        </div>
        <button
          id="gym-primary-cta"
          onClick={handleBottomCta}
          disabled={
            bottomCtaState === 'queued' ||
            bottomCtaState === 'awaiting_payment' ||
            bottomCtaState === 'loading_access' ||
            bottomCtaState === 'unavailable' ||
            scanBusy ||
            (bottomCtaState === 'checked_in' && checkoutBusy)
          }
          className="relative flex min-h-13 min-w-[86px] shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-[var(--noq-accent)] px-3.5 text-[11px] font-extrabold text-white shadow-[0_10px_20px_-10px_var(--category-glow)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 sm:min-w-[96px] sm:px-5 sm:text-xs"
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent" aria-hidden="true" />
          {bottomCtaState === 'scan' && <QrCode className="relative h-3.5 w-3.5" />}
          <span className="relative">
            {scanBusy
              ? 'Checking in…'
              : bottomCtaState === 'checked_in' && checkoutBusy
              ? 'Checking out…'
              : accessBarCopy.action}
          </span>
        </button>
      </CategoryActionBar>

      {/* Verification gate: opens instead of a gated action (claim / buy / scan)
          when the customer isn't a verified, complete profile yet. */}
      {gateOpen && (() => {
        const gate = resolveAppReadiness(customerAuth, customerProfile, { profileLoading });
        if (gate.kind !== 'onboarding_required') return null;
        return (
          <div className="fixed inset-0 z-[95] bg-[var(--noq-base)]">
            <AccountOnboarding
              gate={gate}
              onVerified={(auth) => onIdentityVerified?.(auth)}
              onProfileSaved={(profile) => {
                onProfileSaved?.(profile);
                setGateOpen(false);
                // Package/offering selection deliberately does NOT auto-resume
                // here: verification returns the customer to this same Gym
                // page with nothing auto-opened, so they choose the package
                // again on purpose. Claim and scan still resume, since those
                // are single deliberate taps with no second "which one" choice
                // to re-confirm.
                if (gatePendingAction === 'claim') setClaimModalOpen(true);
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
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-[var(--noq-ink)]">I'm Already a Member</h3>
              <button onClick={() => setClaimModalOpen(false)} aria-label="Close" className="shrink-0">
                <X className="h-4 w-4 text-[var(--noq-muted)]" />
              </button>
            </div>
            <p className="mt-1 text-xs font-semibold text-[#3B4644]">Claim your existing membership at {salon.name}.</p>
            <p className="mt-1.5 text-[11px] text-[var(--noq-muted)]">Enter the details registered with this gym. Staff will verify them.</p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="text-[11px] font-bold text-[var(--noq-ink)]">
                  Full name <span className="text-rose-500">*</span>
                </label>
                <p className="mt-0.5 text-[10px] text-[#8A9694]">Name registered at the gym</p>
                <input
                  value={claimName}
                  onChange={(e) => setClaimName(e.target.value)}
                  placeholder="e.g. Rohit Sharma"
                  className="mt-1.5 w-full rounded-xl border border-[var(--noq-border)] px-3 py-2.5 text-xs text-[var(--noq-ink)] outline-none placeholder:text-[#9AA6A4] focus:border-[var(--category-primary-dark)]"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--noq-ink)]">
                  Registered mobile number <span className="text-rose-500">*</span>
                </label>
                <p className="mt-0.5 text-[10px] text-[#8A9694]">Mobile number given to the gym</p>
                <input
                  value={claimMobile}
                  onChange={(e) => setClaimMobile(e.target.value)}
                  placeholder="e.g. 98765 43210"
                  inputMode="tel"
                  className="mt-1.5 w-full rounded-xl border border-[var(--noq-border)] px-3 py-2.5 text-xs text-[var(--noq-ink)] outline-none placeholder:text-[#9AA6A4] focus:border-[var(--category-primary-dark)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-bold text-[var(--noq-ink)]">
                    Membership started <span className="text-rose-500">*</span>
                  </label>
                  <p className="mt-0.5 text-[10px] text-[#8A9694]">Joining date</p>
                  <input
                    type="date"
                    value={claimJoinDate}
                    onChange={(e) => setClaimJoinDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--noq-border)] px-3 py-2.5 text-xs text-[var(--noq-ink)] outline-none placeholder:text-[#9AA6A4] focus:border-[var(--category-primary-dark)]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[var(--noq-ink)]">
                    Membership valid until <span className="text-rose-500">*</span>
                  </label>
                  <p className="mt-0.5 text-[10px] text-[#8A9694]">Expiry date</p>
                  <input
                    type="date"
                    value={claimExpiryDate}
                    onChange={(e) => setClaimExpiryDate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--noq-border)] px-3 py-2.5 text-xs text-[var(--noq-ink)] outline-none placeholder:text-[#9AA6A4] focus:border-[var(--category-primary-dark)]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--noq-ink)]">Membership plan</label>
                <p className="mt-0.5 text-[10px] text-[#8A9694]">Optional · e.g. Monthly, Quarterly, 6 Months, Annual</p>
                <input
                  value={claimPlanText}
                  onChange={(e) => setClaimPlanText(e.target.value)}
                  placeholder="e.g. Quarterly"
                  className="mt-1.5 w-full rounded-xl border border-[var(--noq-border)] px-3 py-2.5 text-xs text-[var(--noq-ink)] outline-none placeholder:text-[#9AA6A4] focus:border-[var(--category-primary-dark)]"
                />
              </div>

              {claimError && <p className="text-[11px] font-semibold text-rose-600">{claimError}</p>}
            </div>

            <div className="mt-5 flex gap-2">
              <button onClick={() => setClaimModalOpen(false)} className="flex-1 rounded-xl border border-[var(--noq-border)] py-2.5 text-xs font-bold text-[var(--noq-ink)]">
                Cancel
              </button>
              <button
                onClick={submitClaim}
                disabled={claimBusy}
                className="flex-1 rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
              >
                {claimBusy ? 'Sending…' : 'Send for Verification'}
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
            className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[var(--noq-border)] bg-white p-3.5 text-left transition active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-xs font-extrabold text-[var(--noq-ink)]">{offering.name}</span>
              <span className="mt-0.5 block text-[11px] text-[var(--noq-muted)]">
                {offering.description || `Valid for ${durationText(offering)}`}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm font-extrabold text-[var(--noq-ink)]">₹{offering.priceInr}</span>
              <span className="block text-[10px] font-semibold text-[var(--noq-muted)]">{durationText(offering)}</span>
            </span>
          </button>
        );
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-md rounded-t-[28px] bg-[var(--noq-base)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#D4DEDC]" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">
                    {upgradeMode ? 'Upgrade your access' : 'Gym access'}
                  </p>
                  <h3 className="text-base font-extrabold text-[var(--noq-ink)]">
                    {upgradeMode ? 'Move up to a bigger plan' : 'Choose your access'}
                  </h3>
                </div>
                <button onClick={() => { setOfferingPickerOpen(false); setUpgradeMode(false); }} aria-label="Close">
                  <X className="h-4 w-4 text-[var(--noq-muted)]" />
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
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--noq-muted)]">
                      {sections.recommended.length > 0 ? 'Other options' : 'Available access'}
                    </p>
                    {sections.others.map((offering) => <Card key={offering.id} offering={offering} />)}
                  </div>
                )}
                {sections.recommended.length === 0 && sections.others.length === 0 && (
                  <p className="rounded-2xl border border-[var(--noq-border)] bg-white p-4 text-center text-xs text-[#788582]">
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

      {/* Payment sheet — premium blurred-glass mirror language, matching the
          Gym access dock. Nothing here settles money by itself: "Cash at
          gym" creates a real pending payment the gym must accept, and the
          online path is honestly disabled until a real gateway is
          integrated rather than faking a successful capture. The applied
          offer/coupon is only ever a hint — the server recomputes the
          trusted final amount from scratch. */}
      {paymentSheetOpen && selectedOffering && (
        <CategoryGlassSheet onClose={() => setPaymentSheetOpen(false)} variant="sheet">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">Payment</p>
              <h3 className="text-base font-extrabold text-[var(--noq-ink)]">{selectedOffering.name}</h3>
            </div>
            <button onClick={() => setPaymentSheetOpen(false)} aria-label="Close">
              <X className="h-4 w-4 text-[var(--noq-muted)]" />
            </button>
          </div>

          <div className="mt-4 space-y-2 rounded-2xl border border-[var(--noq-glass-border)] bg-[var(--noq-surface-soft)] p-4 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--noq-muted)]">Selected access</span>
              <span className="font-bold text-[var(--noq-ink)]">{selectedOffering.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--noq-muted)]">Validity</span>
              <span className="font-bold text-[var(--noq-ink)]">{durationText(selectedOffering)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--noq-muted)]">Original price</span>
              <span className="font-bold text-[var(--noq-ink)]">₹{paymentSubtotalInr}</span>
            </div>
            {discountInr > 0 && paymentOffer && (
              <div className="flex justify-between text-[var(--category-accent)]">
                <span className="flex items-center gap-1 font-semibold">
                  <Tag className="h-3 w-3" />{paymentOffer.title}{paymentOffer.code ? ` · ${paymentOffer.code}` : ''}
                </span>
                <button onClick={() => setAppliedGymOfferId(null)} className="flex items-center gap-1 font-bold underline decoration-dotted">
                  − ₹{discountInr}
                </button>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-[var(--noq-glass-border)] pt-2">
              <span className="font-bold text-[var(--noq-ink)]">Final amount</span>
              <span className="text-sm font-extrabold text-[var(--category-accent)]">₹{finalAmountInr}</span>
            </div>
          </div>

          {/* Apply coupon + auto-fetched owner offers, scoped to THIS
              business + THIS selected offering. */}
          <div className="mt-3 rounded-2xl border border-[var(--noq-glass-border)] bg-[var(--noq-surface-soft)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">Apply coupon</p>
            <div className="mt-2 flex gap-2">
              <input
                value={gymCouponInput}
                onChange={(e) => { setGymCouponInput(e.target.value); setGymCouponError(''); }}
                placeholder="Enter code"
                className="min-w-0 flex-1 rounded-xl border border-[var(--noq-glass-border)] bg-white/75 px-3 py-2 text-xs text-[var(--noq-ink)] outline-none placeholder:text-[var(--noq-muted)] focus:border-[var(--category-primary-dark)]"
              />
              <button
                onClick={applyGymCouponCode}
                className="shrink-0 rounded-xl bg-[var(--category-primary-dark)] px-4 py-2 text-xs font-bold text-white"
              >
                Apply
              </button>
            </div>
            {gymCouponError && <p className="mt-2 text-[11px] font-semibold text-rose-300">{gymCouponError}</p>}

            {offersForSelectedOffering.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">Offers for you</p>
                {offersForSelectedOffering.map(({ offer, result }) => {
                  const isApplied = appliedGymOfferId === offer.id;
                  return (
                    <div key={offer.id} className="rounded-xl border border-[var(--noq-glass-border)] bg-white/70 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-[var(--noq-ink)]">{offer.title}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--category-accent)]">
                            {offerDiscountLabel(offer)}{offer.code ? ` · ${offer.code}` : ''}
                          </p>
                          {result.eligible === false && <p className="mt-1 text-[10px] text-[var(--noq-muted)]">{result.reason}</p>}
                        </div>
                        <button
                          disabled={result.eligible === false}
                          onClick={() => { setAppliedGymOfferId(offer.id); setGymCouponError(''); }}
                          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[10px] font-bold disabled:opacity-40 ${
                            isApplied ? 'bg-[var(--category-primary-dark)] text-white' : 'border border-[var(--category-primary-dark)] text-[var(--category-accent)]'
                          }`}
                        >
                          {isApplied ? 'Applied' : 'Apply'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[var(--noq-muted)]">Payment method</p>
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
                      ? 'border-[var(--category-primary-dark)] bg-[var(--category-tint-10)] text-[var(--category-accent)]'
                      : 'border-[var(--noq-glass-border)] bg-white/70 text-[var(--noq-ink)]'
                  }`}
                >
                  {method === 'online' ? 'ONLINE' : 'CASH AT GYM'}
                </button>
              );
            })}
          </div>
          {paymentMethod === 'online' && (
            <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[10px] font-semibold text-amber-200">
              Online payment is not live at this gym yet — no card or UPI gateway is connected, so we won't pretend a payment went through. Choose "Cash at gym".
            </p>
          )}
          <p className="mt-3 text-[10px] leading-4 text-[var(--noq-muted)]">
            Paying reserves your access. It does not check you in — your visit starts, and the gym's Inside count changes, only once the front desk confirms you're here.
          </p>
          {purchaseError && <p className="mt-3 text-[11px] font-semibold text-rose-300">{purchaseError}</p>}
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
        </CategoryGlassSheet>
      )}

      {purchaseResult && (
        <CategoryGlassSheet onClose={() => setPurchaseResult(null)} variant="modal">
          <CheckCircle2 className="mx-auto h-9 w-9 text-[var(--category-accent)]" />
          <p className="mt-3 text-sm font-extrabold text-[var(--noq-ink)]">{purchaseResult.offeringName} reserved</p>
          <p className="mt-2 text-xs leading-5 text-[var(--noq-muted)]">
            {purchaseResult.method === 'cash' ? `Pay ₹${purchaseResult.amountInr} at the front desk.` : `₹${purchaseResult.amountInr} paid online.`}
            <br />
            {purchaseResult.isMembership ? 'Membership' : 'Access'} activates after gym confirmation.
          </p>
          <button
            onClick={() => setPurchaseResult(null)}
            className="mt-5 w-full rounded-xl bg-[var(--category-primary-dark)] py-2.5 text-xs font-bold text-white shadow-sm"
          >
            Got it
          </button>
        </CategoryGlassSheet>
      )}

      {/* Scan to Check In — the mandatory QR gate. Server validates gym
          binding, entitlement, duplicate check-in and capacity; this page
          only surfaces the outcome, it never decides check-in itself. */}
      <QrScannerModal open={qrScannerOpen} onClose={() => setQrScannerOpen(false)} onResolved={handleScanResolved} />
    </div>
  );
};
