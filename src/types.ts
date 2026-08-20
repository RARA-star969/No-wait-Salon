export type QueueStatus = 'Waiting' | 'Called' | 'Serving' | 'Reserved' | 'Completed' | 'NoShow' | 'Cancelled';

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
}

export interface ServiceItem {
  id: string;
  name: string;
  durationMin: number;
  priceInr: number;
  /** Optional compare-at price, shown struck through when a salon sets one. Staff/dashboard-driven; never fabricated on the client. */
  originalPriceInr?: number;
  description?: string;
  icon?: string;
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
  phoneNumber?: string;
  description?: string;
  coverImageUrl?: string;
  logoImageUrl?: string;
  amenities?: string[];
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
}

export interface SalonGalleryItem {
  id: string;
  imageUrl: string;
  type?: 'image' | 'video';
  label?: string;
}

export interface NearbySalon extends Salon {
  travelTimeMinutes: number;
  liveWaitMinutes: number;
  waitingCustomers: number;
}

export type ViewMode = 'split' | 'customer' | 'staff';
export type CustomerScreen = 'home' | 'salon' | 'slots' | 'tracking' | 'complete' | 'profile' | 'edit-profile';

export interface OtpAction {
  type: 'slot' | 'profile';
  slot?: string;
  serviceName?: string;
}
