import { Salon, ServiceItem, Barber, QueueItem } from '../types';

export const SERVICES: ServiceItem[] = [
  { id: 's1', name: 'Haircut', durationMin: 30, priceInr: 250, description: 'Precision cut, wash & styling' },
  { id: 's2', name: 'Haircut + Beard', durationMin: 45, priceInr: 400, originalPriceInr: 480, description: 'Hair grooming with beard styling & hot towel' },
  { id: 's3', name: 'Beard Trim & Shape', durationMin: 20, priceInr: 150, description: 'Sharp line-up, trimming and beard oil treatment' },
  { id: 's4', name: 'Detox Head Massage', durationMin: 25, priceInr: 300, description: 'Cooling scalp therapy with ayurvedic oils' },
  { id: 's5', name: 'Hair Spa & Conditioning', durationMin: 40, priceInr: 550, originalPriceInr: 650, description: 'Deep nourishing moisture treatment' },
];

export const SALONS: Salon[] = [
  {
    id: 'salon-1',
    name: 'Sharpcut Studio',
    address: '742, 12th Main Road, Indiranagar, Bengaluru 560038',
    distanceKm: 0.8,
    rating: 4.8,
    reviewCount: 320,
    isOpen: true,
    services: SERVICES,
    defaultBarberCount: 2,
    latitude: 12.9719,
    longitude: 77.6412,
    openingHours: 'Mon–Sun · 9:00 AM–9:00 PM',
    category: "Men's grooming studio",
    description: 'A modern neighbourhood grooming studio focused on precise cuts, thoughtful service, and a calm experience without unnecessary waiting.',
    amenities: ['Air conditioned', 'Wi-Fi', 'Digital payments'],
    offers: [
      {
        id: 'offer-welcome10',
        title: 'Welcome offer',
        discount: '10% off your bill',
        minimumBill: '₹300',
        terms: 'One use per customer.',
        code: 'WELCOME10',
        discountType: 'percent',
        discountValue: 10,
        minimumBillInr: 300,
      },
    ],
    gallery: [],
    brandKey: 'sharpcut',
  },
  {
    id: 'salon-2',
    name: 'Royal Man Salon',
    address: '18, 80 Feet Road, HAL 2nd Stage, Bengaluru 560008',
    distanceKm: 1.2,
    rating: 4.7,
    reviewCount: 246,
    isOpen: true,
    services: SERVICES,
    defaultBarberCount: 2,
    latitude: 12.9674,
    longitude: 77.6492,
    openingHours: 'Mon–Sun · 9:30 AM–9:30 PM',
    category: 'Premium unisex salon',
    description: 'Contemporary hair and grooming services delivered by an experienced team in a comfortable, welcoming space.',
    amenities: ['Air conditioned', 'Digital payments'],
    offers: [],
    gallery: [],
    brandKey: 'royal-man',
  },
];

export const INITIAL_BARBERS: Barber[] = [
  { id: 'b1', name: 'Arjun', status: 'busy', currentCustomerName: 'Aman' },
  { id: 'b2', name: 'Sameer', status: 'available' },
];

export const INITIAL_QUEUE: QueueItem[] = [
  {
    id: 'q-1',
    name: 'Aman',
    phone: '98765 01234',
    service: 'Haircut',
    status: 'Serving',
    barberIndex: 0,
    barberName: 'Arjun',
    createdAt: Date.now() - 15 * 60 * 1000,
    estimatedDurationMin: 30,
  },
  {
    id: 'q-2',
    name: 'Rahul',
    phone: '98451 98210',
    service: 'Haircut + Beard',
    status: 'Waiting',
    createdAt: Date.now() - 8 * 60 * 1000,
    estimatedDurationMin: 45,
  },
  {
    id: 'q-3',
    name: 'Vikram',
    phone: '97312 44556',
    service: 'Beard Trim & Shape',
    status: 'Waiting',
    createdAt: Date.now() - 3 * 60 * 1000,
    estimatedDurationMin: 20,
  },
];

export const AVAILABLE_TIME_SLOTS = [
  '4:30 PM',
  '5:00 PM',
  '5:30 PM',
  '6:00 PM',
  '6:30 PM',
];
