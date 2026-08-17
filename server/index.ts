import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { INITIAL_BARBERS, INITIAL_QUEUE, SALONS } from '../src/data/mockData.ts';
import type { Barber, QueueItem } from '../src/types.ts';

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
app.use(express.json({ limit: '64kb' }));

const subscribers = new Map<string, Set<express.Response>>();
const hashCode = (value: string) => Buffer.from(value).toString('base64url');

function seedState(salonId: string): SalonState {
  const now = Date.now();
  const isPrimaryDemoSalon = salonId === SALONS[0].id;
  const barberCount = SALONS.find((salon) => salon.id === salonId)?.defaultBarberCount || 2;
  const seededBarbers = Array.from({ length: barberCount }, (_, index) => {
    const existing = INITIAL_BARBERS[index];
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

app.get('/api/health', (_request, response) => response.json({ ok: true, timestamp: Date.now() }));

app.get('/api/salons/:salonId/state', (request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json(readState(request.params.salonId));
});

app.get('/api/salons/:salonId/events', (request, response) => {
  const salonId = request.params.salonId;
  response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
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
  for (const salon of SALONS) {
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
app.listen(port, () => console.log(`No-Wait Salon server listening on http://localhost:${port}`));
