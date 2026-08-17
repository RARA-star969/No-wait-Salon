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
}

export interface NearbySalon extends Salon {
  travelTimeMinutes: number;
  liveWaitMinutes: number;
  waitingCustomers: number;
}

export type ViewMode = 'split' | 'customer' | 'staff';
export type CustomerScreen = 'home' | 'salon' | 'slots' | 'tracking' | 'complete';

export interface OtpAction {
  type: 'join' | 'slot';
  slot?: string;
  serviceName: string;
}
