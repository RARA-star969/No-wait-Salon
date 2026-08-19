// Single source of truth for the salon information both the Customer app and
// the public web (QR) page present. Both surfaces read the same server record
// (`rowToSalon`), so the only way they can drift is by each deciding
// independently what to show. This module makes that decision once.

import type { Salon, SalonGalleryItem, SalonOffer, ServiceItem } from '../types';

/** What the public QR endpoint adds on top of the stored salon record. */
export type LiveSalonFacts = {
  liveWaitMinutes?: number;
  waitingCustomers?: number;
  queueAccepting?: boolean;
};

export type SalonProfileService = ServiceItem & { description: string };

export type SalonProfile = {
  id: string;
  name: string;
  address: string;
  category: string;
  logoImageUrl: string;
  coverImageUrl: string;
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  openingHours: string;
  description: string;
  amenities: string[];
  offers: SalonOffer[];
  gallery: SalonGalleryItem[];
  services: SalonProfileService[];
  liveWaitMinutes: number;
  waitingCustomers: number;
  queueAccepting: boolean;
  directionsUrl: string;
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Offers arrive as objects from the salon record, but older QR payloads may
 * still carry bare strings. Normalise both so neither surface has to guess.
 */
export function normaliseOffers(offers: unknown): SalonOffer[] {
  if (!Array.isArray(offers)) return [];
  return offers
    .map((offer, index): SalonOffer | null => {
      if (typeof offer === 'string') {
        const title = offer.trim();
        return title ? { id: `offer-${index}`, title, discount: '' } : null;
      }
      if (offer && typeof offer === 'object') {
        const record = offer as Partial<SalonOffer>;
        const title = text(record.title);
        if (!title) return null;
        return {
          id: text(record.id) || `offer-${index}`,
          title,
          discount: text(record.discount),
          minimumBill: text(record.minimumBill),
          validity: text(record.validity),
          terms: text(record.terms),
        };
      }
      return null;
    })
    .filter((offer): offer is SalonOffer => offer !== null);
}

export const directionsUrlFor = (name: string, address: string): string =>
  `https://maps.google.com/?q=${encodeURIComponent(`${name} ${address}`.trim())}`;

/**
 * Build the shared view model. Accepts the stored salon plus the live facts the
 * QR endpoint layers on, so the app (which reads them from the queue state) and
 * the web page (which reads them from the payload) end up identical.
 */
export function toSalonProfile(salon: Salon & LiveSalonFacts, live: LiveSalonFacts = {}): SalonProfile {
  const services = (salon.services || []).map((service) => ({
    ...service,
    description: text(service.description),
  }));
  const waitingCustomers = live.waitingCustomers ?? salon.waitingCustomers ?? 0;
  const liveWaitMinutes = live.liveWaitMinutes ?? salon.liveWaitMinutes ?? 0;
  const isOpen = Boolean(salon.isOpen);
  return {
    id: salon.id,
    name: salon.name,
    address: salon.address,
    category: text(salon.category),
    logoImageUrl: text(salon.logoImageUrl),
    coverImageUrl: text(salon.coverImageUrl),
    rating: Number(salon.rating) || 0,
    reviewCount: Number(salon.reviewCount) || 0,
    isOpen,
    openingHours: text(salon.openingHours),
    description:
      text(salon.description) ||
      `${salon.name} offers professional salon and grooming services with live queue visibility through No-Wait Salon.`,
    amenities: (salon.amenities || []).filter((amenity) => text(amenity).length > 0),
    offers: normaliseOffers(salon.offers),
    gallery: (salon.gallery || []).filter((item) => text(item?.imageUrl).length > 0),
    services,
    liveWaitMinutes,
    waitingCustomers,
    queueAccepting: live.queueAccepting ?? salon.queueAccepting ?? isOpen,
    directionsUrl: directionsUrlFor(salon.name, salon.address),
  };
}

/** Shared wording so "12 min wait" never reads differently on the two surfaces. */
export const waitLabel = (minutes: number): string => (minutes > 0 ? `${minutes} min wait` : 'No wait right now');

/** The sections both surfaces must render, in the same order. */
export const SALON_PROFILE_SECTIONS = ['live', 'offers', 'services', 'about', 'amenities', 'hours', 'gallery'] as const;
export type SalonProfileSection = (typeof SALON_PROFILE_SECTIONS)[number];

/** Which of those sections actually have content for this salon. */
export function visibleSections(profile: SalonProfile): SalonProfileSection[] {
  return SALON_PROFILE_SECTIONS.filter((section) => {
    if (section === 'offers') return profile.offers.length > 0;
    if (section === 'gallery') return profile.gallery.length > 0;
    if (section === 'amenities') return profile.amenities.length > 0;
    if (section === 'services') return profile.services.length > 0;
    if (section === 'hours') return Boolean(profile.openingHours || profile.address);
    return true;
  });
}
