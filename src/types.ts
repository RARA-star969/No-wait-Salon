export type QueueStatus = 'Waiting' | 'Called' | 'Serving' | 'Reserved' | 'Completed' | 'NoShow' | 'Cancelled';

export type PaymentStatus = 'unpaid' | 'cash_pending' | 'paid' | 'waived';
export type PaymentMethod = 'cash' | 'online' | 'upi' | 'card';

/** Terminal outcome of a queue entry, kept distinct from a completed service. */
export type QueueOutcome =
  | 'completed'
  | 'no_show'
  | 'cancelled_customer'
  | 'cancelled_staff'
  | 'removed';

export type CancelledBy = 'customer' | 'staff';

export interface QueueItem {
  id: string;
  name: string;
  phone?: string;
  service: string;
  status: QueueStatus;
  isUser?: boolean;
  barberIndex?: number;
  barberName?: string;
  calledAt?: number;
  /** Server-stamped arrival deadline. Clients count down to this, never to a local timer. */
  graceExpiresAt?: number;
  /** 1 on the first Call, incremented by each Call Again. */
  callAttempt?: number;
  /** When the customer tapped "I'm on my way". Never moves the deadline. */
  acknowledgedAt?: number;
  outcome?: QueueOutcome;
  noShowAt?: number;
  cancelledBy?: CancelledBy;
  cancelReasonCode?: string;
  cancelReasonText?: string;
  cancelledAt?: number;
  serviceStartedAt?: number;
  serviceCompletedAt?: number;
  reservedFor?: string;
  createdAt: number;
  estimatedDurationMin?: number;
  sessionId?: string;
  customerId?: string;
  source?: 'customer_app' | 'qr_walk_in' | 'qr_web' | 'staff_walk_in' | 'appointment';
  /** Names of every service selected for this booking. `service` stays a display string ("Haircut + Beard Trim") for backward compatibility. */
  services?: string[];
  /** Running total across `services`, in INR. Absent on older single-service bookings. */
  totalPriceInr?: number;
  /** Stylist the customer asked for at join time. Empty means "any available". */
  preferredBarberId?: string;
  /** Short human-readable ticket token (e.g. "SC-014"), stable for this booking's lifetime. Minted server-side; `id` remains the real key. */
  token?: string;
  /** Photo for this queue entry's customer, if their account has one — used only by the privacy-minimal "people around you" strip. */
  customerPhotoUrl?: string;
  /** Offer applied at join time. Server re-validates and recomputes `discountInr`
   *  from the live salon_offer record — a client-supplied discount is never trusted. */
  appliedOfferId?: string;
  /** Amount actually deducted, server-computed. `totalPriceInr` is already net of this. */
  discountInr?: number;
  /** Payment tracking */
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  paidAt?: number;
  rating?: number;
  feedbackTags?: string[];
  feedbackComment?: string;
}

export interface CustomerProfile {
  customerId: string;
  phoneNumber: string;
  name: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  anniversary: string;
  city: string;
  profilePhotoUrl: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomerAuthSession {
  token: string;
  customerId: string;
  phoneNumber: string;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  timestamp: number;
  type: 'approaching' | 'called' | 'reserved_nearing' | 'confirmed' | 'serving' | 'general';
  salonName?: string;
  read?: boolean;
}

export interface Barber {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'unavailable';
  currentCustomerName?: string;
  avatarBg?: string;
  /** From salon_staff.photo_url — same record Admin/Manage Staff edit. */
  photoUrl?: string;
  /** From salon_staff.role, e.g. "Senior Barber". Defaults to "Barber" server-side. */
  role?: string;
  /** From salon_staff.service_ids_json — service ids this stylist performs. */
  serviceIds?: string[];
  /** From salon_staff.active — false means hidden from customers, kept for Manage Staff. */
  active?: boolean;
  /** Star rating for stylist, e.g. 4.9. */
  rating?: number;
  /** Verified review count for stylist. */
  reviewCount?: number;
  /** Years of styling experience. */
  experienceYears?: number;
  /** Short biography/intro for advanced staff profile. */
  bio?: string;
  /** Key styling specialties, e.g. ["Fade Specialist", "Beard Sculpting", "Hair Spa"]. */
  specialties?: string[];
}

export interface ServiceItem {
  id: string;
  name: string;
  durationMin: number;
  priceInr: number;
  description?: string;
  icon?: string;
}

export interface MainCategory {
  id: string;
  name: string;
  iconName: string;
  label: string;
  description?: string;
  displayOrder: number;
  active: boolean;
  isDefault?: boolean;
  businessCount?: number;
  themeKey?: string;
  primaryColor?: string;
  accentColor?: string;
  bannerImageUrl?: string;
  bannerHeadline?: string;
  bannerSubheadline?: string;
  bannerCtaText?: string;
}

export interface UserAddress {
  id: string;
  customerId: string;
  label: string;
  fullAddress: string;
  buildingName?: string;
  area: string;
  city: string;
  state?: string;
  pinCode?: string;
  landmark?: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  distanceKm?: number;
  createdAt: number;
  updatedAt: number;
}

export interface AddressRequest {
  id: string;
  customerId: string;
  areaName: string;
  city: string;
  pinCode: string;
  comments?: string;
  status: 'pending' | 'reviewed';
  createdAt: number;
}

export interface Salon {
  id: string;
  name: string;
  address: string;
  distanceKm: number;
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  services: ServiceItem[];
  defaultBarberCount: number;
  latitude: number;
  longitude: number;
  openingHours: string;
  category?: string;
  mainCategoryId?: string;
  phoneNumber?: string;
  description?: string;
  coverImageUrl?: string;
  logoImageUrl?: string;
  amenities?: string[];
  /** Structured, icon-carrying amenities for Gym's Manage Profile / Gym
   *  Detail page. Always derived from the same amenities_json column as
   *  `amenities` (which stays the legacy plain-name list other categories
   *  and the Admin editor read) — never a second stored list. */
  amenityDetails?: GymAmenity[];
  /** Owner-configurable customer quick actions (Schedule/Directions/etc.)
   *  on the Gym Detail page. Empty/absent falls back to the trusted
   *  built-in default set. */
  quickActions?: GymQuickAction[];
  /** Owner-configured social/external links (Instagram, Facebook, YouTube,
   *  X/Twitter, Website) for the Gym public Detail page only — never shown
   *  on the Home listing card. Only enabled, resolvable links appear here;
   *  'website' always reflects the existing `websiteUrl` column, never a
   *  duplicated stored value. */
  socialLinks?: GymSocialLink[];
  offers?: SalonOffer[];
  gallery?: SalonGalleryItem[];
  brandKey?: string;
  shortDescription?: string;
  email?: string;
  websiteUrl?: string;
  area?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  promotionalBannerUrl?: string;
  platformStatus?: 'draft' | 'active' | 'inactive' | 'suspended';
  weeklyHours?: Array<{ day: string; openTime: string; closeTime: string; closed: boolean }>;
}

export interface SalonOffer {
  id: string;
  title: string;
  discount: string;
  minimumBill?: string;
  validity?: string;
  terms?: string;
  /** Redeemable code shown to the customer, e.g. "FEST20". Optional — a
   *  tap-to-apply offer from the list doesn't need one. */
  code?: string;
  /** Structured fields powering real discount math — the free-text `discount`
   *  above stays for display, these drive `evaluateCoupon()`. Absent on an
   *  offer that's display-only (no real applicable discount). */
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  minimumBillInr?: number;
  startDate?: string;
  endDate?: string;
  active?: boolean;
  /** Service ids this offer applies to. Empty/absent means every service. */
  eligibleServiceIds?: string[];
  /** Gym offering ids (Day Pass / Monthly / Quarterly / any owner-defined
   *  offering) this offer applies to. Empty/absent means every Gym Access
   *  product. Salon's eligibleServiceIds and this are never both meaningful
   *  on the same offer — a business is either a Salon or a Gym. */
  eligibleOfferingIds?: string[];
}

export interface SalonGalleryItem {
  id: string;
  imageUrl: string;
  type?: 'image' | 'video';
  label?: string;
  featured?: boolean;
}

/** Controlled icon key — rendered through the shared amenity icon library,
 *  never a free-form icon name, so an amenity can never reference an icon
 *  the customer surfaces don't know how to draw. */
export type GymAmenityIconKey =
  | 'Dumbbell' | 'HeartPulse' | 'Flame' | 'Users' | 'ShowerHead' | 'ParkingCircle'
  | 'Wifi' | 'Wind' | 'Music' | 'Droplet' | 'ShieldCheck' | 'Clock' | 'Locker' | 'Check';

export interface GymAmenity {
  id: string;
  name: string;
  iconKey: GymAmenityIconKey;
  active: boolean;
  order: number;
}

/** Controlled action type — a custom/future quick action can only ever be
 *  one of these, so a "Directions"/"Been here" slot can never be quietly
 *  swapped for an arbitrary owner-supplied URL. */
export type GymQuickActionType = 'schedule' | 'directions' | 'branches' | 'been_here';

export interface GymQuickAction {
  id: string;
  type: GymQuickActionType;
  label: string;
  iconKey: GymAmenityIconKey;
  visible: boolean;
  order: number;
}

/** Controlled platform list for Manage Profile's Social & Links — a new
 *  platform is added here, never invented client-side. 'website' is a
 *  special case that always reuses the existing Salon.websiteUrl field for
 *  its URL instead of duplicating that value into a second store. */
export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'website';

/** What actually renders on the customer Gym Detail page: always a real
 *  https:// URL, never a bare handle, and only for enabled/configured
 *  platforms. */
export interface GymSocialLink {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
  order: number;
}

/** Owner-editor shape (Manage Profile -> Social & Links) — includes every
 *  controlled platform, even disabled/unconfigured ones, so the UI can
 *  render one consistent row per platform. */
export interface GymSocialLinkInput {
  id: string;
  platform: SocialPlatform;
  /** Full URL or bare handle as the owner typed it — ignored for
   *  platform: 'website', whose value always mirrors websiteUrl. */
  value: string;
  enabled: boolean;
  order: number;
}

export interface NearbySalon extends Salon {
  travelTimeMinutes: number;
  liveWaitMinutes: number;
  waitingCustomers: number;
  /** Barbers currently free to take the next customer — same count the
   *  Salon Detail page's live-queue card uses for its Position field. */
  readyChairs?: number;
  /** Gym occupancy, present only for `mainCategoryId === 'gym'` listings. */
  currentOccupancy?: number;
  maxCapacity?: number;
}

export type ViewMode = 'split' | 'customer' | 'staff';
export type CustomerScreen =
  | 'home'
  | 'salon'
  | 'slots'
  | 'tracking'
  | 'complete'
  | 'profile'
  | 'edit-profile'
  | 'location-select'
  | 'add-address'
  | 'request-address'
  | 'gym-activity'
  /** Category-agnostic "My Bookings" — the bottom Bookings tab AND
   *  Profile -> My bookings both land here (one component, one route). */
  | 'bookings'
  /** Persistent customer Notification inbox — the bottom Alerts tab. */
  | 'notifications'
  /** Notification preferences, reached from the inbox and from Profile. */
  | 'notification-settings';

export interface OtpAction {
  type: 'slot' | 'profile';
  slot?: string;
  serviceName?: string;
}
