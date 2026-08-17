import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { INITIAL_BARBERS, INITIAL_QUEUE, SALONS } from '../src/data/mockData.ts';
import type { Barber, QueueItem, Salon } from '../src/types.ts';

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

const insertSalon = db.prepare(`
  INSERT OR IGNORE INTO salon
  (id, name, address, latitude, longitude, rating, review_count, is_open, opening_hours, services_json, barbers_json, onboarded, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
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
    JSON.stringify(demoBarbers[salon.id] || []), Date.now(),
  );
}

type SalonRow = {
  id: string; name: string; address: string; latitude: number; longitude: number; rating: number;
  review_count: number; is_open: number; opening_hours: string; services_json: string; barbers_json: string;
};

function rowToSalon(row: SalonRow): Salon {
  const barbers = JSON.parse(row.barbers_json) as Barber[];
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
    services: JSON.parse(row.services_json),
    defaultBarberCount: barbers.length || 1,
    distanceKm: 0,
  };
}

function readOnboardedSalons(): Salon[] {
  const rows = db.prepare('SELECT * FROM salon WHERE onboarded = 1 ORDER BY created_at, id').all() as unknown as SalonRow[];
  return rows.map(rowToSalon);
}

function readSalonBarbers(salonId: string): Barber[] {
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
    response.set('Access-Control-Allow-Headers', 'Content-Type');
    response.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use((_request, response, next) => {
  response.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  next();
});
app.use(express.json({ limit: '64kb' }));

const subscribers = new Map<string, Set<express.Response>>();
const hashCode = (value: string) => Buffer.from(value).toString('base64url');

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
    state.queue.push({ ...command.item, id: randomUUID(), createdAt: Date.now() });
    return state;
  }

  if (command.type === 'add_walkin') {
    const item = { ...command.item, id: randomUUID(), createdAt: Date.now(), isUser: false };
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

app.get('/api/health', (_request, response) => {
  db.prepare('SELECT 1').get();
  response.set('Cache-Control', 'no-store');
  response.json({ ok: true, timestamp: Date.now() });
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

app.post('/api/salons/:salonId/commands', (request, response) => {
  try {
    db.exec('BEGIN IMMEDIATE');
    const current = readState(request.params.salonId);
    const next = applyCommand(structuredClone(current), request.body as QueueCommand);
    if (next.version !== current.version) next.version = current.version;
    writeState(next);
    db.exec('COMMIT');
    publish(next);
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

app.post('/api/otp/verify', (request, response) => {
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
  response.json({ verified: true, phone: challenge.phone });
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
  }
}, 15_000).unref();

const port = Number(process.env.PORT || 8787);
const server = app.listen(port, '0.0.0.0', () => console.log(`No-Wait Salon server listening on http://0.0.0.0:${port}`));

function shutdown(signal: string) {
  console.log(`${signal} received; closing server.`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
