export type QueueStatus = 'Waiting' | 'Called' | 'Serving' | 'Reserved' | 'Completed';

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
  reservedFor?: string;
  createdAt: number;
  estimatedDurationMin?: number;
  sessionId?: string;
  customerId?: string;
  source?: 'customer_app' | 'qr_walk_in' | 'staff_walk_in' | 'appointment';
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
  type: 'join' | 'slot' | 'profile';
  slot?: string;
  serviceName?: string;
  qrToken?: string;
}
