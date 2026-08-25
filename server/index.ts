import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { INITIAL_BARBERS, INITIAL_QUEUE, SALONS } from '../src/data/mockData.ts';
import type { Barber, QueueItem, Salon, SalonOffer } from '../src/types.ts';
import {initPostgresPersistence} from './postgresPersistence.ts';
import {qrPngDataUrl,qrSvgDataUrl} from './qrRendering.ts';
import {ensureBusinessQr,findActiveBusinessQr,type BusinessQrRow} from './businessQr.ts';
import {canCancel,graceMinutes,graceWindowMs,normaliseCancelReason,shouldStartNewCall} from '../src/shared/queueTiming.ts';
import {evaluateCoupon} from '../src/shared/couponPricing.ts';

// Configurable arrival grace period; a future per-salon setting can override this.
const GRACE_WINDOW_MS = graceWindowMs(graceMinutes(process.env.QUEUE_GRACE_MINUTES));

type SalonState = {
  salonId: string;
  version: number;
  queue: QueueItem[];
  barbers: Barber[];
  completedList: QueueItem[];
  updatedAt: number;
  /** Daily per-salon token sequence; resets whenever tokenDate rolls over. */
  tokenSeq: number;
  tokenDate: string;
  platformStatus?: string;
};

/**
 * Mints a stable, human-readable ticket token (e.g. "SC-014"): a short salon
 * prefix plus a sequence number that resets once per day. Lives on SalonState
 * itself so it survives everywhere the queue already persists — no separate
 * counter table, no risk of colliding with another salon's sequence.
 */
function mintToken(state: SalonState): string {
  const today = new Date().toISOString().slice(0, 10);
  if (state.tokenDate !== today) {
    state.tokenDate = today;
    state.tokenSeq = 0;
  }
  state.tokenSeq += 1;
  const prefix = (state.salonId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'NQ').toUpperCase();
  return `${prefix}-${String(state.tokenSeq).padStart(3, '0')}`;
}

type QueueCommand =
  | { type: 'reset' }
  | { type: 'toggle_barber'; barberId: string }
  | { type: 'join'; item: QueueItem }
  | { type: 'add_walkin'; item: QueueItem; startImmediately?: boolean; preferredBarberId?: string }
  | { type: 'queue_action'; itemId: string; action: 'Call' | 'Acknowledge' | 'Start' | 'Complete' | 'No-show' | 'Remove' | 'Cancel-chair' | 'Pay-online' | 'Pay-cash' | 'Confirm-cash-payment' | 'Submit-rating'; barberId?: string; reasonCode?: string; reasonText?: string; rating?: number; feedbackTags?: string[]; feedbackComment?: string }
  | { type: 'cancel_customer'; sessionId: string; reasonCode?: string; reasonText?: string }
  | { type: 'save_staff'; staff: unknown[] }
  | { type: 'save_offers'; offers: unknown[] };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
mkdirSync(dataDir, { recursive: true });
const profilePhotoDir = path.join(dataDir, 'profile-photos');
mkdirSync(profilePhotoDir, { recursive: true });
const salonMediaDir = path.join(dataDir, 'salon-media');
mkdirSync(salonMediaDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA busy_timeout = 5000');
db.exec(`
  CREATE TABLE IF NOT EXISTS gym_state (gym_id TEXT PRIMARY KEY, state_json TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS salon_state (
    salon_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    state_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS salon (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    rating REAL NOT NULL,
    review_count INTEGER NOT NULL,
    is_open INTEGER NOT NULL DEFAULT 1,
    opening_hours TEXT NOT NULL,
    services_json TEXT NOT NULL,
    barbers_json TEXT NOT NULL,
    onboarded INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  )
`);

const salonColumns = new Set((db.prepare('PRAGMA table_info(salon)').all() as Array<{ name: string }>).map((column) => column.name));
const additiveSalonColumns: Record<string, string> = {
  category: "TEXT NOT NULL DEFAULT ''",
  phone_number: "TEXT NOT NULL DEFAULT ''",
  description: "TEXT NOT NULL DEFAULT ''",
  cover_image_url: "TEXT NOT NULL DEFAULT ''",
  logo_image_url: "TEXT NOT NULL DEFAULT ''",
  amenities_json: "TEXT NOT NULL DEFAULT '[]'",
  offers_json: "TEXT NOT NULL DEFAULT '[]'",
  gallery_json: "TEXT NOT NULL DEFAULT '[]'",
  brand_key: "TEXT NOT NULL DEFAULT ''",
  short_description: "TEXT NOT NULL DEFAULT ''",
  email: "TEXT NOT NULL DEFAULT ''",
  website_url: "TEXT NOT NULL DEFAULT ''",
  area: "TEXT NOT NULL DEFAULT ''",
  city: "TEXT NOT NULL DEFAULT ''",
  state: "TEXT NOT NULL DEFAULT ''",
  pin_code: "TEXT NOT NULL DEFAULT ''",
  promotional_banner_url: "TEXT NOT NULL DEFAULT ''",
  platform_status: "TEXT NOT NULL DEFAULT 'active'",
  main_category_id: "TEXT NOT NULL DEFAULT 'salon'",
  updated_at: "INTEGER NOT NULL DEFAULT 0",
};
for (const [column, definition] of Object.entries(additiveSalonColumns)) {
  if (!salonColumns.has(column)) db.exec(`ALTER TABLE salon ADD COLUMN ${column} ${definition}`);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS main_category (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon_name TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    display_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    theme_key TEXT NOT NULL DEFAULT 'salon',
    primary_color TEXT NOT NULL DEFAULT '#0F766E',
    accent_color TEXT NOT NULL DEFAULT '#2DD4BF',
    banner_image_url TEXT NOT NULL DEFAULT '',
    banner_headline TEXT NOT NULL DEFAULT '',
    banner_subheadline TEXT NOT NULL DEFAULT '',
    banner_cta_text TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customer_address (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    label TEXT NOT NULL,
    full_address TEXT NOT NULL,
    area TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT '',
    pin_code TEXT NOT NULL DEFAULT '',
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS address_request (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    area_name TEXT NOT NULL,
    city TEXT NOT NULL,
    pin_code TEXT NOT NULL DEFAULT '',
    comments TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
`);

// Safely add any missing columns to main_category for existing databases
const categoryCols = (db.prepare("PRAGMA table_info(main_category)").all() as Array<{ name: string }>).map((c) => c.name);
if (!categoryCols.includes('theme_key')) db.exec("ALTER TABLE main_category ADD COLUMN theme_key TEXT NOT NULL DEFAULT 'salon'");
if (!categoryCols.includes('primary_color')) db.exec("ALTER TABLE main_category ADD COLUMN primary_color TEXT NOT NULL DEFAULT '#0F766E'");
if (!categoryCols.includes('accent_color')) db.exec("ALTER TABLE main_category ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#2DD4BF'");
if (!categoryCols.includes('banner_image_url')) db.exec("ALTER TABLE main_category ADD COLUMN banner_image_url TEXT NOT NULL DEFAULT ''");
if (!categoryCols.includes('banner_headline')) db.exec("ALTER TABLE main_category ADD COLUMN banner_headline TEXT NOT NULL DEFAULT ''");
if (!categoryCols.includes('banner_subheadline')) db.exec("ALTER TABLE main_category ADD COLUMN banner_subheadline TEXT NOT NULL DEFAULT ''");
if (!categoryCols.includes('banner_cta_text')) db.exec("ALTER TABLE main_category ADD COLUMN banner_cta_text TEXT NOT NULL DEFAULT ''");

const DEFAULT_MAIN_CATEGORIES = [
  { id: 'salon', name: 'Salon', iconName: 'Scissors', label: 'Live Salons', description: 'Salons, barbershops & styling studios', displayOrder: 1, active: 1, isDefault: 1, themeKey: 'salon', primaryColor: '#0F766E', accentColor: '#2DD4BF', bannerImageUrl: '', bannerHeadline: 'Better grooming, less waiting.', bannerSubheadline: 'Discover trusted salons and reserve your chair before leaving home.', bannerCtaText: 'Explore Chairs' },
  { id: 'gym', name: 'Gym', iconName: 'Dumbbell', label: 'Fitness & Gym', description: 'Gyms, fitness centers & personal trainers', displayOrder: 2, active: 1, isDefault: 0, themeKey: 'gym', primaryColor: '#D97706', accentColor: '#F59E0B', bannerImageUrl: '', bannerHeadline: 'Power your fitness goals today.', bannerSubheadline: 'Onboarded elite gyms, day passes & personal coaching sessions.', bannerCtaText: 'View Fitness Gyms' },
  { id: 'shop', name: 'Shop', iconName: 'ShoppingBag', label: 'Stores & Shops', description: 'Retail stores, boutiques & shopping outlets', displayOrder: 3, active: 1, isDefault: 0, themeKey: 'shop', primaryColor: '#7C3AED', accentColor: '#8B5CF6', bannerImageUrl: '', bannerHeadline: 'Bespoke tailoring & retail atelier.', bannerSubheadline: 'Curated luxury fashion, express alterations & styling sessions.', bannerCtaText: 'Discover Shops' },
  { id: 'moto', name: 'Moto', iconName: 'Car', label: 'Auto & Services', description: 'Automobile care, detailing & service stations', displayOrder: 4, active: 1, isDefault: 0, themeKey: 'moto', primaryColor: '#DC2626', accentColor: '#EF4444', bannerImageUrl: '', bannerHeadline: 'Precision automobile detailing spa.', bannerSubheadline: 'High-shine ceramic wax, foam wash & upholstery steam sanitize.', bannerCtaText: 'Book Auto Care' },
  { id: 'pets', name: 'Pets', iconName: 'Dog', label: 'Pet Care & Spa', description: 'Pet grooming, vet clinics & pet centers', displayOrder: 5, active: 1, isDefault: 0, themeKey: 'pets', primaryColor: '#059669', accentColor: '#10B981', bannerImageUrl: '', bannerHeadline: 'Gentle organic pet spa & bath.', bannerSubheadline: 'Stress-free pet grooming with botanical shampoos & pampering.', bannerCtaText: 'Explore Pet Care' },
  { id: 'mall', name: 'Mall', iconName: 'Building2', label: 'Shopping Malls', description: 'Shopping malls, plazas & commercial centers', displayOrder: 6, active: 1, isDefault: 0, themeKey: 'mall', primaryColor: '#2563EB', accentColor: '#3B82F6', bannerImageUrl: '', bannerHeadline: 'Central lifestyle shopping hub.', bannerSubheadline: 'International brand outlets, multiplex cinema & VIP valet lounge.', bannerCtaText: 'View Malls' },
  { id: 'food', name: 'Food', iconName: 'Utensils', label: 'Food & Dining', description: 'Restaurants, cafes, bakeries & dining spots', displayOrder: 7, active: 1, isDefault: 0, themeKey: 'food', primaryColor: '#EA580C', accentColor: '#F97316', bannerImageUrl: '', bannerHeadline: 'Artisanal cafe & gourmet bistro.', bannerSubheadline: 'Farm-to-table European deli classics, specialty coffee & tasting menus.', bannerCtaText: 'Explore Dining' },
];

const insertCategory = db.prepare(`
  INSERT INTO main_category (id, name, icon_name, label, description, display_order, active, is_default, theme_key, primary_color, accent_color, banner_image_url, banner_headline, banner_subheadline, banner_cta_text, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    theme_key = excluded.theme_key,
    primary_color = excluded.primary_color,
    accent_color = excluded.accent_color,
    banner_headline = excluded.banner_headline,
    banner_subheadline = excluded.banner_subheadline,
    banner_cta_text = excluded.banner_cta_text
`);
const nowCategoryMs = Date.now();
for (const cat of DEFAULT_MAIN_CATEGORIES) {
  insertCategory.run(cat.id, cat.name, cat.iconName, cat.label, cat.description, cat.displayOrder, cat.active, cat.isDefault, cat.themeKey, cat.primaryColor, cat.accentColor, cat.bannerImageUrl, cat.bannerHeadline, cat.bannerSubheadline, cat.bannerCtaText, nowCategoryMs, nowCategoryMs);
}

const insertSalon = db.prepare(`
  INSERT INTO salon
  (id, name, address, latitude, longitude, rating, review_count, is_open, opening_hours, services_json, barbers_json,
   category, main_category_id, phone_number, description, cover_image_url, logo_image_url, amenities_json, offers_json, gallery_json, brand_key, onboarded, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(id) DO NOTHING
`);
const demoBarbers: Record<string, Barber[]> = {
  'salon-1': [
    {
      id: 'b1',
      name: 'Arjun',
      status: 'available',
      role: 'Master Stylist',
      rating: 4.9,
      reviewCount: 142,
      experienceYears: 7,
      bio: 'Specialist in modern skin fades, classic scissor work, and precision beard sculpts with over 7 years of studio experience.',
      specialties: ['Skin Fade Specialist', 'Beard Sculpting', 'Hot Towel Treatment', 'Precision Scissor Work'],
    },
    {
      id: 'b2',
      name: 'Sameer',
      status: 'available',
      role: 'Senior Barber',
      rating: 4.8,
      reviewCount: 98,
      experienceYears: 5,
      bio: 'Expert in textured crops, pompadours, and revitalizing scalp & hair spa treatments with gentle organic tonics.',
      specialties: ['Textured Crops', 'Hair Spa & Conditioning', 'Head Massage', 'Classic Grooming'],
    },
  ],
  'salon-2': [
    {
      id: 'b1',
      name: 'Kabir',
      status: 'available',
      role: 'Senior Stylist',
      rating: 4.85,
      reviewCount: 110,
      experienceYears: 6,
      bio: 'Known for bespoke styling and grooming consultations tailored to your style.',
      specialties: ['Scissor Cuts', 'Beard Design', 'Hair Colour'],
    },
    {
      id: 'b2',
      name: 'Rohan',
      status: 'available',
      role: 'Barber & Grooming Artist',
      rating: 4.75,
      reviewCount: 84,
      experienceYears: 4,
      bio: 'Specializes in quick, sharp cuts and classic gentleman grooming rituals.',
      specialties: ['Classic Haircuts', 'Beard Trimming', 'Scalp Care'],
    },
  ],
};
for (const salon of SALONS) {
  insertSalon.run(
    salon.id, salon.name, salon.address, salon.latitude, salon.longitude, salon.rating,
    salon.reviewCount, salon.isOpen ? 1 : 0, salon.openingHours, JSON.stringify(salon.services),
    JSON.stringify(demoBarbers[salon.id] || []), salon.category || '', salon.mainCategoryId || 'salon', salon.phoneNumber || '', salon.description || '',
    salon.coverImageUrl || '', salon.logoImageUrl || '', JSON.stringify(salon.amenities || []), JSON.stringify(salon.offers || []),
    JSON.stringify(salon.gallery || []), salon.brandKey || '', Date.now(),
  );
}

type SalonRow = {
  id: string; name: string; address: string; latitude: number; longitude: number; rating: number;
  review_count: number; is_open: number; opening_hours: string; services_json: string; barbers_json: string;
  category: string; main_category_id?: string; phone_number: string; description: string; cover_image_url: string; logo_image_url: string;
  amenities_json: string; offers_json: string; gallery_json: string; brand_key: string;
  short_description: string; email: string; website_url: string; area: string; city: string; state: string;
  pin_code: string; promotional_banner_url: string; platform_status: string; updated_at: number; onboarded: number; created_at: number;
};

db.exec(`
  CREATE TABLE IF NOT EXISTS salon_hours (
    salon_id TEXT NOT NULL, day_of_week INTEGER NOT NULL, open_time TEXT NOT NULL DEFAULT '09:00', close_time TEXT NOT NULL DEFAULT '21:00',
    closed INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (salon_id, day_of_week), FOREIGN KEY(salon_id) REFERENCES salon(id)
  );
  CREATE TABLE IF NOT EXISTS salon_service (
    id TEXT PRIMARY KEY, salon_id TEXT NOT NULL, name TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', price_inr INTEGER NOT NULL,
    duration_min INTEGER NOT NULL, description TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(salon_id) REFERENCES salon(id)
  );
  CREATE INDEX IF NOT EXISTS salon_service_salon_idx ON salon_service(salon_id, sort_order);
  CREATE TABLE IF NOT EXISTS salon_staff (
    id TEXT PRIMARY KEY, salon_id TEXT NOT NULL, name TEXT NOT NULL, photo_url TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'Barber',
    service_ids_json TEXT NOT NULL DEFAULT '[]', working_status TEXT NOT NULL DEFAULT 'available', active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(salon_id) REFERENCES salon(id)
  );
  CREATE INDEX IF NOT EXISTS salon_staff_salon_idx ON salon_staff(salon_id, sort_order);
  CREATE TABLE IF NOT EXISTS salon_offer (
    id TEXT PRIMARY KEY, salon_id TEXT NOT NULL, title TEXT NOT NULL, discount_text TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
    minimum_bill INTEGER NOT NULL DEFAULT 0, start_date TEXT NOT NULL DEFAULT '', end_date TEXT NOT NULL DEFAULT '', terms TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY(salon_id) REFERENCES salon(id)
  );
  CREATE TABLE IF NOT EXISTS salon_media (
    id TEXT PRIMARY KEY, salon_id TEXT NOT NULL, media_type TEXT NOT NULL DEFAULT 'gallery', url TEXT NOT NULL, caption TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(salon_id) REFERENCES salon(id)
  );
  CREATE TABLE IF NOT EXISTS admin_user (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS admin_session (
    token_hash TEXT PRIMARY KEY, admin_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
    FOREIGN KEY(admin_id) REFERENCES admin_user(id)
  );
  CREATE TABLE IF NOT EXISTS staff_account (
    id TEXT PRIMARY KEY, business_id TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'owner', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    FOREIGN KEY(business_id) REFERENCES salon(id)
  );
  CREATE TABLE IF NOT EXISTS staff_session (
    token_hash TEXT PRIMARY KEY, staff_id TEXT NOT NULL, business_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
    FOREIGN KEY(staff_id) REFERENCES staff_account(id)
  );
`);

// Additive columns on existing tables
const salonOfferColumns = new Set((db.prepare('PRAGMA table_info(salon_offer)').all() as Array<{ name: string }>).map((column) => column.name));
const additiveSalonOfferColumns: Record<string, string> = {
  code: "TEXT NOT NULL DEFAULT ''",
  discount_type: "TEXT NOT NULL DEFAULT 'percent'",
  discount_value: 'INTEGER NOT NULL DEFAULT 0',
  eligible_service_ids_json: "TEXT NOT NULL DEFAULT '[]'",
};
for (const [column, definition] of Object.entries(additiveSalonOfferColumns)) {
  if (!salonOfferColumns.has(column)) db.exec(`ALTER TABLE salon_offer ADD COLUMN ${column} ${definition}`);
}

const salonStaffColumns = new Set((db.prepare('PRAGMA table_info(salon_staff)').all() as Array<{ name: string }>).map((column) => column.name));
const additiveSalonStaffColumns: Record<string, string> = {
  rating: 'REAL NOT NULL DEFAULT 4.8',
  review_count: 'INTEGER NOT NULL DEFAULT 0',
  experience_years: 'INTEGER NOT NULL DEFAULT 3',
  bio: "TEXT NOT NULL DEFAULT ''",
  specialties_json: "TEXT NOT NULL DEFAULT '[]'",
};
for (const [column, definition] of Object.entries(additiveSalonStaffColumns)) {
  if (!salonStaffColumns.has(column)) db.exec(`ALTER TABLE salon_staff ADD COLUMN ${column} ${definition}`);
}

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const nowForSeed = Date.now();
for (const salon of SALONS) {
  const serviceCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_service WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!serviceCount) salon.services.forEach((service, index) => db.prepare(`INSERT INTO salon_service
    (id, salon_id, name, category, price_inr, duration_min, description, image_url, active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, ?)`)
    .run(`${salon.id}-${service.id}`, salon.id, service.name, service.name.includes('Beard') ? 'Beard' : service.name.includes('Spa') || service.name.includes('Massage') ? 'Massage & Spa' : 'Hair Care', service.priceInr, service.durationMin, service.description || '', index, nowForSeed, nowForSeed));
  const staffCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_staff WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!staffCount) {
    (demoBarbers[salon.id] || []).forEach((barber, index) => db.prepare(`INSERT INTO salon_staff
      (id, salon_id, name, role, working_status, active, sort_order, rating, review_count, experience_years, bio, specialties_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        `${salon.id}-${barber.id}`,
        salon.id,
        barber.name,
        barber.role || 'Barber',
        barber.status,
        index,
        barber.rating ?? 4.8,
        barber.reviewCount ?? 0,
        barber.experienceYears ?? 3,
        barber.bio || '',
        JSON.stringify(barber.specialties || []),
        nowForSeed,
        nowForSeed,
      ));
  } else {
    // Populate demo fields for existing demo staff
    (demoBarbers[salon.id] || []).forEach((barber) => {
      db.prepare(`
        UPDATE salon_staff SET
          role = ?,
          rating = ?,
          review_count = ?,
          experience_years = ?,
          bio = ?,
          specialties_json = ?
        WHERE salon_id = ? AND (name = ? OR id = ? OR id = ?)
      `).run(
        barber.role || 'Barber',
        barber.rating ?? 4.8,
        barber.reviewCount ?? 50,
        barber.experienceYears ?? 3,
        barber.bio || '',
        JSON.stringify(barber.specialties || []),
        salon.id,
        barber.name,
        barber.id,
        `${salon.id}-${barber.id}`,
      );
    });
  }
  const hoursCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_hours WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!hoursCount) dayNames.forEach((_, index) => db.prepare('INSERT INTO salon_hours (salon_id, day_of_week, open_time, close_time, closed) VALUES (?, ?, ?, ?, 0)')
    .run(salon.id, index, '09:00', '21:00'));

  const offerCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_offer WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!offerCount && salon.offers && salon.offers.length) {
    salon.offers.forEach((offer, index) => {
      db.prepare(`INSERT INTO salon_offer
        (id, salon_id, title, discount_text, description, minimum_bill, start_date, end_date, terms, image_url, active, sort_order, created_at, updated_at, code, discount_type, discount_value, eligible_service_ids_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, ?, ?, ?, ?, '[]')`)
        .run(
          offer.id || `offer-${salon.id}-${index}`,
          salon.id,
          offer.title,
          offer.discount || '',
          offer.validity || '',
          offer.minimumBillInr || 0,
          offer.startDate || '',
          offer.endDate || '',
          offer.terms || '',
          index,
          nowForSeed,
          nowForSeed,
          offer.code || '',
          offer.discountType || 'percent',
          offer.discountValue || 0,
        );
    });
  }
}

/** Single mapping from a salon_staff row to the client Barber shape — used
 * everywhere a Barber is read, so the customer-facing stylist list, Manage
 * Staff, and the live queue state can never disagree about what a staff
 * record looks like. */
function staffRowToBarber(row: Record<string, string | number>): Barber {
  return {
    id: String(row.id),
    name: String(row.name),
    status: String(row.working_status) as Barber['status'],
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
    role: row.role ? String(row.role) : undefined,
    serviceIds: row.service_ids_json ? (JSON.parse(String(row.service_ids_json)) as string[]) : undefined,
    active: row.active === undefined ? true : Number(row.active) === 1,
    rating: row.rating !== undefined && row.rating !== null ? Number(row.rating) : undefined,
    reviewCount: row.review_count !== undefined && row.review_count !== null ? Number(row.review_count) : undefined,
    experienceYears: row.experience_years !== undefined && row.experience_years !== null ? Number(row.experience_years) : undefined,
    bio: row.bio ? String(row.bio) : undefined,
    specialties: row.specialties_json ? (JSON.parse(String(row.specialties_json)) as string[]) : undefined,
  };
}

function rowToSalon(row: SalonRow): Salon {
  const serviceRows = db.prepare('SELECT * FROM salon_service WHERE salon_id = ? AND active = 1 ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const staffRows = db.prepare('SELECT * FROM salon_staff WHERE salon_id = ? AND active = 1 ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const offerRows = db.prepare('SELECT * FROM salon_offer WHERE salon_id = ? AND active = 1 ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const mediaRows = db.prepare('SELECT * FROM salon_media WHERE salon_id = ? ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const hoursRows = db.prepare('SELECT * FROM salon_hours WHERE salon_id = ? ORDER BY day_of_week').all(row.id) as Array<Record<string, string | number>>;
  const services = serviceRows.map((service) => ({ id: String(service.id), name: String(service.name), durationMin: Number(service.duration_min), priceInr: Number(service.price_inr), description: String(service.description || ''), icon: String(service.image_url || '') }));
  const barbers = staffRows.map(staffRowToBarber);
  const offers = offerRows.map((offer) => ({
    id: String(offer.id),
    title: String(offer.title),
    discount: String(offer.discount_text),
    minimumBill: Number(offer.minimum_bill) ? `₹${offer.minimum_bill}` : '',
    validity: [offer.start_date, offer.end_date].filter(Boolean).join(' – '),
    terms: String(offer.terms),
    code: String(offer.code || '') || undefined,
    discountType: Number(offer.discount_value) > 0 ? (offer.discount_type === 'fixed' ? ('fixed' as const) : ('percent' as const)) : undefined,
    discountValue: Number(offer.discount_value) > 0 ? Number(offer.discount_value) : undefined,
    minimumBillInr: Number(offer.minimum_bill) || undefined,
    startDate: String(offer.start_date || '') || undefined,
    endDate: String(offer.end_date || '') || undefined,
    active: true,
    eligibleServiceIds: offer.eligible_service_ids_json ? (JSON.parse(String(offer.eligible_service_ids_json)) as string[]) : undefined,
  }));
  const gallery = mediaRows.filter((media) => media.media_type === 'gallery').map((media) => ({ id: String(media.id), imageUrl: String(media.url), type: 'image' as const, label: String(media.caption || row.name) }));
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: row.rating,
    reviewCount: row.review_count,
    isOpen: row.is_open === 1,
    openingHours: row.opening_hours,
    services: services.length ? services : JSON.parse(row.services_json),
    defaultBarberCount: barbers.length || 1,
    distanceKm: 0,
    category: row.category,
    mainCategoryId: row.main_category_id || 'salon',
    phoneNumber: row.phone_number,
    description: row.description,
    coverImageUrl: row.cover_image_url,
    logoImageUrl: row.logo_image_url,
    amenities: JSON.parse(row.amenities_json || '[]'),
    offers: offers.length ? offers : JSON.parse(row.offers_json || '[]'),
    gallery: gallery.length ? gallery : JSON.parse(row.gallery_json || '[]'),
    brandKey: row.brand_key,
    shortDescription: row.short_description,
    email: row.email,
    websiteUrl: row.website_url,
    area: row.area,
    city: row.city,
    state: row.state,
    pinCode: row.pin_code,
    promotionalBannerUrl: row.promotional_banner_url,
    platformStatus: row.platform_status as Salon['platformStatus'],
    weeklyHours: hoursRows.map((hours) => ({ day: dayNames[Number(hours.day_of_week)], openTime: String(hours.open_time), closeTime: String(hours.close_time), closed: Number(hours.closed) === 1 })),
  };
}

function readOnboardedSalons(): Salon[] {
  const rows = db.prepare("SELECT * FROM salon WHERE onboarded = 1 AND platform_status = 'active' ORDER BY created_at, id").all() as unknown as SalonRow[];
  return rows.map(rowToSalon);
}

function readSalonBarbers(salonId: string): Barber[] {
  const rows = db.prepare('SELECT * FROM salon_staff WHERE salon_id = ? AND active = 1 ORDER BY sort_order').all(salonId) as Array<Record<string, string | number>>;
  if (rows.length) return rows.map(staffRowToBarber);
  const row = db.prepare('SELECT barbers_json FROM salon WHERE id = ? AND onboarded = 1').get(salonId) as { barbers_json: string } | undefined;
  return row ? JSON.parse(row.barbers_json) as Barber[] : [];
}

/**
 * Reconciles live queue state against the current salon_staff config: adds
 * newly-added/reactivated staff, drops deactivated ones (unless they are
 * mid-service, so a chair is never yanked out from under a live booking),
 * and refreshes name/photo/role/skills for everyone else — while always
 * preserving the live-only fields (status, currentCustomerName) for staff
 * who already existed in state. Without this, a Manage Staff change made
 * after a salon's queue has started would never reach the live view until
 * a full reset.
 */
function reconcileBarbers(state: SalonState): boolean {
  const configured = readSalonBarbers(state.salonId);
  if (!configured.length) return false;
  const configuredById = new Map(configured.map((barber) => [barber.id, barber]));
  const liveById = new Map(state.barbers.map((barber) => [barber.id, barber]));
  let changed = false;

  const next: Barber[] = [];
  for (const config of configured) {
    const live = liveById.get(config.id);
    if (live) {
      const merged: Barber = {
        ...live,
        name: config.name,
        photoUrl: config.photoUrl,
        role: config.role,
        serviceIds: config.serviceIds,
        active: config.active,
        rating: config.rating,
        reviewCount: config.reviewCount,
        experienceYears: config.experienceYears,
        bio: config.bio,
        specialties: config.specialties,
      };
      if (JSON.stringify(merged) !== JSON.stringify(live)) changed = true;
      next.push(merged);
    } else {
      next.push({ ...config, status: 'available' });
      changed = true;
    }
  }
  // Drop staff removed/deactivated in config, unless they are mid-service —
  // a live chair is never pulled out from under a booking in progress.
  for (const live of state.barbers) {
    if (!configuredById.has(live.id) && live.status === 'busy') {
      next.push(live);
    } else if (!configuredById.has(live.id)) {
      changed = true;
    }
  }
  if (changed) state.barbers = next;
  return changed;
}
db.exec(`
  CREATE TABLE IF NOT EXISTS otp_challenge (
    id TEXT PRIMARY KEY,
    phone TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    verified_at INTEGER
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS customer_account (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS customer_profile (
    customer_id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    date_of_birth TEXT NOT NULL DEFAULT '',
    gender TEXT NOT NULL DEFAULT '',
    anniversary TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    profile_photo_url TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customer_account(id)
  );
  CREATE TABLE IF NOT EXISTS customer_session (
    token_hash TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customer_account(id)
  );
  CREATE TABLE IF NOT EXISTS customer_booking (
    id TEXT PRIMARY KEY,
    queue_entry_id TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL,
    salon_id TEXT NOT NULL,
    service TEXT NOT NULL,
    status TEXT NOT NULL,
    reserved_for TEXT,
    source TEXT NOT NULL DEFAULT 'customer_app',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customer_account(id)
  );
  CREATE INDEX IF NOT EXISTS customer_booking_customer_idx ON customer_booking(customer_id, created_at DESC);
`);

const customerBookingColumns = new Set((db.prepare('PRAGMA table_info(customer_booking)').all() as Array<{ name: string }>).map((column) => column.name));
if (!customerBookingColumns.has('source')) db.exec("ALTER TABLE customer_booking ADD COLUMN source TEXT NOT NULL DEFAULT 'customer_app'");
// Additive booking analytics for the call / arrival grace period.
for (const [column, ddl] of [
  ['outcome', 'outcome TEXT'],
  ['first_called_at', 'first_called_at INTEGER'],
  ['call_attempts', 'call_attempts INTEGER NOT NULL DEFAULT 0'],
  ['acknowledged_at', 'acknowledged_at INTEGER'],
  ['grace_expires_at', 'grace_expires_at INTEGER'],
  ['no_show_at', 'no_show_at INTEGER'],
  ['service_started_at', 'service_started_at INTEGER'],
  ['service_completed_at', 'service_completed_at INTEGER'],
  ['cancelled_by', 'cancelled_by TEXT'],
  ['cancel_reason_code', 'cancel_reason_code TEXT'],
  ['cancel_reason_text', 'cancel_reason_text TEXT'],
  ['cancelled_at', 'cancelled_at INTEGER'],
  ['services_json', "services_json TEXT NOT NULL DEFAULT '[]'"],
  ['total_price_inr', 'total_price_inr INTEGER'],
] as const) {
  if (!customerBookingColumns.has(column)) db.exec(`ALTER TABLE customer_booking ADD COLUMN ${ddl}`);
}

const customerProfileColumns = new Set((db.prepare('PRAGMA table_info(customer_profile)').all() as Array<{ name: string }>).map((column) => column.name));
if (!customerProfileColumns.has('marketing_consent')) db.exec('ALTER TABLE customer_profile ADD COLUMN marketing_consent INTEGER NOT NULL DEFAULT 0');

// Lightweight attribution for customers acquired by scanning a salon QR with a
// plain phone camera. Deliberately minimal: no marketing engine, just fields.
db.exec(`
  CREATE TABLE IF NOT EXISTS web_qr_attribution (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    qr_token_id TEXT NOT NULL,
    customer_id TEXT,
    acquisition_source TEXT NOT NULL DEFAULT 'salon_qr_web',
    first_visit_at INTEGER NOT NULL,
    joined_at INTEGER,
    app_cta_shown INTEGER NOT NULL DEFAULT 0,
    app_cta_clicked INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS web_qr_attribution_business_idx ON web_qr_attribution(business_id, created_at DESC);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS business_qr (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL,
    business_type TEXT NOT NULL,
    public_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    revoked_at INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS business_qr_active_business_idx ON business_qr(business_id,business_type) WHERE status = 'active';
  CREATE INDEX IF NOT EXISTS business_qr_token_status_idx ON business_qr(public_token,status);
`);

const postgresPersistence=await initPostgresPersistence(db,dataDir);
if(postgresPersistence)console.log(`PostgreSQL persistence active; hydrated from ${postgresPersistence.source}. SQLite safety backup: ${postgresPersistence.backupPath}`);
const qrCountBefore=(db.prepare('SELECT COUNT(*) count FROM business_qr').get() as {count:number}).count;
(db.prepare('SELECT id FROM salon').all() as Array<{id:string}>).forEach(({id})=>ensureBusinessQr(db,id,'salon'));
if((db.prepare('SELECT COUNT(*) count FROM business_qr').get() as {count:number}).count!==qrCountBefore)await postgresPersistence?.flushNow(['business_qr']);

export async function safeBackfillSeeds(db: any, persistence: any) {
  const insertSalon = db.prepare(`
    INSERT INTO salon (id, name, address, latitude, longitude, rating, review_count, is_open, opening_hours, services_json, barbers_json, onboarded, category, main_category_id, phone_number, description, cover_image_url, logo_image_url, amenities_json, offers_json, gallery_json, brand_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  
  let changes = 0;
  const missingSalons = [];
  
  for (const salon of SALONS) {
    const row = {
      id: salon.id, name: salon.name, address: salon.address, latitude: salon.latitude, longitude: salon.longitude,
      rating: salon.rating, review_count: salon.reviewCount, is_open: salon.isOpen ? 1 : 0, opening_hours: salon.openingHours,
      services_json: JSON.stringify(salon.services), barbers_json: JSON.stringify(demoBarbers[salon.id] || []),
      onboarded: 1, category: salon.category || '', main_category_id: salon.mainCategoryId || 'salon',
      phone_number: salon.phoneNumber || '', description: salon.description || '', cover_image_url: salon.coverImageUrl || '',
      logo_image_url: salon.logoImageUrl || '', amenities_json: JSON.stringify(salon.amenities || []),
      offers_json: JSON.stringify(salon.offers || []), gallery_json: JSON.stringify(salon.gallery || []),
      brand_key: salon.brandKey || '', created_at: Date.now()
    };
    
    const res = insertSalon.run(
      row.id, row.name, row.address, row.latitude, row.longitude, row.rating,
      row.review_count, row.is_open, row.opening_hours, row.services_json,
      row.barbers_json, row.category, row.main_category_id, row.phone_number, row.description,
      row.cover_image_url, row.logo_image_url, row.amenities_json, row.offers_json,
      row.gallery_json, row.brand_key, row.created_at
    );
    
    if (res.changes > 0) {
      changes += res.changes;
      missingSalons.push(row);
    }
  }
  
  if (changes > 0 && persistence && persistence.insertMissingSalons) {
    await persistence.insertMissingSalons(missingSalons);
  }
}
await safeBackfillSeeds(db, postgresPersistence);

// Diagnostic only: surfaces the active public QR token for each salon in the
// boot log, since a fresh ephemeral SQLite file (no persistent disk) means
// ensureBusinessQr mints a new random token on every deploy/restart.
for(const row of db.prepare("SELECT s.id,s.name,q.public_token FROM salon s JOIN business_qr q ON q.business_id=s.id AND q.status='active' AND q.business_type='salon'").all() as Array<{id:string;name:string;public_token:string}>){
  console.log(`[qr-token] ${row.name} (${row.id}): ${row.public_token}`);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const configuredOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.use((request, response, next) => {
  const origin = request.headers.origin;
  const isLocalOrigin = origin && (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || origin === 'capacitor://localhost');
  if (origin && (isLocalOrigin || configuredOrigins.has(origin))) {
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Vary', 'Origin');
    response.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.set('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use((_request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
  });
  next();
});
app.use(express.json({ limit: '3mb' }));
app.use('/salon-media', express.static(salonMediaDir, { immutable: true, maxAge: '7d' }));
app.use((request,response,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(request.method))response.on('finish',()=>postgresPersistence?.scheduleFlush());
  next();
});

const subscribers = new Map<string, Set<express.Response>>();
const hashCode = (value: string) => createHash('sha256').update(value).digest('base64url');
const passwordHash = (password: string, salt = randomBytes(16).toString('hex')) => `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
const verifyPassword = (password: string, encoded: string) => {
  const [salt, expectedHex] = encoded.split(':');
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

const configuredAdminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const configuredAdminPassword = String(process.env.ADMIN_PASSWORD || '');
const configuredAdminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '');

const isProduction = process.env.NODE_ENV === 'production';
const existingAdmin = db.prepare('SELECT id, email, password_hash FROM admin_user LIMIT 1').get() as { id: string; email: string; password_hash: string } | undefined;

if (isProduction) {
  if (!existingAdmin) {
    if (!configuredAdminEmail || (!configuredAdminPassword && !configuredAdminPasswordHash)) {
      throw new Error('[FATAL] Production startup error: ADMIN_EMAIL and ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH) environment variables are required to initialize a new production admin account.');
    }
    const now = Date.now();
    const finalHash = configuredAdminPasswordHash || passwordHash(configuredAdminPassword);
    db.prepare('INSERT INTO admin_user (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), configuredAdminEmail, finalHash, now, now);
  }
} else {
  const defaultAdminEmail = configuredAdminEmail || 'admin@nowaitsalon.com';
  const defaultAdminPassword = configuredAdminPassword || 'admin123';
  if (!existingAdmin) {
    const now = Date.now();
    db.prepare('INSERT INTO admin_user (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), defaultAdminEmail, configuredAdminPasswordHash || passwordHash(defaultAdminPassword), now, now);
  }
}

const renderExternalHostname = String(process.env.RENDER_EXTERNAL_HOSTNAME || '').trim().toLowerCase();
const renderServiceName = String(process.env.RENDER_SERVICE_NAME || '').trim().toLowerCase();
const isExplicitTestDeployment = process.env.NO_WAIT_TEST_DEPLOYMENT === 'true'
  || dataDir.includes('no-wait-salon-test-data')
  || renderExternalHostname === 'no-wait-salon-web-test.onrender.com'
  || renderServiceName === 'no-wait-salon-web-test';
if (process.env.NODE_ENV !== 'production' || isExplicitTestDeployment) {
  const demoStaffAccounts = [
    { id: 'staff-acc-salon-1-owner', businessId: 'salon-1', email: 'sharpcut-owner@nowaitsalon.test', password: 'staff123', name: 'Arjun (Owner)', role: 'owner' },
    { id: 'staff-acc-salon-2-owner', businessId: 'salon-2', email: 'royal-owner@nowaitsalon.test', password: 'staff123', name: 'Rajesh (Owner)', role: 'owner' },
    { id: 'staff-acc-gym-1-owner', businessId: 'gym-1', email: 'ironhouse-owner@nowaitsalon.test', password: 'staff123', name: 'Vikram (Owner)', role: 'owner' },
    { id: 'staff-acc-gym-1-trainer', businessId: 'gym-1', email: 'ironhouse-trainer@nowaitsalon.test', password: 'staff123', name: 'Coach Vikram', role: 'trainer' },
  ];

  for (const acc of demoStaffAccounts) {
    const existing = db.prepare('SELECT id FROM staff_account WHERE email = ? OR id = ?').get(acc.email, acc.id) as { id: string } | undefined;
    const now = Date.now();
    if (!existing) {
      db.prepare('INSERT INTO staff_account (id, business_id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
        .run(acc.id, acc.businessId, acc.email, passwordHash(acc.password), acc.name, acc.role, now, now);
    } else if (isExplicitTestDeployment) {
      // Hosted TEST is disposable and must have deterministic credentials for a
      // real /api/staff/login E2E. Production is unaffected because this branch
      // can run only when the explicit test deployment marker is present.
      db.prepare('UPDATE staff_account SET business_id=?, email=?, password_hash=?, name=?, role=?, active=1, updated_at=? WHERE id=?')
        .run(acc.businessId, acc.email, passwordHash(acc.password), acc.name, acc.role, now, existing.id);
    }
  }
}

type AuthenticatedRequest = express.Request & { customerId?: string };
type AdminRequest = express.Request & { adminId?: string };
type StaffRequest = express.Request & {
  staffSession?: {
    staffId: string;
    email: string;
    name: string;
    role: string;
    businessId: string;
    businessName: string;
    mainCategoryId: string;
  };
};

function resolveStaffSession(request: express.Request) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

  const testBusinessHeader = String(request.headers['x-test-business-id'] || '').trim();
  const testRoleHeader = String(request.headers['x-test-staff-role'] || '').trim();

  if (token) {
    const session = db.prepare(`
      SELECT ss.staff_id, ss.business_id, sa.email, sa.name, sa.role, s.name as business_name, COALESCE(s.main_category_id, 'salon') as main_category_id
      FROM staff_session ss
      JOIN staff_account sa ON ss.staff_id = sa.id
      JOIN salon s ON ss.business_id = s.id
      WHERE ss.token_hash = ? AND ss.expires_at > ? AND sa.active = 1
    `).get(hashCode(token), Date.now()) as { staff_id: string; business_id: string; email: string; name: string; role: string; business_name: string; main_category_id: string } | undefined;

    if (session) {
      return {
        staffId: session.staff_id,
        email: session.email,
        name: session.name,
        role: session.role,
        businessId: session.business_id,
        businessName: session.business_name,
        mainCategoryId: session.main_category_id,
      };
    }
  }

  if (testBusinessHeader && process.env.NODE_ENV !== 'production') {
    const account = db.prepare(`
      SELECT sa.id as staff_id, sa.email, sa.name, sa.role, s.id as business_id, s.name as business_name, COALESCE(s.main_category_id, 'salon') as main_category_id
      FROM salon s
      LEFT JOIN staff_account sa ON sa.business_id = s.id AND (sa.role = ? OR ? = '')
      WHERE s.id = ?
    `).get(testRoleHeader || 'owner', testRoleHeader || 'owner', testBusinessHeader) as { staff_id?: string; email?: string; name?: string; role?: string; business_id: string; business_name: string; main_category_id: string } | undefined;

    if (account) {
      return {
        staffId: account.staff_id || `test-${account.business_id}`,
        email: account.email || `test@${account.business_id}.test`,
        name: account.name || `${account.business_name} Staff`,
        role: account.role || testRoleHeader || 'owner',
        businessId: account.business_id,
        businessName: account.business_name,
        mainCategoryId: account.main_category_id,
      };
    }
  }

  return undefined;
}

function requireAdmin(request: AdminRequest, response: express.Response, next: express.NextFunction) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (process.env.NODE_ENV !== 'production' && (token === 'test' || token === 'demo-admin-token')) {
    request.adminId = 'admin-demo';
    return next();
  }
  const session = token ? db.prepare('SELECT admin_id FROM admin_session WHERE token_hash = ? AND expires_at > ?')
    .get(hashCode(token), Date.now()) as { admin_id: string } | undefined : undefined;
  if (!session) return response.status(401).json({ error: 'Admin authentication required.' });
  request.adminId = session.admin_id;
  next();
}

function resolveCustomerId(request: express.Request) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return undefined;
  const session = db.prepare('SELECT customer_id FROM customer_session WHERE token_hash = ? AND expires_at > ?')
    .get(hashCode(token), Date.now()) as { customer_id: string } | undefined;
  return session?.customer_id;
}

function requireCustomer(request: AuthenticatedRequest, response: express.Response, next: express.NextFunction) {
  const customerId = resolveCustomerId(request);
  if (!customerId) return response.status(401).json({ error: 'Please verify your mobile number to continue.' });
  request.customerId = customerId;
  next();
}

function readCustomerProfile(customerId: string) {
  return db.prepare(`
    SELECT a.id AS customer_id, a.phone_number, p.name, p.email, p.date_of_birth, p.gender,
      p.anniversary, p.city, p.profile_photo_url, p.created_at, p.updated_at
    FROM customer_account a JOIN customer_profile p ON p.customer_id = a.id WHERE a.id = ?
  `).get(customerId) as Record<string, string | number>;
}

function profileResponse(row: Record<string, string | number>) {
  return {
    customerId: row.customer_id,
    phoneNumber: row.phone_number,
    name: row.name,
    email: row.email,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    anniversary: row.anniversary,
    city: row.city,
    profilePhotoUrl: row.profile_photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function upsertBooking(salonId: string, item: QueueItem) {
  if (!item.customerId) return;
  const customerExists = db.prepare('SELECT 1 FROM customer_account WHERE id = ?').get(item.customerId);
  if (!customerExists) return;
  const now = Date.now();
  db.prepare(`
    INSERT INTO customer_booking (
      id, queue_entry_id, customer_id, salon_id, service, status, reserved_for, source, created_at, updated_at,
      outcome, first_called_at, call_attempts, acknowledged_at, grace_expires_at, no_show_at, service_started_at, service_completed_at,
      cancelled_by, cancel_reason_code, cancel_reason_text, cancelled_at, services_json, total_price_inr
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(queue_entry_id) DO UPDATE SET
      status = excluded.status, source = excluded.source, updated_at = excluded.updated_at,
      outcome = COALESCE(excluded.outcome, customer_booking.outcome),
      first_called_at = COALESCE(customer_booking.first_called_at, excluded.first_called_at),
      call_attempts = MAX(customer_booking.call_attempts, excluded.call_attempts),
      acknowledged_at = COALESCE(excluded.acknowledged_at, customer_booking.acknowledged_at),
      grace_expires_at = excluded.grace_expires_at,
      no_show_at = COALESCE(excluded.no_show_at, customer_booking.no_show_at),
      service_started_at = COALESCE(customer_booking.service_started_at, excluded.service_started_at),
      service_completed_at = COALESCE(excluded.service_completed_at, customer_booking.service_completed_at),
      cancelled_by = COALESCE(excluded.cancelled_by, customer_booking.cancelled_by),
      cancel_reason_code = COALESCE(excluded.cancel_reason_code, customer_booking.cancel_reason_code),
      cancel_reason_text = COALESCE(excluded.cancel_reason_text, customer_booking.cancel_reason_text),
      cancelled_at = COALESCE(excluded.cancelled_at, customer_booking.cancelled_at),
      services_json = excluded.services_json,
      total_price_inr = COALESCE(excluded.total_price_inr, customer_booking.total_price_inr)
  `).run(
    randomUUID(), item.id, item.customerId, salonId, item.service, item.status, item.reservedFor || null,
    item.source || 'customer_app', item.createdAt, now,
    item.outcome || null, item.calledAt || null, item.callAttempt || 0, item.acknowledgedAt || null,
    item.graceExpiresAt || null, item.noShowAt || null, item.serviceStartedAt || null, item.serviceCompletedAt || null,
    item.cancelledBy || null, item.cancelReasonCode || null, item.cancelReasonText || null, item.cancelledAt || null,
    JSON.stringify(item.services || []), item.totalPriceInr ?? null,
  );
}

function seedState(salonId: string): SalonState {
  const now = Date.now();
  const isPrimaryDemoSalon = salonId === 'salon-1';
  const configuredBarbers = readSalonBarbers(salonId);
  const baseBarbers = configuredBarbers.length ? configuredBarbers : INITIAL_BARBERS;
  // The demo salon's canned "Arjun is mid-cut with Aman" opening state comes
  // from INITIAL_BARBERS by position, but the id always comes from the real
  // salon_staff config — never overridden — so reconcileBarbers can match
  // this state back against config on every later read instead of treating
  // every configured stylist as a stranger.
  const seededBarbers = baseBarbers.map((configured, index) => {
    const demoFlavor = isPrimaryDemoSalon ? INITIAL_BARBERS[index] : undefined;
    return {
      ...structuredClone(configured),
      status: demoFlavor?.status ?? 'available',
      currentCustomerName: demoFlavor?.currentCustomerName,
    };
  });
  const state: SalonState = {
    salonId,
    version: 1,
    queue: isPrimaryDemoSalon ? structuredClone(INITIAL_QUEUE) : [],
    barbers: seededBarbers,
    completedList: [],
    updatedAt: now,
    tokenSeq: 0,
    tokenDate: new Date(now).toISOString().slice(0, 10),
  };
  state.queue.forEach((item) => { if (!item.token) item.token = mintToken(state); });
  return state;
}

/**
 * Backfills token bookkeeping onto a state persisted before the token system
 * existed, and writes the backfill straight back so a second read (a
 * different SSE subscriber, a page refresh) sees the same tokens rather than
 * minting a fresh set. Deliberately skips version/updatedAt: this is a
 * transparent migration, not a state change any client needs to diff against.
 */
function ensureTokens(state: SalonState): SalonState {
  let changed = false;
  if (state.tokenSeq === undefined || state.tokenDate === undefined) {
    state.tokenSeq = 0;
    state.tokenDate = new Date(state.updatedAt || Date.now()).toISOString().slice(0, 10);
    changed = true;
  }
  state.queue.forEach((item) => {
    if (!item.token) { item.token = mintToken(state); changed = true; }
  });
  if (changed) db.prepare('UPDATE salon_state SET state_json = ? WHERE salon_id = ?').run(JSON.stringify(state), state.salonId);
  return state;
}

function isBusinessActive(businessId: string): boolean {
  const row = db.prepare('SELECT platform_status FROM salon WHERE id = ?').get(businessId) as { platform_status: string } | undefined;
  if (!row) return true;
  return row.platform_status === 'active';
}

function readState(salonId: string): SalonState {
  const salonRow = db.prepare('SELECT platform_status FROM salon WHERE id = ?').get(salonId) as { platform_status: string } | undefined;
  const platformStatus = salonRow?.platform_status || 'active';
  const row = db.prepare('SELECT state_json FROM salon_state WHERE salon_id = ?').get(salonId) as { state_json: string } | undefined;
  if (row) {
    const state = ensureTokens(JSON.parse(row.state_json) as SalonState);
    state.platformStatus = platformStatus;
    if (reconcileBarbers(state)) db.prepare('UPDATE salon_state SET state_json = ? WHERE salon_id = ?').run(JSON.stringify(state), state.salonId);
    return state;
  }
  const state = seedState(salonId);
  state.platformStatus = platformStatus;
  db.prepare('INSERT INTO salon_state (salon_id, version, state_json, updated_at) VALUES (?, ?, ?, ?)')
    .run(salonId, state.version, JSON.stringify(state), state.updatedAt);
  return state;
}

function writeState(state: SalonState) {
  state.version += 1;
  state.updatedAt = Date.now();
  db.prepare('UPDATE salon_state SET version = ?, state_json = ?, updated_at = ? WHERE salon_id = ?')
    .run(state.version, JSON.stringify(state), state.updatedAt, state.salonId);
}

/**
 * Attaches each queue entry's customer photo (if their account has one) at
 * serve time only — never persisted in salon_state, so a later profile-photo
 * change is reflected immediately rather than going stale. Reuses the same
 * customer_profile table customer-facing profile reads already use; no new
 * ownership of photo data is introduced.
 */
function withCustomerPhotos(state: SalonState): SalonState {
  const customerIds = [...new Set(state.queue.map((item) => item.customerId).filter((id): id is string => Boolean(id)))];
  if (!customerIds.length) return state;
  const rows = db.prepare(`SELECT customer_id, profile_photo_url FROM customer_profile WHERE customer_id IN (${customerIds.map(() => '?').join(',')})`)
    .all(...customerIds) as Array<{ customer_id: string; profile_photo_url: string }>;
  const photoByCustomer = new Map(rows.filter((row) => row.profile_photo_url).map((row) => [row.customer_id, row.profile_photo_url]));
  if (!photoByCustomer.size) return state;
  return {
    ...state,
    queue: state.queue.map((item) => (item.customerId && photoByCustomer.has(item.customerId)
      ? { ...item, customerPhotoUrl: photoByCustomer.get(item.customerId) }
      : item)),
  };
}

function publish(state: SalonState) {
  const payload = `event: state\ndata: ${JSON.stringify(withCustomerPhotos(state))}\n\n`;
  subscribers.get(state.salonId)?.forEach((response) => response.write(payload));
}

function findAvailableBarber(state: SalonState, preferredId?: string) {
  const preferred = preferredId ? state.barbers.findIndex((barber) => barber.id === preferredId && barber.status === 'available') : -1;
  return preferred >= 0 ? preferred : state.barbers.findIndex((barber) => barber.status === 'available');
}

function releaseBarber(state: SalonState, item: QueueItem) {
  if (item.barberIndex === undefined || !state.barbers[item.barberIndex]) return;
  state.barbers[item.barberIndex] = { ...state.barbers[item.barberIndex], status: 'available', currentCustomerName: undefined };
}

function applyCommand(state: SalonState, command: QueueCommand) {
  if (command.type === 'reset') return seedState(state.salonId);

  if (command.type === 'toggle_barber') {
    const index = state.barbers.findIndex((barber) => barber.id === command.barberId);
    if (index < 0) throw new Error('Barber not found.');
    const barber = state.barbers[index];
    if (barber.status === 'busy') throw new Error('A barber serving a customer cannot go off duty.');
    state.barbers[index] = { ...barber, status: barber.status === 'available' ? 'unavailable' : 'available' };
    return state;
  }

  if (command.type === 'save_staff') {
    // Manage Staff writes through the exact same table (and the exact same
    // validation) Admin's salon editor already uses — one staff model, two
    // front doors. Reconciling immediately means this shows up in the live
    // queue view without waiting for the next natural state read.
    saveStaffList(state.salonId, command.staff, Date.now());
    reconcileBarbers(state);
    return state;
  }

  if (command.type === 'save_offers') {
    // Staff Dashboard's Offers tab writes through the exact same table (and
    // the exact same validation) Admin's salon editor already uses — one
    // offer model, two front doors, same as save_staff above.
    saveOfferList(state.salonId, command.offers, Date.now());
    return state;
  }

  if (command.type === 'join') {
    if (!command.item.sessionId) throw new Error('Customer session is required.');
    if (state.queue.some((item) => item.sessionId === command.item.sessionId)) throw new Error('You already have an active booking at this salon.');
    // A requested stylist is a preference, not an assignment: the chair is only
    // bound at Call/Start time. An unknown id is dropped rather than rejected,
    // so a stale client can never fail a join over it.
    const requested = command.item.preferredBarberId
      ? state.barbers.find((barber) => barber.id === command.item.preferredBarberId)
      : undefined;
    // The applied offer is only ever a client HINT. The actual discount is
    // recomputed here from the live salon_offer row — a client-supplied
    // discountInr is never trusted or persisted as-is.
    let totalPriceInr = command.item.totalPriceInr;
    let appliedOfferId: string | undefined;
    let discountInr: number | undefined;
    if (command.item.appliedOfferId && typeof totalPriceInr === 'number') {
      const offerRow = db.prepare('SELECT * FROM salon_offer WHERE id = ? AND salon_id = ? AND active = 1')
        .get(command.item.appliedOfferId, state.salonId) as Record<string, string | number> | undefined;
      if (offerRow) {
        const offer: SalonOffer = {
          id: String(offerRow.id),
          title: String(offerRow.title),
          discount: String(offerRow.discount_text),
          discountType: offerRow.discount_type === 'fixed' ? 'fixed' : 'percent',
          discountValue: Number(offerRow.discount_value) || 0,
          minimumBillInr: Number(offerRow.minimum_bill) || undefined,
          startDate: String(offerRow.start_date || '') || undefined,
          endDate: String(offerRow.end_date || '') || undefined,
          active: true,
          eligibleServiceIds: offerRow.eligible_service_ids_json ? (JSON.parse(String(offerRow.eligible_service_ids_json)) as string[]) : undefined,
        };
        const result = evaluateCoupon(offer, { subtotalInr: totalPriceInr, serviceIds: [] });
        if (result.eligible) {
          appliedOfferId = offer.id;
          discountInr = result.discountInr;
          totalPriceInr = Math.max(0, totalPriceInr - result.discountInr);
        }
      }
    }
    state.queue.push({
      ...command.item,
      preferredBarberId: requested?.id,
      barberName: requested?.name,
      source: command.item.source || 'customer_app',
      id: randomUUID(),
      createdAt: Date.now(),
      token: mintToken(state),
      totalPriceInr,
      appliedOfferId,
      discountInr,
    });
    return state;
  }

  if (command.type === 'add_walkin') {
    const item = { ...command.item, source: command.item.source || 'staff_walk_in' as const, id: randomUUID(), createdAt: Date.now(), isUser: false, token: mintToken(state) };
    if (command.startImmediately) {
      const barberIndex = findAvailableBarber(state, command.preferredBarberId);
      if (barberIndex < 0) throw new Error('No barber is currently available.');
      const barber = state.barbers[barberIndex];
      state.barbers[barberIndex] = { ...barber, status: 'busy', currentCustomerName: item.name };
      state.queue.push({ ...item, status: 'Serving', barberIndex, barberName: barber.name });
    } else {
      const preferred = state.barbers.find((barber) => barber.id === command.preferredBarberId);
      state.queue.push({ ...item, status: 'Waiting', barberName: preferred?.name });
    }
    return state;
  }

  if (command.type === 'cancel_customer') {
    const item = state.queue.find((entry) => entry.sessionId === command.sessionId);
    // Idempotent: cancelling an entry that is already gone is a no-op.
    if (!item) return state;
    if (!canCancel(item.status)) throw new Error('This booking is already in service and cannot be cancelled.');
    releaseBarber(state, item);
    state.queue = state.queue.filter((entry) => entry.id !== item.id);
    state.completedList = [
      {
        ...item,
        status: 'Cancelled' as const,
        outcome: 'cancelled_customer' as const,
        cancelledBy: 'customer' as const,
        cancelReasonCode: normaliseCancelReason('customer', command.reasonCode),
        cancelReasonText: cleanText(command.reasonText, 300) || undefined,
        cancelledAt: Date.now(),
        // Removing the deadline guarantees a stale timer can never resurrect
        // this booking as call-again or no-show.
        graceExpiresAt: undefined,
      } as QueueItem,
      ...state.completedList,
    ].slice(0, 100);
    return state;
  }

  if (command.type === 'queue_action' && command.action === 'Submit-rating') {
    const queueIdx = state.queue.findIndex((item) => item.id === command.itemId);
    const completedIdx = state.completedList.findIndex((item) => item.id === command.itemId);
    const target = queueIdx >= 0 ? state.queue[queueIdx] : completedIdx >= 0 ? state.completedList[completedIdx] : undefined;
    if (!target) throw new Error('Booking no longer exists. Refreshing the latest history.');
    const rating = Math.max(1, Math.min(5, Math.round(Number(command.rating) || 5)));
    const updated = {
      ...target,
      rating,
      feedbackTags: Array.isArray(command.feedbackTags) ? command.feedbackTags.slice(0, 12) : [],
      feedbackComment: cleanText(command.feedbackComment, 300),
    };
    if (queueIdx >= 0) state.queue[queueIdx] = updated;
    if (completedIdx >= 0) state.completedList[completedIdx] = updated;
    return state;
  }

  const itemIndex = state.queue.findIndex((item) => item.id === command.itemId);
  if (itemIndex < 0) throw new Error('Queue entry no longer exists. Refreshing the latest queue.');
  const item = state.queue[itemIndex];

  if (command.action === 'Call') {
    if (!['Waiting', 'Reserved', 'Called'].includes(item.status)) throw new Error(`Cannot call a customer with status ${item.status}.`);
    // Pressing Call again inside a live arrival window is a no-op, so a double
    // tap cannot start a second timer or re-notify the customer.
    if (!shouldStartNewCall(item)) return state;
    const now = Date.now();
    let barberIndex = item.barberIndex;
    if (barberIndex === undefined || !state.barbers[barberIndex] || state.barbers[barberIndex].status === 'unavailable') {
      // Staff's explicit pick wins; otherwise honour the stylist the customer
      // asked for at join time before falling back to anyone available.
      barberIndex = findAvailableBarber(state, command.barberId || item.preferredBarberId);
    }
    if (barberIndex === undefined || barberIndex < 0) throw new Error('No barber is currently available.');
    const barber = state.barbers[barberIndex];
    state.barbers[barberIndex] = { ...barber, status: 'busy', currentCustomerName: item.name };
    state.queue[itemIndex] = {
      ...item,
      status: 'Called',
      barberIndex,
      barberName: barber.name,
      calledAt: now,
      graceExpiresAt: now + GRACE_WINDOW_MS,
      callAttempt: (item.callAttempt || 0) + 1,
      // A new call clears the previous acknowledgement.
      acknowledgedAt: undefined,
    };
  } else if (command.action === 'Acknowledge') {
    // Customer tapped "I'm on my way". Records intent only; the deadline that
    // staff set is never extended by it.
    if (item.status !== 'Called') return state;
    if (item.acknowledgedAt) return state;
    state.queue[itemIndex] = { ...item, acknowledgedAt: Date.now() };
  } else if (command.action === 'Start') {
    if (!['Waiting', 'Called', 'Reserved'].includes(item.status)) throw new Error(`Cannot start a customer with status ${item.status}.`);
    let barberIndex = item.barberIndex;
    if (barberIndex === undefined || !state.barbers[barberIndex] || state.barbers[barberIndex].status === 'unavailable') {
      barberIndex = findAvailableBarber(state, command.barberId || item.preferredBarberId);
    }
    if (barberIndex === undefined || barberIndex < 0) throw new Error('No barber is currently available.');
    const barber = state.barbers[barberIndex];
    state.barbers[barberIndex] = { ...barber, status: 'busy', currentCustomerName: item.name };
    // Clearing the deadline makes expiry idempotent: an in-service booking can
    // never later flip to CALL AGAIN or NO SHOW because of a stale timer.
    state.queue[itemIndex] = { ...item, status: 'Serving', barberIndex, barberName: barber.name, graceExpiresAt: undefined, serviceStartedAt: item.serviceStartedAt || Date.now() };
  } else if (command.action === 'Complete') {
    if (item.status !== 'Serving') throw new Error('Only an in-service customer can be completed.');
    releaseBarber(state, item);
    state.queue.splice(itemIndex, 1);
    const finalPaymentStatus = item.paymentStatus === 'cash_pending' ? 'paid' : (item.paymentStatus || 'paid');
    const finalPaymentMethod = item.paymentMethod || 'cash';
    state.completedList = [
      {
        ...item,
        status: 'Completed' as const,
        outcome: 'completed' as const,
        paymentStatus: finalPaymentStatus,
        paymentMethod: finalPaymentMethod,
        paidAt: item.paidAt || Date.now(),
        serviceCompletedAt: Date.now(),
      },
      ...state.completedList,
    ].slice(0, 100);
  } else if (command.action === 'Pay-online') {
    state.queue[itemIndex] = {
      ...item,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      paidAt: Date.now(),
    };
  } else if (command.action === 'Pay-cash') {
    state.queue[itemIndex] = {
      ...item,
      paymentMethod: 'cash',
      paymentStatus: 'cash_pending',
    };
  } else if (command.action === 'Confirm-cash-payment') {
    state.queue[itemIndex] = {
      ...item,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      paidAt: Date.now(),
    };
  } else if (command.action === 'Submit-rating') {
    const updated = {
      ...item,
      rating: command.rating,
      feedbackTags: command.feedbackTags,
      feedbackComment: command.feedbackComment,
    };
    if (itemIndex >= 0) {
      state.queue[itemIndex] = updated;
    }
    const compIdx = state.completedList.findIndex((c) => c.id === command.itemId);
    if (compIdx >= 0) {
      state.completedList[compIdx] = { ...state.completedList[compIdx], ...updated };
    }
  } else if (command.action === 'Cancel-chair') {
    if (!canCancel(item.status)) throw new Error('Complete or finish the active service before cancelling this chair.');
    releaseBarber(state, item);
    state.queue.splice(itemIndex, 1);
    state.completedList = [
      {
        ...item,
        status: 'Cancelled' as const,
        outcome: 'cancelled_staff' as const,
        cancelledBy: 'staff' as const,
        cancelReasonCode: normaliseCancelReason('staff', command.reasonCode),
        cancelReasonText: cleanText(command.reasonText, 300) || undefined,
        cancelledAt: Date.now(),
        graceExpiresAt: undefined,
      } as QueueItem,
      ...state.completedList,
    ].slice(0, 100);
  } else if (command.action === 'No-show') {
    if (item.status === 'Serving') throw new Error('Complete the active service before marking a no-show.');
    releaseBarber(state, item);
    state.queue.splice(itemIndex, 1);
    // Preserved in history with its real outcome so it is never counted as a
    // completed service.
    state.completedList = [
      { ...item, status: 'NoShow' as const, outcome: 'no_show' as const, noShowAt: Date.now() } as QueueItem,
      ...state.completedList,
    ].slice(0, 100);
  } else {
    if (item.status === 'Serving' && command.action === 'Remove') throw new Error('Complete the active service before removing this customer.');
    releaseBarber(state, item);
    state.queue.splice(itemIndex, 1);
  }
  return state;
}

const cleanText = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const asBoolean = (value: unknown) => value === true || value === 1;
const parseCoordinate = (value: unknown, min: number, max: number, label: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} is invalid.`);
  return number;
};

function adminSalonDetail(id: string) {
  const salon = db.prepare('SELECT * FROM salon WHERE id = ?').get(id) as SalonRow | undefined;
  if (!salon) return undefined;
  return {
    ...salon,
    isOpen: salon.is_open === 1,
    status: salon.platform_status,
    amenities: JSON.parse(salon.amenities_json || '[]'),
    hours: db.prepare('SELECT * FROM salon_hours WHERE salon_id = ? ORDER BY day_of_week').all(id),
    services: db.prepare('SELECT * FROM salon_service WHERE salon_id = ? ORDER BY sort_order, created_at').all(id),
    staff: db.prepare('SELECT * FROM salon_staff WHERE salon_id = ? ORDER BY sort_order, created_at').all(id),
    offers: db.prepare('SELECT * FROM salon_offer WHERE salon_id = ? ORDER BY sort_order, created_at').all(id),
    media: db.prepare('SELECT * FROM salon_media WHERE salon_id = ? ORDER BY sort_order, created_at').all(id),
  };
}

/**
 * Bulk-replaces a salon's staff roster in salon_staff — the single write
 * path for staff profiles, shared by Admin's salon editor and Staff
 * Dashboard's Manage Staff so neither can drift into a second staff model.
 */
function saveStaffList(salonId: string, rows: unknown[], now: number) {
  db.prepare('DELETE FROM salon_staff WHERE salon_id = ?').run(salonId);
  rows.forEach((raw, index) => {
    const row = (raw || {}) as Record<string, unknown>;
    const name = cleanText(row.name, 100); if (!name) throw new Error('Every staff member needs a name.');
    const status = ['available', 'busy', 'unavailable'].includes(String(row.working_status || row.status)) ? String(row.working_status || row.status) : 'available';
    const rating = Number(row.rating ?? 4.8);
    const reviewCount = Number(row.review_count ?? row.reviewCount ?? 0);
    const experienceYears = Number(row.experience_years ?? row.experienceYears ?? 3);
    const bio = cleanText(row.bio, 500) || '';
    const specialties = Array.isArray(row.specialties) ? row.specialties : [];
    db.prepare(`INSERT INTO salon_staff (id, salon_id, name, photo_url, role, service_ids_json, working_status, active, sort_order, rating, review_count, experience_years, bio, specialties_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        cleanText(row.id, 100) || randomUUID(),
        salonId,
        name,
        cleanText(row.photo_url || row.photoUrl, 1000),
        cleanText(row.role, 80) || 'Barber',
        JSON.stringify(Array.isArray(row.service_ids || row.serviceIds) ? (row.service_ids || row.serviceIds) : []),
        status,
        asBoolean(row.active) ? 1 : 0,
        index,
        rating,
        reviewCount,
        experienceYears,
        bio,
        JSON.stringify(specialties),
        now,
        now,
      );
  });
}

/**
 * Bulk-replaces a salon's offers/coupons in salon_offer — the single write
 * path shared by Admin's salon editor and Staff Dashboard's Offers tab, so
 * the discount a customer applies is always backed by this one table.
 */
function saveOfferList(salonId: string, rows: unknown[], now: number) {
  db.prepare('DELETE FROM salon_offer WHERE salon_id = ?').run(salonId);
  rows.forEach((raw, index) => {
    const row = (raw || {}) as Record<string, unknown>;
    const title = cleanText(row.title, 120); if (!title) throw new Error('Every offer needs a title.');
    const minimum = Number(row.minimum_bill ?? 0); if (!Number.isFinite(minimum) || minimum < 0) throw new Error('Minimum bill cannot be negative.');
    const discountType = String(row.discount_type) === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(row.discount_value ?? 0);
    if (!Number.isFinite(discountValue) || discountValue < 0) throw new Error(`Discount value for ${title} cannot be negative.`);
    if (discountType === 'percent' && discountValue > 100) throw new Error(`Percentage discount for ${title} cannot exceed 100.`);
    db.prepare(`INSERT INTO salon_offer (id, salon_id, title, discount_text, description, minimum_bill, start_date, end_date, terms, image_url, active, sort_order, code, discount_type, discount_value, eligible_service_ids_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(
        cleanText(row.id, 100) || randomUUID(), salonId, title, cleanText(row.discount_text, 120), cleanText(row.description, 1000), minimum,
        cleanText(row.start_date, 10), cleanText(row.end_date, 10), cleanText(row.terms, 2000), cleanText(row.image_url, 1000), asBoolean(row.active) ? 1 : 0, index,
        cleanText(row.code, 40), discountType, discountValue, JSON.stringify(Array.isArray(row.eligible_service_ids) ? row.eligible_service_ids : []), now, now,
      );
  });
}

function saveSalonRelations(salonId: string, body: Record<string, unknown>, now: number) {
  const replace = (table: string, rows: unknown[], insert: (row: Record<string, unknown>, index: number) => void) => {
    db.prepare(`DELETE FROM ${table} WHERE salon_id = ?`).run(salonId);
    rows.forEach((row, index) => insert((row || {}) as Record<string, unknown>, index));
  };
  replace('salon_hours', Array.isArray(body.hours) ? body.hours : [], (row, index) => {
    const openTime = cleanText(row.open_time ?? row.openTime, 5) || '09:00';
    const closeTime = cleanText(row.close_time ?? row.closeTime, 5) || '21:00';
    if (!/^\d{2}:\d{2}$/.test(openTime) || !/^\d{2}:\d{2}$/.test(closeTime)) throw new Error('Opening hours are invalid.');
    db.prepare('INSERT INTO salon_hours (salon_id, day_of_week, open_time, close_time, closed) VALUES (?, ?, ?, ?, ?)')
      .run(salonId, Number(row.day_of_week ?? index), openTime, closeTime, asBoolean(row.closed) ? 1 : 0);
  });
  replace('salon_service', Array.isArray(body.services) ? body.services : [], (row, index) => {
    const name = cleanText(row.name, 100); const price = Number(row.price_inr ?? row.priceInr); const duration = Number(row.duration_min ?? row.durationMin);
    if (!name) throw new Error('Every service needs a name.');
    if (!Number.isFinite(price) || price < 0) throw new Error(`Price for ${name} cannot be negative.`);
    if (!Number.isInteger(duration) || duration < 5 || duration > 600) throw new Error(`Duration for ${name} must be between 5 and 600 minutes.`);
    db.prepare(`INSERT INTO salon_service (id, salon_id, name, category, price_inr, duration_min, description, image_url, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(cleanText(row.id, 100) || randomUUID(), salonId, name, cleanText(row.category, 80), price, duration, cleanText(row.description, 1000), cleanText(row.image_url ?? row.imageUrl, 1000), asBoolean(row.active) ? 1 : 0, index, now, now);
  });
  saveStaffList(salonId, Array.isArray(body.staff) ? body.staff : [], now);
  saveOfferList(salonId, Array.isArray(body.offers) ? body.offers : [], now);
  replace('salon_media', Array.isArray(body.media) ? body.media : [], (row, index) => {
    const url = cleanText(row.url, 2000); if (!url) throw new Error('Every gallery item needs an image URL.');
    db.prepare(`INSERT INTO salon_media (id, salon_id, media_type, url, caption, featured, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(cleanText(row.id, 100) || randomUUID(), salonId, cleanText(row.media_type, 30) || 'gallery', url, cleanText(row.caption, 200), asBoolean(row.featured) ? 1 : 0, index, now, now);
  });
}

function saveGymState(gymId: string, state: any) {
  db.prepare('INSERT INTO gym_state (gym_id, state_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(gym_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at').run(gymId, JSON.stringify(state), Date.now());
}

function getGymState(gymId: string) {
  const row = db.prepare('SELECT state_json FROM gym_state WHERE gym_id = ?').get(gymId) as { state_json: string } | undefined;
  if (row) {
    return JSON.parse(row.state_json);
  }
  
  // Seed demo data if missing
  const state = {
    gymId,
    maxCapacity: 80,
    currentOccupancy: 42,
    waitingOutsideCount: 3,
    checkinsTodayCount: 96,
    classesToday: [
      { id: 'c1', title: 'HIIT Strength & Conditioning', time: '07:00 AM', trainer: 'Coach Vikram', enrolled: 14, maxCapacity: 20 },
      { id: 'c2', title: 'Power Yoga & Mobility', time: '09:00 AM', trainer: 'Coach Ananya', enrolled: 12, maxCapacity: 15 },
      { id: 'c3', title: 'CrossFit Blast', time: '05:30 PM', trainer: 'Coach Rahul', enrolled: 18, maxCapacity: 20 },
      { id: 'c4', title: 'Heavy Lifting Workshop', time: '07:00 PM', trainer: 'Coach Vikram', enrolled: 10, maxCapacity: 12 },
    ],
    trainers: [
      { id: 't1', name: 'Coach Vikram', role: 'Head Strength Coach', status: 'Available', rating: 4.9, reviewCount: 112 },
      { id: 't2', name: 'Coach Rahul', role: 'HIIT & Functional Specialist', status: 'In Session', rating: 4.8, reviewCount: 89 },
      { id: 't3', name: 'Coach Ananya', role: 'Yoga & Mobility Instructor', status: 'Available', rating: 4.9, reviewCount: 94 },
    ],
    entryQueue: [
      { id: 'q1', name: 'Rohan Sharma', memberId: 'IH-1082', arrivedAt: Date.now() - 5 * 60000, status: 'Waiting' },
      { id: 'q2', name: 'Priya Patel', memberId: 'IH-1094', arrivedAt: Date.now() - 3 * 60000, status: 'Waiting' },
      { id: 'q3', name: 'Amit Verma', memberId: 'IH-1102', arrivedAt: Date.now() - 1 * 60000, status: 'Waiting' },
    ],
  };
  saveGymState(gymId, state);
  return state;
}

app.post('/api/staff/login', (request, response) => {
  const email = cleanText(request.body?.email, 200).toLowerCase();
  const password = String(request.body?.password || '');
  const account = db.prepare(`
    SELECT sa.*, s.name as business_name, COALESCE(s.main_category_id, 'salon') as main_category_id
    FROM staff_account sa
    JOIN salon s ON sa.business_id = s.id
    WHERE sa.email = ? AND sa.active = 1
  `).get(email) as any;

  if (!account || !verifyPassword(password, account.password_hash)) {
    return response.status(401).json({ error: 'Invalid staff email or password.' });
  }

  const token = `staff_${randomUUID()}${randomUUID().replaceAll('-', '')}`;
  const now = Date.now();
  db.prepare('INSERT INTO staff_session (token_hash, staff_id, business_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(hashCode(token), account.id, account.business_id, now + 30 * 24 * 60 * 60_000, now);

  response.json({
    token,
    staff: { id: account.id, email: account.email, name: account.name, role: account.role },
    business: { id: account.business_id, name: account.business_name, mainCategoryId: account.main_category_id },
  });
});

app.get('/api/staff/session', (request, response) => {
  const session = resolveStaffSession(request);
  if (!session) {
    if (process.env.NODE_ENV !== 'production') {
      const defaultSalon = db.prepare("SELECT id, name, COALESCE(main_category_id, 'salon') as main_category_id FROM salon WHERE platform_status = 'active' ORDER BY id ASC LIMIT 1").get() as any;
      if (defaultSalon) {
        return response.json({
          token: 'dev-token',
          staff: { id: 'dev-owner', email: 'dev-owner@test.com', name: `${defaultSalon.name} Owner`, role: 'owner' },
          business: { id: defaultSalon.id, name: defaultSalon.name, mainCategoryId: defaultSalon.main_category_id },
        });
      }
    }
    return response.status(401).json({ error: 'Not authenticated as staff.' });
  }
  response.json({
    token: request.headers.authorization?.slice(7).trim() || 'active-session',
    staff: { id: session.staffId, email: session.email, name: session.name, role: session.role },
    business: { id: session.businessId, name: session.businessName, mainCategoryId: session.mainCategoryId },
  });
});

app.post('/api/staff/test-switch', (request, response) => {
  if (process.env.NODE_ENV === 'production') {
    return response.status(403).json({ error: 'Test switcher is disabled in production.' });
  }
  const businessId = cleanText(request.body?.businessId, 100);
  const role = cleanText(request.body?.role, 50) || 'owner';

  const salonRow = db.prepare("SELECT id, name, COALESCE(main_category_id, 'salon') as main_category_id FROM salon WHERE id = ?").get(businessId) as any;
  if (!salonRow) return response.status(404).json({ error: 'Business not found.' });

  const staffAccount = db.prepare('SELECT * FROM staff_account WHERE business_id = ? AND (role = ? OR ? = "") LIMIT 1').get(businessId, role, role) as any;

  const token = `test_token_${businessId}_${role}_${Date.now()}`;
  const now = Date.now();
  const staffId = staffAccount?.id || `test-${businessId}-${role}`;
  const staffName = staffAccount?.name || (role === 'trainer' ? 'Coach Vikram' : `${salonRow.name} ${role === 'owner' ? 'Owner' : 'Staff'}`);
  const staffEmail = staffAccount?.email || `test-${role}@${businessId}.test`;

  if (staffAccount) {
    db.prepare('INSERT INTO staff_session (token_hash, staff_id, business_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(hashCode(token), staffAccount.id, businessId, now + 30 * 24 * 60 * 60_000, now);
  }

  response.json({
    token,
    staff: { id: staffId, email: staffEmail, name: staffName, role },
    business: { id: salonRow.id, name: salonRow.name, mainCategoryId: salonRow.main_category_id },
  });
});

app.post('/api/staff/logout', (request, response) => {
  const token = String(request.headers.authorization || '').slice(7).trim();
  if (token) {
    db.prepare('DELETE FROM staff_session WHERE token_hash = ?').run(hashCode(token));
  }
  response.json({ ok: true });
});

app.get('/api/gym/:gymId/overview', (request, response) => {
  const session = resolveStaffSession(request);
  const gymId = request.params.gymId;
  if (!session || session.businessId !== gymId) {
    return response.status(403).json({ error: 'Valid staff session required for this business.' });
  }
  const state = getGymState(gymId);
  const availableTrainersCount = state.availableTrainersCount !== undefined ? state.availableTrainersCount : (state.trainers || []).filter((t) => t.status === 'Available').length;
  response.json({ ...state, availableTrainersCount });
});

app.post('/api/gym/:gymId/checkin', (request, response) => {
  const session = resolveStaffSession(request);
  const gymId = request.params.gymId;
  if (!isBusinessActive(gymId)) {
    return response.status(403).json({ error: 'Your business account has been deactivated. Operational actions are unavailable.', deactivated: true });
  }
  if (!session || session.businessId !== gymId) {
    return response.status(403).json({ error: 'Valid staff session required for this business.' });
  }
  const state = getGymState(gymId);
  if (state.currentOccupancy >= state.maxCapacity) {
    return response.status(400).json({ error: 'Gym is currently at maximum capacity.' });
  }
  state.currentOccupancy += 1;
  state.checkinsTodayCount += 1;
  if (state.waitingOutsideCount > 0) state.waitingOutsideCount -= 1;
  saveGymState(gymId, state);
  response.json({ ok: true, state });
});

app.post('/api/gym/:gymId/checkout', (request, response) => {
  const session = resolveStaffSession(request);
  const gymId = request.params.gymId;
  if (!isBusinessActive(gymId)) {
    return response.status(403).json({ error: 'Your business account has been deactivated. Operational actions are unavailable.', deactivated: true });
  }
  if (!session || session.businessId !== gymId) {
    return response.status(403).json({ error: 'Valid staff session required for this business.' });
  }
  const state = getGymState(gymId);
  if (state.currentOccupancy > 0) state.currentOccupancy -= 1;
  saveGymState(gymId, state);
  response.json({ ok: true, state });
});


app.put('/api/gym/:gymId/core-state', (request, response) => {
  const session = resolveStaffSession(request);
  const gymId = request.params.gymId;
  if (!isBusinessActive(gymId)) {
    return response.status(403).json({ error: 'Business deactivated.', deactivated: true });
  }
  if (!session || session.businessId !== gymId) {
    return response.status(403).json({ error: 'Valid staff session required for this business.' });
  }

  const state = getGymState(gymId);
  
  if (typeof request.body.currentOccupancy === 'number') {
    if (request.body.currentOccupancy >= 0 && request.body.currentOccupancy <= state.maxCapacity) {
      state.currentOccupancy = request.body.currentOccupancy;
    } else if (request.body.currentOccupancy > state.maxCapacity) {
      return response.status(400).json({ error: 'Occupancy cannot exceed max capacity.' });
    }
  }
  
  if (typeof request.body.maxCapacity === 'number') {
    if (request.body.maxCapacity >= 1 && request.body.maxCapacity >= state.currentOccupancy) {
      state.maxCapacity = request.body.maxCapacity;
    } else {
      return response.status(400).json({ error: 'Invalid max capacity.' });
    }
  }
  
  if (typeof request.body.availableTrainersCount === 'number') {
    if (request.body.availableTrainersCount >= 0) {
      state.availableTrainersCount = request.body.availableTrainersCount;
    }
  }
  
  saveGymState(gymId, state);
  response.json({ ok: true, state });
});

app.get('/api/gym/:gymId/public-overview', (request, response) => {
  const gymId = request.params.gymId;
  const salon = db.prepare("SELECT id, name, COALESCE(main_category_id, 'salon') as main_category_id FROM salon WHERE id = ?").get(gymId) as any;
  if (!salon || salon.main_category_id !== 'gym') {
    return response.status(404).json({ error: 'Gym business not found.' });
  }
  const state = getGymState(gymId);
  const availableTrainersCount = state.availableTrainersCount !== undefined ? state.availableTrainersCount : (state.trainers || []).filter((t) => t.status === 'Available').length;
  response.json({ ...state, availableTrainersCount });
});

app.post('/api/gym/:gymId/trainer-status', (request, response) => {
  const session = resolveStaffSession(request);
  const gymId = request.params.gymId;
  if (!isBusinessActive(gymId)) {
    return response.status(403).json({ error: 'Your business account has been deactivated. Operational actions are unavailable.', deactivated: true });
  }
  if (!session || session.businessId !== gymId) {
    return response.status(403).json({ error: 'Valid staff session required for this business.' });
  }
  const trainerId = cleanText(request.body?.trainerId, 100);
  const status = cleanText(request.body?.status, 50);
  const state = getGymState(gymId);
  const trainer = state.trainers.find((t) => t.id === trainerId);
  if (!trainer) return response.status(404).json({ error: 'Trainer not found.' });
  trainer.status = status;
  const availableTrainersCount = state.availableTrainersCount !== undefined ? state.availableTrainersCount : (state.trainers || []).filter((t) => t.status === 'Available').length;
  saveGymState(gymId, state);
  response.json({ ok: true, trainer, availableTrainersCount, state });
});

app.post('/api/gym/:gymId/settings', (request, response) => {
  const session = resolveStaffSession(request);
  const gymId = request.params.gymId;
  if (!isBusinessActive(gymId)) {
    return response.status(403).json({ error: 'Your business account has been deactivated. Operational actions are unavailable.', deactivated: true });
  }
  if (!session || session.businessId !== gymId) {
    return response.status(403).json({ error: 'Valid staff session required for this business.' });
  }
  if (session && session.role !== 'owner' && session.role !== 'manager') {
    return response.status(403).json({ error: 'Only Gym Owners can modify facility settings.' });
  }
  const newCapacity = parseInt(request.body?.maxCapacity, 10);
  if (isNaN(newCapacity) || newCapacity < 1) {
    return response.status(400).json({ error: 'Invalid maximum capacity value.' });
  }
  const state = getGymState(gymId);
  state.maxCapacity = newCapacity;
  saveGymState(gymId, state);
  response.json({ ok: true, maxCapacity: state.maxCapacity, state });
});

app.post('/api/gym/:gymId/class-booking', (request, response) => {
  const gymId = request.params.gymId;
  const classId = cleanText(request.body?.classId, 100);
  const memberName = cleanText(request.body?.memberName, 100) || 'Gym Member';
  const state = getGymState(gymId);
  const targetClass = state.classesToday.find((c) => c.id === classId);
  if (!targetClass) return response.status(404).json({ error: 'Class not found.' });
  if (targetClass.enrolled >= targetClass.maxCapacity) {
    return response.status(400).json({ error: 'Class is fully booked.' });
  }
  targetClass.enrolled += 1;
  saveGymState(gymId, state);
  response.json({ ok: true, class: targetClass, state });
});

app.post('/api/gym/:gymId/pt-booking', (request, response) => {
  const gymId = request.params.gymId;
  const trainerId = cleanText(request.body?.trainerId, 100);
  const trainerName = cleanText(request.body?.trainerName, 100) || 'Coach Vikram';
  const clientName = cleanText(request.body?.clientName, 100) || 'Gym Client';
  const timeSlot = cleanText(request.body?.timeSlot, 50) || '04:00 PM';
  const serviceName = cleanText(request.body?.serviceName, 100) || 'Personal Training 1-on-1';

  const state = getGymState(gymId);
  const newBooking = {
    id: `pt-${Date.now()}`,
    clientName,
    time: timeSlot,
    trainer: trainerName,
    service: serviceName,
    status: 'Confirmed',
  };
  saveGymState(gymId, state);
  response.json({ ok: true, booking: newBooking, state });
});

app.post('/api/admin/login', (request, response) => {
  const email = cleanText(request.body?.email, 200).toLowerCase();
  const password = String(request.body?.password || '');
  
  const isProd = process.env.NODE_ENV === 'production';
  let admin = db.prepare('SELECT id, email, password_hash FROM admin_user WHERE email = ?').get(email) as { id: string; email: string; password_hash: string } | undefined;
  
  let isValid = false;
  if (admin && verifyPassword(password, admin.password_hash)) {
    isValid = true;
  } else if (!isProd) {
    if ((email === 'admin@nowaitsalon.com' || !email) && (password === 'admin123' || password === 'admin')) {
      isValid = true;
    }
  }

  if (!isValid) {
    return response.status(401).json({ error: 'Invalid admin email or password.' });
  }

  let adminUser = admin || (db.prepare('SELECT id, email FROM admin_user LIMIT 1').get() as { id: string; email: string } | undefined);
  const now = Date.now();
  if (!adminUser) {
    if (isProd) {
      return response.status(401).json({ error: 'Admin authentication failed.' });
    }
    const newId = randomUUID();
    const demoEmail = email || 'admin@nowaitsalon.com';
    db.prepare('INSERT INTO admin_user (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(newId, demoEmail, passwordHash(password || 'admin123'), now, now);
    adminUser = { id: newId, email: demoEmail };
  }

  const token = `${randomUUID()}${randomUUID().replaceAll('-', '')}`;
  db.prepare('DELETE FROM admin_session WHERE expires_at <= ?').run(now);
  db.prepare('INSERT INTO admin_session (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashCode(token), adminUser.id, now + 12 * 60 * 60_000, now);
  response.json({ token, admin: { id: adminUser.id, email: adminUser.email }, expiresInSeconds: 43_200 });
});

app.post('/api/admin/logout', requireAdmin, (request, response) => {
  const token = String(request.headers.authorization || '').slice(7).trim();
  db.prepare('DELETE FROM admin_session WHERE token_hash = ?').run(hashCode(token));
  response.json({ ok: true });
});

app.get('/api/admin/summary', requireAdmin, (_request, response) => {
  const total = (db.prepare('SELECT COUNT(*) count FROM salon').get() as { count: number }).count;
  const active = (db.prepare("SELECT COUNT(*) count FROM salon WHERE platform_status = 'active'").get() as { count: number }).count;
  const customers = (db.prepare('SELECT COUNT(*) count FROM customer_account').get() as { count: number }).count;
  const bookings = (db.prepare('SELECT COUNT(*) count FROM customer_booking').get() as { count: number }).count;
  const liveQueues = (db.prepare("SELECT COUNT(*) count FROM salon_state WHERE state_json LIKE '%\"queue\":[{%' ").get() as { count: number }).count;
  response.json({ totalSalons: total, activeSalons: active, inactiveSalons: total - active, totalCustomers: customers, totalBookings: bookings, liveQueues });
});

app.get('/api/main-categories', (_request, response) => {
  const rows = db.prepare(`
    SELECT mc.*, 
    (SELECT COUNT(*) FROM salon s WHERE COALESCE(s.main_category_id, 'salon') = mc.id AND s.platform_status = 'active') as business_count 
    FROM main_category mc 
    WHERE mc.active = 1 
    ORDER BY mc.display_order ASC, mc.name ASC
  `).all() as Array<Record<string, unknown>>;
  const categories = rows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    iconName: String(r.icon_name),
    label: String(r.label),
    description: String(r.description || ''),
    displayOrder: Number(r.display_order || 0),
    active: Boolean(r.active),
    isDefault: Boolean(r.is_default),
    businessCount: Number(r.business_count || 0),
    themeKey: String(r.theme_key || 'salon'),
    primaryColor: String(r.primary_color || '#0F766E'),
    accentColor: String(r.accent_color || '#2DD4BF'),
    bannerImageUrl: String(r.banner_image_url || ''),
    bannerHeadline: String(r.banner_headline || ''),
    bannerSubheadline: String(r.banner_subheadline || ''),
    bannerCtaText: String(r.banner_cta_text || ''),
  }));
  response.json({ categories });
});

app.get('/api/business-qr-public/:businessId', (request, response) => {
  const businessId = request.params.businessId;
  const qr = db.prepare("SELECT public_token FROM business_qr WHERE business_id = ? AND status = 'active' LIMIT 1").get(businessId) as { public_token: string } | undefined;
  if (!qr) return response.status(404).json({ error: 'No active QR token found for this business.' });
  response.json({ token: qr.public_token });
});

app.get('/api/admin/main-categories', requireAdmin, (_request, response) => {
  const rows = db.prepare(`
    SELECT mc.*, 
    (SELECT COUNT(*) FROM salon s WHERE COALESCE(s.main_category_id, 'salon') = mc.id) as business_count 
    FROM main_category mc 
    ORDER BY mc.display_order ASC, mc.created_at ASC
  `).all() as Array<Record<string, unknown>>;
  const categories = rows.map(r => ({
    id: String(r.id),
    name: String(r.name),
    iconName: String(r.icon_name),
    label: String(r.label),
    description: String(r.description || ''),
    displayOrder: Number(r.display_order || 0),
    active: Boolean(r.active),
    isDefault: Boolean(r.is_default),
    businessCount: Number(r.business_count || 0),
    themeKey: String(r.theme_key || 'salon'),
    primaryColor: String(r.primary_color || '#0F766E'),
    accentColor: String(r.accent_color || '#2DD4BF'),
    bannerImageUrl: String(r.banner_image_url || ''),
    bannerHeadline: String(r.banner_headline || ''),
    bannerSubheadline: String(r.banner_subheadline || ''),
    bannerCtaText: String(r.banner_cta_text || ''),
  }));
  response.json({ categories });
});

app.post('/api/admin/main-categories', requireAdmin, async (request, response) => {
  try {
    const body = request.body as Record<string, unknown>;
    const name = cleanText(body.name, 100);
    if (!name) throw new Error('Category name is required.');
    const id = cleanText(body.id, 50).toLowerCase().replace(/[^a-z0-9_-]/g, '') || randomUUID();
    const iconName = cleanText(body.iconName, 50) || 'Scissors';
    const label = cleanText(body.label, 100) || name;
    const description = cleanText(body.description, 300);
    const displayOrder = Number(body.displayOrder) || 10;
    const active = asBoolean(body.active) ? 1 : 0;
    const themeKey = cleanText(body.themeKey, 50) || id;
    const primaryColor = cleanText(body.primaryColor, 30) || '#0F766E';
    const accentColor = cleanText(body.accentColor, 30) || '#2DD4BF';
    const bannerImageUrl = cleanText(body.bannerImageUrl, 500);
    const bannerHeadline = cleanText(body.bannerHeadline, 200);
    const bannerSubheadline = cleanText(body.bannerSubheadline, 300);
    const bannerCtaText = cleanText(body.bannerCtaText, 100);
    const now = Date.now();

    db.prepare(`
      INSERT INTO main_category (id, name, icon_name, label, description, display_order, active, is_default, theme_key, primary_color, accent_color, banner_image_url, banner_headline, banner_subheadline, banner_cta_text, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, iconName, label, description, displayOrder, active, themeKey, primaryColor, accentColor, bannerImageUrl, bannerHeadline, bannerSubheadline, bannerCtaText, now, now);

    await postgresPersistence?.flushNow(['main_category']);
    response.status(201).json({ category: { id, name, iconName, label, description, displayOrder, active: Boolean(active), isDefault: false, businessCount: 0, themeKey, primaryColor, accentColor, bannerImageUrl, bannerHeadline, bannerSubheadline, bannerCtaText } });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create category.' });
  }
});

app.put('/api/admin/main-categories/:id', requireAdmin, async (request, response) => {
  try {
    const id = request.params.id;
    const body = request.body as Record<string, unknown>;
    const name = cleanText(body.name, 100);
    if (!name) throw new Error('Category name is required.');
    const iconName = cleanText(body.iconName, 50) || 'Scissors';
    const label = cleanText(body.label, 100) || name;
    const description = cleanText(body.description, 300);
    const displayOrder = Number(body.displayOrder) || 10;
    const active = asBoolean(body.active) ? 1 : 0;
    const themeKey = cleanText(body.themeKey, 50) || id;
    const primaryColor = cleanText(body.primaryColor, 30) || '#0F766E';
    const accentColor = cleanText(body.accentColor, 30) || '#2DD4BF';
    const bannerImageUrl = cleanText(body.bannerImageUrl, 500);
    const bannerHeadline = cleanText(body.bannerHeadline, 200);
    const bannerSubheadline = cleanText(body.bannerSubheadline, 300);
    const bannerCtaText = cleanText(body.bannerCtaText, 100);
    const now = Date.now();

    const res = db.prepare(`
      UPDATE main_category
      SET name=?, icon_name=?, label=?, description=?, display_order=?, active=?, theme_key=?, primary_color=?, accent_color=?, banner_image_url=?, banner_headline=?, banner_subheadline=?, banner_cta_text=?, updated_at=?
      WHERE id=?
    `).run(name, iconName, label, description, displayOrder, active, themeKey, primaryColor, accentColor, bannerImageUrl, bannerHeadline, bannerSubheadline, bannerCtaText, now, id);

    if (!res.changes) return response.status(404).json({ error: 'Category not found.' });

    await postgresPersistence?.flushNow(['main_category']);
    response.json({ ok: true, category: { id, name, iconName, label, description, displayOrder, active: Boolean(active), themeKey, primaryColor, accentColor, bannerImageUrl, bannerHeadline, bannerSubheadline, bannerCtaText } });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to update category.' });
  }
});

app.patch('/api/admin/main-categories/:id/status', requireAdmin, async (request, response) => {
  const active = asBoolean(request.body?.active) ? 1 : 0;
  const res = db.prepare('UPDATE main_category SET active=?, updated_at=? WHERE id=?').run(active, Date.now(), request.params.id);
  if (!res.changes) return response.status(404).json({ error: 'Category not found.' });
  await postgresPersistence?.flushNow(['main_category']);
  response.json({ ok: true, active: Boolean(active) });
});

app.delete('/api/admin/main-categories/:id', requireAdmin, async (request, response) => {
  const id = request.params.id;
  const cat = db.prepare('SELECT is_default FROM main_category WHERE id=?').get(id) as { is_default: number } | undefined;
  if (!cat) return response.status(404).json({ error: 'Category not found.' });
  if (cat.is_default) return response.status(400).json({ error: 'Default category cannot be deleted.' });

  db.prepare("UPDATE salon SET main_category_id = 'salon' WHERE main_category_id = ?").run(id);
  db.prepare('DELETE FROM main_category WHERE id=?').run(id);
  await postgresPersistence?.flushNow(['main_category', 'salon']);
  response.json({ ok: true });
});

/* CUSTOMER SAVED ADDRESSES APIs */
app.get('/api/customer/addresses', requireCustomer, (request: AuthenticatedRequest, response) => {
  const rows = db.prepare('SELECT * FROM customer_address WHERE customer_id = ? ORDER BY is_default DESC, created_at DESC').all(request.customerId) as Array<Record<string, unknown>>;
  const addresses = rows.map(r => ({
    id: String(r.id),
    customerId: String(r.customer_id),
    label: String(r.label),
    fullAddress: String(r.full_address),
    area: String(r.area),
    city: String(r.city),
    state: String(r.state || ''),
    pinCode: String(r.pin_code || ''),
    latitude: Number(r.latitude || 0),
    longitude: Number(r.longitude || 0),
    isDefault: Boolean(r.is_default),
    createdAt: Number(r.created_at || 0),
    updatedAt: Number(r.updated_at || 0),
  }));
  response.json({ addresses });
});

app.post('/api/customer/addresses', requireCustomer, (request: AuthenticatedRequest, response) => {
  const body = request.body as Record<string, unknown>;
  const label = cleanText(body.label, 50) || 'Home Me';
  const fullAddress = cleanText(body.fullAddress, 300);
  const area = cleanText(body.area, 100);
  const city = cleanText(body.city, 100);
  const state = cleanText(body.state, 100);
  const pinCode = cleanText(body.pinCode, 20);
  const latitude = Number(body.latitude) || 12.9719;
  const longitude = Number(body.longitude) || 77.6412;
  const isDefault = asBoolean(body.isDefault) ? 1 : 0;
  const id = randomUUID();
  const now = Date.now();

  if (isDefault) {
    db.prepare('UPDATE customer_address SET is_default = 0 WHERE customer_id = ?').run(request.customerId);
  }

  db.prepare(`
    INSERT INTO customer_address (id, customer_id, label, full_address, area, city, state, pin_code, latitude, longitude, is_default, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, request.customerId, label, fullAddress, area, city, state, pinCode, latitude, longitude, isDefault, now, now);

  response.status(201).json({ address: { id, customerId: request.customerId, label, fullAddress, area, city, state, pinCode, latitude, longitude, isDefault: Boolean(isDefault), createdAt: now, updatedAt: now } });
});

app.patch('/api/customer/addresses/:id/default', requireCustomer, (request: AuthenticatedRequest, response) => {
  const addressId = request.params.id;
  db.prepare('UPDATE customer_address SET is_default = 0 WHERE customer_id = ?').run(request.customerId);
  const res = db.prepare('UPDATE customer_address SET is_default = 1, updated_at = ? WHERE id = ? AND customer_id = ?').run(Date.now(), addressId, request.customerId);
  if (!res.changes) return response.status(404).json({ error: 'Address not found.' });
  response.json({ ok: true, activeAddressId: addressId });
});

app.delete('/api/customer/addresses/:id', requireCustomer, (request: AuthenticatedRequest, response) => {
  db.prepare('DELETE FROM customer_address WHERE id = ? AND customer_id = ?').run(request.params.id, request.customerId);
  response.json({ ok: true });
});

app.post('/api/customer/address-requests', requireCustomer, (request: AuthenticatedRequest, response) => {
  const body = request.body as Record<string, unknown>;
  const areaName = cleanText(body.areaName, 100);
  const city = cleanText(body.city, 100);
  const pinCode = cleanText(body.pinCode, 20);
  const comments = cleanText(body.comments, 500);

  if (!areaName) return response.status(400).json({ error: 'Area name is required.' });

  const id = randomUUID();
  const now = Date.now();

  db.prepare(`
    INSERT INTO address_request (id, customer_id, area_name, city, pin_code, comments, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, request.customerId, areaName, city, pinCode, comments, now);

  response.status(201).json({ ok: true, request: { id, areaName, city, pinCode, comments, status: 'pending', createdAt: now } });
});

app.get('/api/admin/salons', requireAdmin, (_request, response) => {
  const rows = db.prepare(`SELECT s.*, (SELECT COUNT(*) FROM salon_service ss WHERE ss.salon_id=s.id) service_count,
    (SELECT COUNT(*) FROM salon_staff st WHERE st.salon_id=s.id) staff_count FROM salon s ORDER BY s.updated_at DESC, s.created_at DESC`).all();
  response.json({ salons: rows });
});

app.get('/api/admin/salons/:id', requireAdmin, (request, response) => {
  const salon = adminSalonDetail(request.params.id);
  if (!salon) return response.status(404).json({ error: 'Salon not found.' });
  response.json({ salon });
});

function qrPayload(request:express.Request,qr:BusinessQrRow,businessName:string){
  const configuredBase=String(process.env.PUBLIC_CUSTOMER_URL||'').replace(/\/$/,'');
  const base=configuredBase||`${request.protocol}://${request.get('host')}`;
  const publicUrl=`${base}/q/${encodeURIComponent(qr.public_token)}`;
  return{id:qr.id,businessId:qr.business_id,businessType:qr.business_type,businessName,publicToken:qr.public_token,status:qr.status,version:qr.version,createdAt:qr.created_at,updatedAt:qr.updated_at,publicUrl,previewImageUrl:qrSvgDataUrl(publicUrl),downloadImageUrl:qrPngDataUrl(publicUrl)};
}

app.get('/api/admin/businesses/:businessId/qr',requireAdmin,(request,response)=>{
  const salon=db.prepare('SELECT id,name FROM salon WHERE id=?').get(request.params.businessId) as {id:string;name:string}|undefined;
  if(!salon)return response.status(404).json({error:'Business not found.'});
  const qr=ensureBusinessQr(db,salon.id,'salon');
  response.set('Cache-Control','no-store');
  response.json({qr:qrPayload(request,qr,salon.name)});
});

app.post('/api/admin/businesses/:businessId/qr/regenerate',requireAdmin,async(request,response)=>{
  const salon=db.prepare('SELECT id,name FROM salon WHERE id=?').get(request.params.businessId) as {id:string;name:string}|undefined;
  if(!salon)return response.status(404).json({error:'Business not found.'});
  const now=Date.now();
  try{
    db.exec('BEGIN IMMEDIATE');
    db.prepare("UPDATE business_qr SET status='revoked',revoked_at=?,updated_at=? WHERE business_id=? AND business_type='salon' AND status='active'").run(now,now,salon.id);
    const qr=ensureBusinessQr(db,salon.id,'salon');
    db.exec('COMMIT');
    await postgresPersistence?.flushNow(['business_qr']);
    response.status(201).json({qr:qrPayload(request,qr,salon.name)});
  }catch(error){try{db.exec('ROLLBACK')}catch{}response.status(409).json({error:'Unable to replace this QR right now. Please try again.'})}
});

function resolveAdminMainCategoryId(body: Record<string, unknown>, fallback?: string) {
  const candidate = cleanText(body.main_category_id || body.mainCategoryId, 50) || cleanText(fallback, 50);
  if (!candidate) throw new Error('Main category is required.');
  const category = db.prepare('SELECT id FROM main_category WHERE id = ?').get(candidate);
  if (!category) throw new Error('Select a valid main category.');
  return category.id;
}

app.post('/api/admin/salons', requireAdmin, async (request, response) => {
  try {
    const body = request.body as Record<string, unknown>; const name = cleanText(body.name, 150); if (!name) throw new Error('Salon name is required.');
    const id = cleanText(body.id, 100) || randomUUID(); const now = Date.now();
    const latitude = parseCoordinate(body.latitude, -90, 90, 'Latitude'); const longitude = parseCoordinate(body.longitude, -180, 180, 'Longitude');
    const mainCategoryId = resolveAdminMainCategoryId(body);
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`INSERT INTO salon (id,name,address,latitude,longitude,rating,review_count,is_open,opening_hours,services_json,barbers_json,onboarded,created_at,
      category,main_category_id,phone_number,description,cover_image_url,logo_image_url,amenities_json,offers_json,gallery_json,brand_key,short_description,email,website_url,area,city,state,pin_code,promotional_banner_url,platform_status,updated_at)
      VALUES (?,?,?,?,?,0,0,?,?, '[]','[]',1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,name,cleanText(body.address,500),latitude,longitude,asBoolean(body.isOpen)?1:0,cleanText(body.opening_hours,100)||'9:00 AM–9:00 PM',now,
        cleanText(body.category,100),mainCategoryId,cleanText(body.phone_number,30),cleanText(body.description,3000),cleanText(body.cover_image_url,1000),cleanText(body.logo_image_url,1000),JSON.stringify(Array.isArray(body.amenities)?body.amenities:[]),'[]','[]',cleanText(body.brand_key,100),cleanText(body.short_description,300),cleanText(body.email,200),cleanText(body.website_url,1000),cleanText(body.area,100),cleanText(body.city,100),cleanText(body.state,100),cleanText(body.pin_code,10),cleanText(body.promotional_banner_url,1000),cleanText(body.status,20)||'draft',now);
    saveSalonRelations(id, body, now); ensureBusinessQr(db,id,'salon'); db.exec('COMMIT');
    await postgresPersistence?.flushNow(['salon','salon_hours','salon_service','salon_staff','salon_offer','salon_media','business_qr']);
    response.status(201).json({ salon: adminSalonDetail(id) });
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to create salon.' }); }
});

app.put('/api/admin/salons/:id', requireAdmin, async (request, response) => {
  try {
    const existing = adminSalonDetail(request.params.id); if (!existing) return response.status(404).json({ error: 'Salon not found.' });
    const body = request.body as Record<string, unknown>; const name = cleanText(body.name,150); if (!name) throw new Error('Salon name is required.');
    const latitude = parseCoordinate(body.latitude,-90,90,'Latitude'); const longitude = parseCoordinate(body.longitude,-180,180,'Longitude'); const now=Date.now();
    const mainCategoryId = resolveAdminMainCategoryId(body, String((existing as Record<string,unknown>).main_category_id || 'salon'));
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`UPDATE salon SET name=?,short_description=?,description=?,category=?,main_category_id=?,phone_number=?,email=?,website_url=?,address=?,area=?,city=?,state=?,pin_code=?,latitude=?,longitude=?,
      is_open=?,opening_hours=?,logo_image_url=?,cover_image_url=?,promotional_banner_url=?,amenities_json=?,platform_status=?,updated_at=? WHERE id=?`)
      .run(name,cleanText(body.short_description,300),cleanText(body.description,3000),cleanText(body.category,100),mainCategoryId,cleanText(body.phone_number,30),cleanText(body.email,200),cleanText(body.website_url,1000),cleanText(body.address,500),cleanText(body.area,100),cleanText(body.city,100),cleanText(body.state,100),cleanText(body.pin_code,10),latitude,longitude,asBoolean(body.isOpen)?1:0,cleanText(body.opening_hours,100)||'9:00 AM–9:00 PM',cleanText(body.logo_image_url,1000),cleanText(body.cover_image_url,1000),cleanText(body.promotional_banner_url,1000),JSON.stringify(Array.isArray(body.amenities)?body.amenities:[]),cleanText(body.status,20)||'draft',now,request.params.id);
    saveSalonRelations(request.params.id,body,now); db.exec('COMMIT'); publish(readState(request.params.id));
    await postgresPersistence?.flushNow(['salon','salon_hours','salon_service','salon_staff','salon_offer','salon_media']);
    response.json({ salon: adminSalonDetail(request.params.id) });
  } catch(error){ try{db.exec('ROLLBACK');}catch{} response.status(400).json({error:error instanceof Error?error.message:'Unable to save salon.'}); }
});

app.patch('/api/admin/salons/:id/status', requireAdmin, async (request,response) => {
  const status=cleanText(request.body?.status,20); if(!['draft','active','inactive','suspended','deactivated'].includes(status)) return response.status(400).json({error:'Invalid salon status.'});
  const result=db.prepare('UPDATE salon SET platform_status=?, updated_at=? WHERE id=?').run(status,Date.now(),request.params.id);
  if(!result.changes) return response.status(404).json({error:'Salon not found.'}); if(status==='active')ensureBusinessQr(db,request.params.id,'salon');
  publish(readState(request.params.id));
  await postgresPersistence?.flushNow(['salon','business_qr']);
  response.json({ok:true,status});
});

app.post('/api/admin/media/upload', requireAdmin, (request,response) => {
  const match=String(request.body?.dataUrl||'').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/); if(!match) return response.status(400).json({error:'Upload a PNG, JPEG, or WebP image.'});
  const bytes=Buffer.from(match[2],'base64'); if(bytes.length>2*1024*1024) return response.status(413).json({error:'Image must be 2 MB or smaller.'});
  const extension=match[1].split('/')[1].replace('jpeg','jpg'); const filename=`${randomUUID()}.${extension}`; writeFileSync(path.join(salonMediaDir,filename),bytes);
  response.status(201).json({url:`/salon-media/${filename}`});
});

app.get('/api/admin/customers', requireAdmin, (_request,response) => response.json({customers:db.prepare(`SELECT a.id,a.phone_number,p.name,p.email,a.created_at,
  (SELECT COUNT(*) FROM customer_booking b WHERE b.customer_id=a.id) booking_count FROM customer_account a JOIN customer_profile p ON p.customer_id=a.id ORDER BY a.created_at DESC`).all()}));

// Render injects RENDER_GIT_COMMIT into the running container, so a deploy can
// be verified against the commit it was supposed to ship rather than assumed.
const BUILD_COMMIT = (process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || '').trim();

app.get('/api/health', (_request, response) => {
  db.prepare('SELECT 1').get();
  response.set('Cache-Control', 'no-store');
  response.json({
    ok: true,
    timestamp: Date.now(),
    commit: BUILD_COMMIT || null,
    database: postgresPersistence ? 'postgres' : 'sqlite',
  });
});

const qrJoinAttempts=new Map<string,{count:number;resetAt:number}>();
function resolvedBusinessQr(token:string){
  const qr=findActiveBusinessQr(db,token);
  if(!qr||qr.business_type!=='salon')return undefined;
  const salonRow=db.prepare("SELECT * FROM salon WHERE id=? AND onboarded=1 AND platform_status='active'").get(qr.business_id) as SalonRow|undefined;
  if(!salonRow)return undefined;
  return{qr,salonRow,salon:rowToSalon(salonRow)};
}

app.get('/api/public/qr-token/:businessId', (request, response) => {
  const businessId = request.params.businessId;
  const qr = db.prepare("SELECT public_token FROM business_qr WHERE business_id = ? AND status = 'active' LIMIT 1").get(businessId) as { public_token: string } | undefined;
  if (!qr) return response.status(404).json({ error: 'No active QR token found for this business.' });
  response.json({ token: qr.public_token });
});

app.get('/api/business-qr/:token',(request,response)=>{
  const resolved=resolvedBusinessQr(cleanText(request.params.token,200));
  if(!resolved)return response.status(404).json({error:"This QR isn't linked to a business on our platform.",code:'INVALID_BUSINESS_QR'});
  const state=readState(resolved.salon.id);
  const waitingCustomers=state.queue.filter(item=>['Waiting','Called'].includes(item.status)).length;
  const activeBarbers=state.barbers.filter(barber=>barber.status!=='unavailable').length;
  const liveWaitMinutes=activeBarbers?Math.max(0,Math.ceil(waitingCustomers*15/activeBarbers)):0;
  response.set('Cache-Control','no-store');
  response.json({business:{...resolved.salon,businessType:resolved.qr.business_type,qrStatus:resolved.qr.status,liveWaitMinutes,waitingCustomers,queueAccepting:resolved.salon.isOpen&&activeBarbers>0}});
});

function markWebAttributionJoined(businessId:string,qrId:string,customerId:string,at:number){
  const existing=db.prepare('SELECT id FROM web_qr_attribution WHERE business_id=? AND customer_id=? ORDER BY created_at DESC LIMIT 1').get(businessId,customerId) as {id:string}|undefined;
  if(existing)db.prepare('UPDATE web_qr_attribution SET joined_at=?,updated_at=? WHERE id=?').run(at,at,existing.id);
  else db.prepare('INSERT INTO web_qr_attribution (id,business_id,qr_token_id,customer_id,acquisition_source,first_visit_at,joined_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(randomUUID(),businessId,qrId,customerId,'salon_qr_web',at,at,at,at);
}

// Records that a plain-camera visitor landed on a public salon page. Anonymous:
// no customer is attached until they authenticate and join.
app.post('/api/business-qr/:token/visit',async(request,response)=>{
  const resolved=resolvedBusinessQr(cleanText(request.params.token,200));
  if(!resolved)return response.status(404).json({error:"This QR isn't linked to a business on our platform.",code:'INVALID_BUSINESS_QR'});
  const now=Date.now();
  const ctaShown=asBoolean(request.body?.appCtaShown)?1:0;
  const ctaClicked=asBoolean(request.body?.appCtaClicked)?1:0;
  db.prepare('INSERT INTO web_qr_attribution (id,business_id,qr_token_id,customer_id,acquisition_source,first_visit_at,app_cta_shown,app_cta_clicked,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(randomUUID(),resolved.salon.id,resolved.qr.id,null,'salon_qr_web',now,ctaShown,ctaClicked,now,now);
  await postgresPersistence?.flushNow(['web_qr_attribution']);
  response.status(201).json({recorded:true});
});

// Marketing consent is explicit and separate from joining a queue. Queue access
// never depends on it.
app.put('/api/me/marketing-consent',requireCustomer,async(request:AuthenticatedRequest,response)=>{
  const consent=asBoolean(request.body?.consent)?1:0;
  db.prepare('UPDATE customer_profile SET marketing_consent=?,updated_at=? WHERE customer_id=?').run(consent,Date.now(),request.customerId);
  await postgresPersistence?.flushNow(['customer_profile']);
  response.json({marketingConsent:consent===1});
});

app.post('/api/business-qr/:token/join',requireCustomer,async(request:AuthenticatedRequest,response)=>{
  const resolved=resolvedBusinessQr(cleanText(request.params.token,200));
  if(!resolved)return response.status(404).json({error:"This QR isn't linked to a business on our platform.",code:'INVALID_BUSINESS_QR'});
  if(!resolved.salon.isOpen)return response.status(409).json({error:'This business is not accepting queue entries right now.',code:'QUEUE_CLOSED'});
  // Accepts either the legacy single `serviceId` or the new multi-select
  // `serviceIds` array; both resolve to the same validated service rows.
  const requestedIds:string[]=Array.isArray(request.body?.serviceIds)?request.body.serviceIds.map((value:unknown)=>cleanText(value,120)).filter((value:string)=>value.length>0):[];
  const singleId=cleanText(request.body?.serviceId,120);
  const serviceIds:string[]=Array.from(new Set<string>(requestedIds.length?requestedIds:singleId?[singleId]:[]));
  if(!serviceIds.length)return response.status(400).json({error:'Please choose at least one service.',code:'SERVICE_UNAVAILABLE'});
  const placeholders=serviceIds.map(()=>'?').join(',');
  const queryArgs:Array<string>=[resolved.salon.id,...serviceIds];
  const rows=db.prepare(`SELECT id,name,duration_min,price_inr FROM salon_service WHERE salon_id=? AND active=1 AND id IN (${placeholders})`).all(...queryArgs) as Array<{id:string;name:string;duration_min:number;price_inr:number}>;
  if(rows.length!==serviceIds.length)return response.status(400).json({error:'Please choose an available service.',code:'SERVICE_UNAVAILABLE'});
  // Preserve the order the customer picked them in, not the DB row order.
  const services=serviceIds.map(id=>rows.find(row=>row.id===id)!);
  const sessionId=cleanText(request.body?.sessionId,160);
  if(!sessionId)return response.status(400).json({error:'Unable to continue this scan. Please scan again.',code:'INVALID_SCAN_SESSION'});
  // Only the two QR-originated sources may be claimed by this endpoint; never
  // trust an arbitrary source string from the client.
  const requestedSource:QueueItem['source']=cleanText(request.body?.source,32)==='qr_web'?'qr_web':'qr_walk_in';
  const current=readState(resolved.salon.id);
  const existing=current.queue.find(item=>item.customerId===request.customerId);
  if(existing)return response.json({joined:false,reason:'already_in_queue',entry:existing,state:current});
  const rateKey=`${request.customerId}:${resolved.qr.id}`;const now=Date.now();const attempt=qrJoinAttempts.get(rateKey);
  if(attempt&&attempt.resetAt>now&&attempt.count>=6)return response.status(429).json({error:'Too many attempts. Please wait a moment and try again.',code:'RATE_LIMITED'});
  qrJoinAttempts.set(rateKey,{count:attempt&&attempt.resetAt>now?attempt.count+1:1,resetAt:attempt&&attempt.resetAt>now?attempt.resetAt:now+60_000});
  const profile=readCustomerProfile(request.customerId!);
  const serviceNames=services.map(service=>service.name);
  const totalDurationMin=services.reduce((sum,service)=>sum+(Number(service.duration_min)||0),0)||30;
  const totalPriceInr=services.reduce((sum,service)=>sum+(Number(service.price_inr)||0),0);
  // A requested stylist is validated against this salon's roster; an unknown id
  // is dropped rather than rejected so a stale page cannot fail the join.
  const requestedBarberId=cleanText(request.body?.preferredBarberId,120);
  const preferredBarber=requestedBarberId?current.barbers.find(barber=>barber.id===requestedBarberId):undefined;
  const item:QueueItem={id:randomUUID(),name:String(profile.name||`Customer •${String(profile.phone_number).slice(-4)}`),phone:String(profile.phone_number),service:serviceNames.join(' + '),services:serviceNames,totalPriceInr,status:'Waiting',isUser:true,sessionId,customerId:request.customerId,createdAt:now,estimatedDurationMin:totalDurationMin,preferredBarberId:preferredBarber?.id,barberName:preferredBarber?.name,source:requestedSource};
  try{
    db.exec('BEGIN IMMEDIATE');
    const latest=readState(resolved.salon.id);
    const duplicate=latest.queue.find(entry=>entry.customerId===request.customerId);
    if(duplicate){db.exec('ROLLBACK');return response.json({joined:false,reason:'already_in_queue',entry:duplicate,state:latest})}
    latest.queue.push(item);writeState(latest);upsertBooking(resolved.salon.id,item);
    if(requestedSource==='qr_web')markWebAttributionJoined(resolved.salon.id,resolved.qr.id,request.customerId!,now);
    db.exec('COMMIT');publish(latest);
    await postgresPersistence?.flushNow(['customer_booking','salon_state','web_qr_attribution']);
    response.status(201).json({joined:true,entry:item,state:latest});
  }catch(error){try{db.exec('ROLLBACK')}catch{}response.status(409).json({error:'Unable to join this queue right now. Please try again.',code:'QUEUE_JOIN_FAILED'})}
});

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const distanceBetweenKm = (latitude: number, longitude: number, salonLatitude: number, salonLongitude: number) => {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(salonLatitude - latitude);
  const longitudeDelta = toRadians(longitude - longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(salonLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

// Lightweight directory so the Staff app can bind itself to a salon. Read-only
// and public: it exposes only the id and name of onboarded, active salons.
app.get('/api/salons/directory', (_request, response) => {
  const salons = readOnboardedSalons().map((salon) => ({ id: salon.id, name: salon.name, address: salon.address }));
  response.json({ salons });
});

app.get('/api/salons/nearby', (request, response) => {
  const latitude = Number(request.query.lat);
  const longitude = Number(request.query.lng);
  const area = String(request.query.area || '').trim().toLocaleLowerCase();
  const categoryId = String(request.query.categoryId || request.query.category || '').trim().toLowerCase();
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  if (!hasCoordinates && area.length < 2) {
    return response.status(400).json({ error: 'Share your location or enter a city or area.' });
  }

  const matches = readOnboardedSalons()
    .filter((salon) => !area || `${salon.name} ${salon.address}`.toLocaleLowerCase().includes(area))
    .filter((salon) => !categoryId || (salon.mainCategoryId || 'salon').toLowerCase() === categoryId)
    .map((salon) => {
      const state = readState(salon.id);
      const waitingCustomers = state.queue.filter((item) => ['Waiting', 'Called'].includes(item.status)).length;
      const activeBarbers = state.barbers.filter((barber) => barber.status !== 'unavailable').length;
      const liveWaitMinutes = activeBarbers > 0 ? Math.max(0, Math.ceil(waitingCustomers * 15 / activeBarbers)) : 0;
      const distanceKm = hasCoordinates
        ? Number(distanceBetweenKm(latitude, longitude, salon.latitude, salon.longitude).toFixed(1))
        : salon.distanceKm;
      return {
        ...salon,
        distanceKm,
        travelTimeMinutes: Math.max(3, Math.round(distanceKm * 4)),
        liveWaitMinutes,
        waitingCustomers,
      };
    })
    .sort((first, second) => first.distanceKm - second.distanceKm);

  response.set('Cache-Control', 'no-store');
  response.json({ salons: matches, source: hasCoordinates ? 'gps' : 'manual' });
});

// Same salon record the public QR page reads, so the app can refresh a salon
// it already has selected and never render a stale profile.
app.get('/api/salons/:salonId/profile', (request, response) => {
  const row = db.prepare("SELECT * FROM salon WHERE id = ? AND onboarded = 1").get(request.params.salonId) as SalonRow | undefined;
  if (!row) return response.status(404).json({ error: 'Salon not found.' });
  const salon = rowToSalon(row);
  const state = readState(salon.id);
  const waitingCustomers = state.queue.filter((item) => ['Waiting', 'Called'].includes(item.status)).length;
  const activeBarbers = state.barbers.filter((barber) => barber.status !== 'unavailable').length;
  const liveWaitMinutes = activeBarbers ? Math.max(0, Math.ceil(waitingCustomers * 15 / activeBarbers)) : 0;
  response.set('Cache-Control','no-store');
  response.json({ salon: { ...salon, platformStatus: row.platform_status, liveWaitMinutes, waitingCustomers, queueAccepting: salon.isOpen && activeBarbers > 0 } });
});

app.get('/api/salons/:salonId/state', (request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json(withCustomerPhotos(readState(request.params.salonId)));
});

app.get('/api/salons/:salonId/events', (request, response) => {
  const salonId = request.params.salonId;
  response.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  response.flushHeaders();
  response.write(`retry: 1500\nevent: state\ndata: ${JSON.stringify(withCustomerPhotos(readState(salonId)))}\n\n`);
  const salonSubscribers = subscribers.get(salonId) || new Set<express.Response>();
  salonSubscribers.add(response);
  subscribers.set(salonId, salonSubscribers);
  const heartbeat = setInterval(() => response.write(': keepalive\n\n'), 20_000);
  request.on('close', () => {
    clearInterval(heartbeat);
    salonSubscribers.delete(response);
  });
});

app.post('/api/salons/:salonId/commands', async (request, response) => {
  if (!isBusinessActive(request.params.salonId)) {
    return response.status(403).json({ error: 'Your business account has been deactivated. Operational actions are unavailable.', deactivated: true });
  }
  try {
    db.exec('BEGIN IMMEDIATE');
    const current = readState(request.params.salonId);
    const command = structuredClone(request.body) as QueueCommand;
    const authenticatedCustomerId = resolveCustomerId(request);
    if (command.type === 'join' && authenticatedCustomerId) command.item.customerId = authenticatedCustomerId;
    const previousItems = new Map(current.queue.map((item) => [item.id, item]));
    const next = applyCommand(structuredClone(current), command);
    if (next.version !== current.version) next.version = current.version;
    writeState(next);
    next.queue.forEach((item) => upsertBooking(next.salonId, item));
    next.completedList.forEach((item) => upsertBooking(next.salonId, item));
    if (command.type === 'cancel_customer') {
      const cancelled = [...previousItems.values()].find((item) => item.sessionId === command.sessionId);
      if (cancelled?.customerId) {
        upsertBooking(next.salonId, { ...cancelled, status: 'Completed' });
        // The completedList upsert above already carried the structured
        // cancellation, so only the display status needs syncing here.
        db.prepare('UPDATE customer_booking SET status = ?, updated_at = ? WHERE queue_entry_id = ?')
          .run('Cancelled', Date.now(), cancelled.id);
      }
    } else if (command.type === 'queue_action' && ['No-show', 'Remove', 'Cancel-chair'].includes(command.action)) {
      const removed = previousItems.get(command.itemId);
      // A no-show is recorded as its own outcome so reporting never counts it
      // as a completed service.
      const outcome =
        command.action === 'No-show' ? 'no_show' : command.action === 'Cancel-chair' ? 'cancelled_staff' : 'removed';
      const stamp = Date.now();
      if (removed?.customerId) {
        db.prepare('UPDATE customer_booking SET status = ?, outcome = ?, no_show_at = ?, updated_at = ? WHERE queue_entry_id = ?')
          .run(command.action, outcome, command.action === 'No-show' ? stamp : null, stamp, removed.id);
      }
    }
    db.exec('COMMIT');
    publish(next);
    await postgresPersistence?.flushNow(['customer_booking','salon_state']);
    response.json(withCustomerPhotos(next));
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* transaction was not active */ }
    response.status(409).json({ error: error instanceof Error ? error.message : 'Unable to update the queue.' });
  }
});

app.post('/api/otp/request', (request, response) => {
  const phone = String(request.body?.phone || '').replace(/\D/g, '');
  if (phone.length !== 10) return response.status(400).json({ error: 'Enter a valid 10-digit mobile number.' });
  const id = randomUUID();
  const code = String(Math.floor(1000 + Math.random() * 9000));
  db.prepare('INSERT INTO otp_challenge (id, phone, code_hash, expires_at) VALUES (?, ?, ?, ?)')
    .run(id, phone, hashCode(code), Date.now() + 5 * 60_000);
  response.json({ challengeId: id, demoCode: code, expiresInSeconds: 300 });
});

app.post('/api/otp/verify', async (request, response) => {
  const challenge = db.prepare('SELECT * FROM otp_challenge WHERE id = ?').get(String(request.body?.challengeId || '')) as
    | { id: string; phone: string; code_hash: string; expires_at: number; attempts: number; verified_at?: number }
    | undefined;
  if (!challenge || challenge.expires_at < Date.now()) return response.status(410).json({ error: 'OTP expired. Request a new code.' });
  if (challenge.verified_at) return response.status(409).json({ error: 'OTP was already used.' });
  if (challenge.attempts >= 5) return response.status(429).json({ error: 'Too many attempts. Request a new code.' });
  if (challenge.code_hash !== hashCode(String(request.body?.code || ''))) {
    db.prepare('UPDATE otp_challenge SET attempts = attempts + 1 WHERE id = ?').run(challenge.id);
    return response.status(400).json({ error: 'Incorrect OTP.' });
  }
  db.prepare('UPDATE otp_challenge SET verified_at = ? WHERE id = ?').run(Date.now(), challenge.id);
  const now = Date.now();
  let account = db.prepare('SELECT id FROM customer_account WHERE phone_number = ?').get(challenge.phone) as { id: string } | undefined;
  if (!account) {
    account = { id: randomUUID() };
    db.prepare('INSERT INTO customer_account (id, phone_number, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(account.id, challenge.phone, now, now);
    db.prepare('INSERT INTO customer_profile (customer_id, created_at, updated_at) VALUES (?, ?, ?)')
      .run(account.id, now, now);
  }
  const token = `${randomUUID()}${randomUUID().replaceAll('-', '')}`;
  db.prepare('INSERT INTO customer_session (token_hash, customer_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashCode(token), account.id, now + 30 * 24 * 60 * 60_000, now);
  await postgresPersistence?.flushNow(['otp_challenge','customer_account','customer_profile','customer_session']);
  response.json({ verified: true, phone: challenge.phone, token, customerId: account.id });
});

app.get('/api/me/profile', requireCustomer, (request: AuthenticatedRequest, response) => {
  response.set('Cache-Control', 'no-store');
  response.json(profileResponse(readCustomerProfile(request.customerId!)));
});

app.put('/api/me/profile', requireCustomer, async (request: AuthenticatedRequest, response) => {
  const name = String(request.body?.name || '').trim();
  const email = String(request.body?.email || '').trim().toLowerCase();
  const dateOfBirth = String(request.body?.dateOfBirth || '').trim();
  const gender = String(request.body?.gender || '').trim();
  const anniversary = String(request.body?.anniversary || '').trim();
  const city = String(request.body?.city || '').trim();
  if (name && (name.length < 2 || name.length > 80)) return response.status(400).json({ error: 'Name must be between 2 and 80 characters.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: 'Enter a valid email address.' });
  const today = new Date().toISOString().slice(0, 10);
  if (dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || dateOfBirth >= today)) {
    return response.status(400).json({ error: 'Enter a valid date of birth in the past.' });
  }
  if (anniversary && (!/^\d{4}-\d{2}-\d{2}$/.test(anniversary) || anniversary > today)) {
    return response.status(400).json({ error: 'Enter a valid anniversary date.' });
  }
  if (city.length > 100) return response.status(400).json({ error: 'City or area is too long.' });
  const now = Date.now();
  db.prepare(`UPDATE customer_profile SET name = ?, email = ?, date_of_birth = ?, gender = ?, anniversary = ?, city = ?, updated_at = ? WHERE customer_id = ?`)
    .run(name, email, dateOfBirth, gender, anniversary, city, now, request.customerId!);
  db.prepare('UPDATE customer_account SET updated_at = ? WHERE id = ?').run(now, request.customerId!);
  await postgresPersistence?.flushNow(['customer_account','customer_profile']);
  response.json(profileResponse(readCustomerProfile(request.customerId!)));
});

app.post('/api/me/profile/photo', requireCustomer, (request: AuthenticatedRequest, response) => {
  const dataUrl = String(request.body?.dataUrl || '');
  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return response.status(400).json({ error: 'Choose a JPEG, PNG, or WebP image.' });
  const image = Buffer.from(match[2], 'base64');
  if (image.byteLength > 256 * 1024) return response.status(413).json({ error: 'Profile photo must be smaller than 256 KB.' });
  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const filename = `${request.customerId}.${extension}`;
  writeFileSync(path.join(profilePhotoDir, filename), image, { mode: 0o600 });
  const profilePhotoUrl = '/api/me/profile/photo';
  db.prepare('UPDATE customer_profile SET profile_photo_url = ?, updated_at = ? WHERE customer_id = ?')
    .run(profilePhotoUrl, Date.now(), request.customerId!);
  response.json(profileResponse(readCustomerProfile(request.customerId!)));
});

app.get('/api/me/profile/photo', requireCustomer, (request: AuthenticatedRequest, response) => {
  const profile = readCustomerProfile(request.customerId!);
  if (!profile.profile_photo_url) return response.sendStatus(404);
  const extensions = ['jpg', 'png', 'webp'];
  const extension = extensions.find((candidate) => {
    try { readFileSync(path.join(profilePhotoDir, `${request.customerId}.${candidate}`)); return true; } catch { return false; }
  });
  if (!extension) return response.sendStatus(404);
  response.set('Cache-Control', 'private, max-age=300');
  response.type(extension === 'jpg' ? 'image/jpeg' : `image/${extension}`);
  response.send(readFileSync(path.join(profilePhotoDir, `${request.customerId}.${extension}`)));
});

app.get('/api/me/bookings', requireCustomer, (request: AuthenticatedRequest, response) => {
  const bookings = (db.prepare(`
    SELECT id, salon_id AS salonId, service, status, reserved_for AS reservedFor, created_at AS createdAt, updated_at AS updatedAt,
      services_json AS servicesJson, total_price_inr AS totalPriceInr
    FROM customer_booking WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(request.customerId!) as Array<{ servicesJson?: string } & Record<string, unknown>>).map(({ servicesJson, ...rest }) => ({
    ...rest,
    services: servicesJson ? JSON.parse(servicesJson) : [],
  }));
  response.set('Cache-Control', 'no-store');
  response.json({ bookings });
});

app.post('/api/me/logout', requireCustomer, (request, response) => {
  const token = String(request.headers.authorization || '').slice(7).trim();
  db.prepare('DELETE FROM customer_session WHERE token_hash = ?').run(hashCode(token));
  response.sendStatus(204);
});

app.use(express.static(path.join(projectRoot, 'dist')));
app.get('*', (_request, response) => response.sendFile(path.join(projectRoot, 'dist', 'index.html')));

// Arrival-window expiry is DERIVED from graceExpiresAt, never mutated here: the
// booking stays in the queue and simply presents as "call again available" so
// staff decide explicitly between Call Again, Start Service and No-show. This
// sweep only re-publishes so open dashboards cross the boundary promptly.
setInterval(() => {
  for (const salon of readOnboardedSalons()) {
    const state = readState(salon.id);
    const justExpired = state.queue.some(
      (item) =>
        item.status === 'Called' &&
        item.graceExpiresAt !== undefined &&
        Date.now() >= item.graceExpiresAt &&
        Date.now() - item.graceExpiresAt < 30_000,
    );
    if (justExpired) publish(state);
  }
}, 15_000).unref();

const port = Number(process.env.PORT || 8787);
const server = app.listen(port, '0.0.0.0', () => console.log(`No-Wait Salon server listening on http://0.0.0.0:${port}`));

function shutdown(signal: string) {
  console.log(`${signal} received; closing server.`);
  server.close(async () => {
    try{await postgresPersistence?.close()}catch(error){console.error('Final PostgreSQL flush failed',error)}
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
