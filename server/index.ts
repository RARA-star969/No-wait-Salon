import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { INITIAL_BARBERS, INITIAL_QUEUE, SALONS } from '../src/data/mockData.ts';
import type { Barber, QueueItem, Salon } from '../src/types.ts';
import {initPostgresPersistence} from './postgresPersistence.ts';
import {qrPngDataUrl,qrSvgDataUrl} from './qrRendering.ts';
import {ensureBusinessQr,findActiveBusinessQr,type BusinessQrRow} from './businessQr.ts';

type SalonState = {
  salonId: string;
  version: number;
  queue: QueueItem[];
  barbers: Barber[];
  completedList: QueueItem[];
  updatedAt: number;
};

type QueueCommand =
  | { type: 'reset' }
  | { type: 'toggle_barber'; barberId: string }
  | { type: 'join'; item: QueueItem }
  | { type: 'add_walkin'; item: QueueItem; startImmediately?: boolean; preferredBarberId?: string }
  | { type: 'queue_action'; itemId: string; action: 'Call' | 'Start' | 'Complete' | 'No-show' | 'Remove'; barberId?: string }
  | { type: 'cancel_customer'; sessionId: string };

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
  updated_at: "INTEGER NOT NULL DEFAULT 0",
};
for (const [column, definition] of Object.entries(additiveSalonColumns)) {
  if (!salonColumns.has(column)) db.exec(`ALTER TABLE salon ADD COLUMN ${column} ${definition}`);
}

const insertSalon = db.prepare(`
  INSERT INTO salon
  (id, name, address, latitude, longitude, rating, review_count, is_open, opening_hours, services_json, barbers_json,
   category, phone_number, description, cover_image_url, logo_image_url, amenities_json, offers_json, gallery_json, brand_key, onboarded, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  ON CONFLICT(id) DO NOTHING
`);
const demoBarbers: Record<string, Barber[]> = {
  'salon-1': [
    { id: 'b1', name: 'Arjun', status: 'available' },
    { id: 'b2', name: 'Sameer', status: 'available' },
  ],
  'salon-2': [
    { id: 'b1', name: 'Kabir', status: 'available' },
    { id: 'b2', name: 'Rohan', status: 'available' },
  ],
};
for (const salon of SALONS) {
  insertSalon.run(
    salon.id, salon.name, salon.address, salon.latitude, salon.longitude, salon.rating,
    salon.reviewCount, salon.isOpen ? 1 : 0, salon.openingHours, JSON.stringify(salon.services),
    JSON.stringify(demoBarbers[salon.id] || []), salon.category || '', salon.phoneNumber || '', salon.description || '',
    salon.coverImageUrl || '', salon.logoImageUrl || '', JSON.stringify(salon.amenities || []), JSON.stringify(salon.offers || []),
    JSON.stringify(salon.gallery || []), salon.brandKey || '', Date.now(),
  );
}

type SalonRow = {
  id: string; name: string; address: string; latitude: number; longitude: number; rating: number;
  review_count: number; is_open: number; opening_hours: string; services_json: string; barbers_json: string;
  category: string; phone_number: string; description: string; cover_image_url: string; logo_image_url: string;
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
`);

const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const nowForSeed = Date.now();
for (const salon of SALONS) {
  const serviceCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_service WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!serviceCount) salon.services.forEach((service, index) => db.prepare(`INSERT INTO salon_service
    (id, salon_id, name, category, price_inr, duration_min, description, image_url, active, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, ?)`)
    .run(`${salon.id}-${service.id}`, salon.id, service.name, service.name.includes('Beard') ? 'Beard' : service.name.includes('Spa') || service.name.includes('Massage') ? 'Massage & Spa' : 'Hair Care', service.priceInr, service.durationMin, service.description || '', index, nowForSeed, nowForSeed));
  const staffCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_staff WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!staffCount) (demoBarbers[salon.id] || []).forEach((barber, index) => db.prepare(`INSERT INTO salon_staff
    (id, salon_id, name, role, working_status, active, sort_order, created_at, updated_at) VALUES (?, ?, ?, 'Barber', ?, 1, ?, ?, ?)`)
    .run(`${salon.id}-${barber.id}`, salon.id, barber.name, barber.status, index, nowForSeed, nowForSeed));
  const hoursCount = (db.prepare('SELECT COUNT(*) AS count FROM salon_hours WHERE salon_id = ?').get(salon.id) as { count: number }).count;
  if (!hoursCount) dayNames.forEach((_, index) => db.prepare('INSERT INTO salon_hours (salon_id, day_of_week, open_time, close_time, closed) VALUES (?, ?, ?, ?, 0)')
    .run(salon.id, index, '09:00', '21:00'));
}

function rowToSalon(row: SalonRow): Salon {
  const serviceRows = db.prepare('SELECT * FROM salon_service WHERE salon_id = ? AND active = 1 ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const staffRows = db.prepare('SELECT * FROM salon_staff WHERE salon_id = ? AND active = 1 ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const offerRows = db.prepare('SELECT * FROM salon_offer WHERE salon_id = ? AND active = 1 ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const mediaRows = db.prepare('SELECT * FROM salon_media WHERE salon_id = ? ORDER BY sort_order, created_at').all(row.id) as Array<Record<string, string | number>>;
  const hoursRows = db.prepare('SELECT * FROM salon_hours WHERE salon_id = ? ORDER BY day_of_week').all(row.id) as Array<Record<string, string | number>>;
  const services = serviceRows.map((service) => ({ id: String(service.id), name: String(service.name), durationMin: Number(service.duration_min), priceInr: Number(service.price_inr), description: String(service.description || ''), icon: String(service.image_url || '') }));
  const barbers = staffRows.map((staff) => ({ id: String(staff.id), name: String(staff.name), status: String(staff.working_status) as Barber['status'] }));
  const offers = offerRows.map((offer) => ({ id: String(offer.id), title: String(offer.title), discount: String(offer.discount_text), minimumBill: Number(offer.minimum_bill) ? `₹${offer.minimum_bill}` : '', validity: [offer.start_date, offer.end_date].filter(Boolean).join(' – '), terms: String(offer.terms) }));
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
  const rows = db.prepare("SELECT id, name, working_status FROM salon_staff WHERE salon_id = ? AND active = 1 ORDER BY sort_order").all(salonId) as Array<{ id: string; name: string; working_status: Barber['status'] }>;
  if (rows.length) return rows.map((row) => ({ id: row.id, name: row.name, status: row.working_status }));
  const row = db.prepare('SELECT barbers_json FROM salon WHERE id = ? AND onboarded = 1').get(salonId) as { barbers_json: string } | undefined;
  return row ? JSON.parse(row.barbers_json) as Barber[] : [];
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
if (configuredAdminEmail && (configuredAdminPassword || configuredAdminPasswordHash)) {
  const existingAdmin = db.prepare('SELECT id FROM admin_user WHERE email = ?').get(configuredAdminEmail) as { id: string } | undefined;
  if (!existingAdmin) {
    const now = Date.now();
    db.prepare('INSERT INTO admin_user (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), configuredAdminEmail, configuredAdminPasswordHash || passwordHash(configuredAdminPassword), now, now);
  }
}

type AuthenticatedRequest = express.Request & { customerId?: string };
type AdminRequest = express.Request & { adminId?: string };

function requireAdmin(request: AdminRequest, response: express.Response, next: express.NextFunction) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
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
    INSERT INTO customer_booking (id, queue_entry_id, customer_id, salon_id, service, status, reserved_for, source, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(queue_entry_id) DO UPDATE SET status = excluded.status, source = excluded.source, updated_at = excluded.updated_at
  `).run(randomUUID(), item.id, item.customerId, salonId, item.service, item.status, item.reservedFor || null, item.source || 'customer_app', item.createdAt, now);
}

function seedState(salonId: string): SalonState {
  const now = Date.now();
  const isPrimaryDemoSalon = salonId === 'salon-1';
  const configuredBarbers = readSalonBarbers(salonId);
  const baseBarbers = configuredBarbers.length ? configuredBarbers : INITIAL_BARBERS;
  const seededBarbers = baseBarbers.map((configured, index) => {
    const existing = isPrimaryDemoSalon ? INITIAL_BARBERS[index] : configured;
    if (existing) {
      return isPrimaryDemoSalon ? structuredClone(existing) : { ...structuredClone(existing), status: 'available' as const, currentCustomerName: undefined };
    }
    return { id: `b${index + 1}`, name: `Stylist ${index + 1}`, status: 'available' as const };
  });
  return {
    salonId,
    version: 1,
    queue: isPrimaryDemoSalon ? structuredClone(INITIAL_QUEUE) : [],
    barbers: seededBarbers,
    completedList: [],
    updatedAt: now,
  };
}

function readState(salonId: string): SalonState {
  const row = db.prepare('SELECT state_json FROM salon_state WHERE salon_id = ?').get(salonId) as { state_json: string } | undefined;
  if (row) return JSON.parse(row.state_json) as SalonState;
  const state = seedState(salonId);
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

function publish(state: SalonState) {
  const payload = `event: state\ndata: ${JSON.stringify(state)}\n\n`;
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

  if (command.type === 'join') {
    if (!command.item.sessionId) throw new Error('Customer session is required.');
    if (state.queue.some((item) => item.sessionId === command.item.sessionId)) throw new Error('You already have an active booking at this salon.');
    state.queue.push({ ...command.item, source: command.item.source || 'customer_app', id: randomUUID(), createdAt: Date.now() });
    return state;
  }

  if (command.type === 'add_walkin') {
    const item = { ...command.item, source: command.item.source || 'staff_walk_in' as const, id: randomUUID(), createdAt: Date.now(), isUser: false };
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
    if (!item) return state;
    releaseBarber(state, item);
    state.queue = state.queue.filter((entry) => entry.id !== item.id);
    return state;
  }

  const itemIndex = state.queue.findIndex((item) => item.id === command.itemId);
  if (itemIndex < 0) throw new Error('Queue entry no longer exists. Refreshing the latest queue.');
  const item = state.queue[itemIndex];

  if (command.action === 'Call') {
    if (!['Waiting', 'Reserved'].includes(item.status)) throw new Error(`Cannot call a customer with status ${item.status}.`);
    const barberIndex = findAvailableBarber(state, command.barberId);
    if (barberIndex < 0) throw new Error('No barber is currently available.');
    const barber = state.barbers[barberIndex];
    state.barbers[barberIndex] = { ...barber, status: 'busy', currentCustomerName: item.name };
    state.queue[itemIndex] = { ...item, status: 'Called', barberIndex, barberName: barber.name, calledAt: Date.now() };
  } else if (command.action === 'Start') {
    if (!['Waiting', 'Called', 'Reserved'].includes(item.status)) throw new Error(`Cannot start a customer with status ${item.status}.`);
    let barberIndex = item.barberIndex;
    if (barberIndex === undefined || !state.barbers[barberIndex] || state.barbers[barberIndex].status === 'unavailable') {
      barberIndex = findAvailableBarber(state, command.barberId);
    }
    if (barberIndex === undefined || barberIndex < 0) throw new Error('No barber is currently available.');
    const barber = state.barbers[barberIndex];
    state.barbers[barberIndex] = { ...barber, status: 'busy', currentCustomerName: item.name };
    state.queue[itemIndex] = { ...item, status: 'Serving', barberIndex, barberName: barber.name };
  } else if (command.action === 'Complete') {
    if (item.status !== 'Serving') throw new Error('Only an in-service customer can be completed.');
    releaseBarber(state, item);
    state.queue.splice(itemIndex, 1);
    state.completedList = [{ ...item, status: 'Completed' as const }, ...state.completedList].slice(0, 100);
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
  replace('salon_staff', Array.isArray(body.staff) ? body.staff : [], (row, index) => {
    const name = cleanText(row.name, 100); if (!name) throw new Error('Every staff member needs a name.');
    const status = ['available', 'busy', 'unavailable'].includes(String(row.working_status)) ? String(row.working_status) : 'available';
    db.prepare(`INSERT INTO salon_staff (id, salon_id, name, photo_url, role, service_ids_json, working_status, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(cleanText(row.id, 100) || randomUUID(), salonId, name, cleanText(row.photo_url, 1000), cleanText(row.role, 80) || 'Barber', JSON.stringify(Array.isArray(row.service_ids) ? row.service_ids : []), status, asBoolean(row.active) ? 1 : 0, index, now, now);
  });
  replace('salon_offer', Array.isArray(body.offers) ? body.offers : [], (row, index) => {
    const title = cleanText(row.title, 120); if (!title) throw new Error('Every offer needs a title.');
    const minimum = Number(row.minimum_bill ?? 0); if (!Number.isFinite(minimum) || minimum < 0) throw new Error('Minimum bill cannot be negative.');
    db.prepare(`INSERT INTO salon_offer (id, salon_id, title, discount_text, description, minimum_bill, start_date, end_date, terms, image_url, active, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(cleanText(row.id, 100) || randomUUID(), salonId, title, cleanText(row.discount_text, 120), cleanText(row.description, 1000), minimum, cleanText(row.start_date, 10), cleanText(row.end_date, 10), cleanText(row.terms, 2000), cleanText(row.image_url, 1000), asBoolean(row.active) ? 1 : 0, index, now, now);
  });
  replace('salon_media', Array.isArray(body.media) ? body.media : [], (row, index) => {
    const url = cleanText(row.url, 2000); if (!url) throw new Error('Every gallery item needs an image URL.');
    db.prepare(`INSERT INTO salon_media (id, salon_id, media_type, url, caption, featured, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(cleanText(row.id, 100) || randomUUID(), salonId, cleanText(row.media_type, 30) || 'gallery', url, cleanText(row.caption, 200), asBoolean(row.featured) ? 1 : 0, index, now, now);
  });
}

app.post('/api/admin/login', (request, response) => {
  const email = cleanText(request.body?.email, 200).toLowerCase();
  const password = String(request.body?.password || '');
  const admin = db.prepare('SELECT id, email, password_hash FROM admin_user WHERE email = ?').get(email) as { id: string; email: string; password_hash: string } | undefined;
  if (!admin || !verifyPassword(password, admin.password_hash)) return response.status(401).json({ error: 'Invalid admin email or password.' });
  const token = `${randomUUID()}${randomUUID().replaceAll('-', '')}`;
  const now = Date.now();
  db.prepare('DELETE FROM admin_session WHERE expires_at <= ?').run(now);
  db.prepare('INSERT INTO admin_session (token_hash, admin_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
    .run(hashCode(token), admin.id, now + 12 * 60 * 60_000, now);
  response.json({ token, admin: { id: admin.id, email: admin.email }, expiresInSeconds: 43_200 });
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

app.post('/api/admin/salons', requireAdmin, async (request, response) => {
  try {
    const body = request.body as Record<string, unknown>; const name = cleanText(body.name, 150); if (!name) throw new Error('Salon name is required.');
    const id = cleanText(body.id, 100) || randomUUID(); const now = Date.now();
    const latitude = parseCoordinate(body.latitude, -90, 90, 'Latitude'); const longitude = parseCoordinate(body.longitude, -180, 180, 'Longitude');
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`INSERT INTO salon (id,name,address,latitude,longitude,rating,review_count,is_open,opening_hours,services_json,barbers_json,onboarded,created_at,
      category,phone_number,description,cover_image_url,logo_image_url,amenities_json,offers_json,gallery_json,brand_key,short_description,email,website_url,area,city,state,pin_code,promotional_banner_url,platform_status,updated_at)
      VALUES (?,?,?,?,?,0,0,?,?, '[]','[]',1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(id,name,cleanText(body.address,500),latitude,longitude,asBoolean(body.isOpen)?1:0,cleanText(body.opening_hours,100)||'9:00 AM–9:00 PM',now,
        cleanText(body.category,100),cleanText(body.phone_number,30),cleanText(body.description,3000),cleanText(body.cover_image_url,1000),cleanText(body.logo_image_url,1000),JSON.stringify(Array.isArray(body.amenities)?body.amenities:[]),'[]','[]',cleanText(body.brand_key,100),cleanText(body.short_description,300),cleanText(body.email,200),cleanText(body.website_url,1000),cleanText(body.area,100),cleanText(body.city,100),cleanText(body.state,100),cleanText(body.pin_code,10),cleanText(body.promotional_banner_url,1000),cleanText(body.status,20)||'draft',now);
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
    db.exec('BEGIN IMMEDIATE');
    db.prepare(`UPDATE salon SET name=?,short_description=?,description=?,category=?,phone_number=?,email=?,website_url=?,address=?,area=?,city=?,state=?,pin_code=?,latitude=?,longitude=?,
      is_open=?,opening_hours=?,logo_image_url=?,cover_image_url=?,promotional_banner_url=?,amenities_json=?,platform_status=?,updated_at=? WHERE id=?`)
      .run(name,cleanText(body.short_description,300),cleanText(body.description,3000),cleanText(body.category,100),cleanText(body.phone_number,30),cleanText(body.email,200),cleanText(body.website_url,1000),cleanText(body.address,500),cleanText(body.area,100),cleanText(body.city,100),cleanText(body.state,100),cleanText(body.pin_code,10),latitude,longitude,asBoolean(body.isOpen)?1:0,cleanText(body.opening_hours,100)||'9:00 AM–9:00 PM',cleanText(body.logo_image_url,1000),cleanText(body.cover_image_url,1000),cleanText(body.promotional_banner_url,1000),JSON.stringify(Array.isArray(body.amenities)?body.amenities:[]),cleanText(body.status,20)||'draft',now,request.params.id);
    saveSalonRelations(request.params.id,body,now); db.exec('COMMIT'); publish(readState(request.params.id));
    await postgresPersistence?.flushNow(['salon','salon_hours','salon_service','salon_staff','salon_offer','salon_media']);
    response.json({ salon: adminSalonDetail(request.params.id) });
  } catch(error){ try{db.exec('ROLLBACK');}catch{} response.status(400).json({error:error instanceof Error?error.message:'Unable to save salon.'}); }
});

app.patch('/api/admin/salons/:id/status', requireAdmin, async (request,response) => {
  const status=cleanText(request.body?.status,20); if(!['draft','active','inactive','suspended'].includes(status)) return response.status(400).json({error:'Invalid salon status.'});
  const result=db.prepare('UPDATE salon SET platform_status=?, updated_at=? WHERE id=?').run(status,Date.now(),request.params.id);
  if(!result.changes) return response.status(404).json({error:'Salon not found.'}); if(status==='active')ensureBusinessQr(db,request.params.id,'salon'); await postgresPersistence?.flushNow(['salon','business_qr']); response.json({ok:true,status});
});

app.post('/api/admin/media/upload', requireAdmin, (request,response) => {
  const match=String(request.body?.dataUrl||'').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/); if(!match) return response.status(400).json({error:'Upload a PNG, JPEG, or WebP image.'});
  const bytes=Buffer.from(match[2],'base64'); if(bytes.length>2*1024*1024) return response.status(413).json({error:'Image must be 2 MB or smaller.'});
  const extension=match[1].split('/')[1].replace('jpeg','jpg'); const filename=`${randomUUID()}.${extension}`; writeFileSync(path.join(salonMediaDir,filename),bytes);
  response.status(201).json({url:`/salon-media/${filename}`});
});

app.get('/api/admin/customers', requireAdmin, (_request,response) => response.json({customers:db.prepare(`SELECT a.id,a.phone_number,p.name,p.email,a.created_at,
  (SELECT COUNT(*) FROM customer_booking b WHERE b.customer_id=a.id) booking_count FROM customer_account a JOIN customer_profile p ON p.customer_id=a.id ORDER BY a.created_at DESC`).all()}));

app.get('/api/health', (_request, response) => {
  db.prepare('SELECT 1').get();
  response.set('Cache-Control', 'no-store');
  response.json({ ok: true, timestamp: Date.now() });
});

const qrJoinAttempts=new Map<string,{count:number;resetAt:number}>();
function resolvedBusinessQr(token:string){
  const qr=findActiveBusinessQr(db,token);
  if(!qr||qr.business_type!=='salon')return undefined;
  const salonRow=db.prepare("SELECT * FROM salon WHERE id=? AND onboarded=1 AND platform_status='active'").get(qr.business_id) as SalonRow|undefined;
  if(!salonRow)return undefined;
  return{qr,salonRow,salon:rowToSalon(salonRow)};
}

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

app.post('/api/business-qr/:token/join',requireCustomer,async(request:AuthenticatedRequest,response)=>{
  const resolved=resolvedBusinessQr(cleanText(request.params.token,200));
  if(!resolved)return response.status(404).json({error:"This QR isn't linked to a business on our platform.",code:'INVALID_BUSINESS_QR'});
  if(!resolved.salon.isOpen)return response.status(409).json({error:'This business is not accepting queue entries right now.',code:'QUEUE_CLOSED'});
  const serviceId=cleanText(request.body?.serviceId,120);
  const service=db.prepare('SELECT id,name,duration_min FROM salon_service WHERE id=? AND salon_id=? AND active=1').get(serviceId,resolved.salon.id) as {id:string;name:string;duration_min:number}|undefined;
  if(!service)return response.status(400).json({error:'Please choose an available service.',code:'SERVICE_UNAVAILABLE'});
  const sessionId=cleanText(request.body?.sessionId,160);
  if(!sessionId)return response.status(400).json({error:'Unable to continue this scan. Please scan again.',code:'INVALID_SCAN_SESSION'});
  const current=readState(resolved.salon.id);
  const existing=current.queue.find(item=>item.customerId===request.customerId);
  if(existing)return response.json({joined:false,reason:'already_in_queue',entry:existing,state:current});
  const rateKey=`${request.customerId}:${resolved.qr.id}`;const now=Date.now();const attempt=qrJoinAttempts.get(rateKey);
  if(attempt&&attempt.resetAt>now&&attempt.count>=6)return response.status(429).json({error:'Too many attempts. Please wait a moment and try again.',code:'RATE_LIMITED'});
  qrJoinAttempts.set(rateKey,{count:attempt&&attempt.resetAt>now?attempt.count+1:1,resetAt:attempt&&attempt.resetAt>now?attempt.resetAt:now+60_000});
  const profile=readCustomerProfile(request.customerId!);
  const item:QueueItem={id:randomUUID(),name:String(profile.name||`Customer •${String(profile.phone_number).slice(-4)}`),phone:String(profile.phone_number),service:service.name,status:'Waiting',isUser:true,sessionId,customerId:request.customerId,createdAt:now,estimatedDurationMin:Number(service.duration_min)||30,source:'qr_walk_in'};
  try{
    db.exec('BEGIN IMMEDIATE');
    const latest=readState(resolved.salon.id);
    const duplicate=latest.queue.find(entry=>entry.customerId===request.customerId);
    if(duplicate){db.exec('ROLLBACK');return response.json({joined:false,reason:'already_in_queue',entry:duplicate,state:latest})}
    latest.queue.push(item);writeState(latest);upsertBooking(resolved.salon.id,item);db.exec('COMMIT');publish(latest);
    await postgresPersistence?.flushNow(['customer_booking','salon_state']);
    response.status(201).json({joined:true,entry:item,state:latest});
  }catch(error){try{db.exec('ROLLBACK')}catch{}response.status(409).json({error:'Unable to join this queue right now. Please try again.',code:'QUEUE_JOIN_FAILED'})}
});

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const distanceBetweenKm = (latitude: number, longitude: number, salonLatitude: number, salonLongitude: number) => {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(salonLatitude - latitude);
  const longitudeDelta = toRadians(salonLongitude - longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(latitude)) * Math.cos(toRadians(salonLatitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

app.get('/api/salons/nearby', (request, response) => {
  const latitude = Number(request.query.lat);
  const longitude = Number(request.query.lng);
  const area = String(request.query.area || '').trim().toLocaleLowerCase();
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  if (!hasCoordinates && area.length < 2) {
    return response.status(400).json({ error: 'Share your location or enter a city or area.' });
  }

  const matches = readOnboardedSalons()
    .filter((salon) => !area || `${salon.name} ${salon.address}`.toLocaleLowerCase().includes(area))
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

app.get('/api/salons/:salonId/state', (request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json(readState(request.params.salonId));
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
  response.write(`retry: 1500\nevent: state\ndata: ${JSON.stringify(readState(salonId))}\n\n`);
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
        db.prepare('UPDATE customer_booking SET status = ?, updated_at = ? WHERE queue_entry_id = ?').run('Cancelled', Date.now(), cancelled.id);
      }
    } else if (command.type === 'queue_action' && ['No-show', 'Remove'].includes(command.action)) {
      const removed = previousItems.get(command.itemId);
      if (removed?.customerId) db.prepare('UPDATE customer_booking SET status = ?, updated_at = ? WHERE queue_entry_id = ?')
        .run(command.action, Date.now(), removed.id);
    }
    db.exec('COMMIT');
    publish(next);
    await postgresPersistence?.flushNow(['customer_booking','salon_state']);
    response.json(next);
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
  const bookings = db.prepare(`
    SELECT id, salon_id AS salonId, service, status, reserved_for AS reservedFor, created_at AS createdAt, updated_at AS updatedAt
    FROM customer_booking WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100
  `).all(request.customerId!);
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

setInterval(() => {
  for (const salon of readOnboardedSalons()) {
    const state = readState(salon.id);
    const expired = state.queue.filter((item) => item.status === 'Called' && item.calledAt && Date.now() - item.calledAt > 10 * 60_000);
    if (expired.length === 0) continue;
    expired.forEach((item) => releaseBarber(state, item));
    const expiredIds = new Set(expired.map((item) => item.id));
    state.queue = state.queue.filter((item) => !expiredIds.has(item.id));
    writeState(state);
    publish(state);
    postgresPersistence?.scheduleFlush();
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
