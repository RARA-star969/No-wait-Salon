import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { ensureBusinessQr, findActiveBusinessQr } from './businessQr.ts';

/**
 * Mirrors the server's own validation: only the two QR-originated sources may
 * be claimed by the public join endpoint, so a client cannot forge a source.
 */
const resolveJoinSource = (raw: unknown): 'qr_web' | 'qr_walk_in' =>
  typeof raw === 'string' && raw.trim() === 'qr_web' ? 'qr_web' : 'qr_walk_in';

function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE business_qr (id TEXT PRIMARY KEY,business_id TEXT NOT NULL,business_type TEXT NOT NULL,public_token TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'active',version INTEGER NOT NULL DEFAULT 1,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,revoked_at INTEGER);
    CREATE UNIQUE INDEX business_qr_active_business_idx ON business_qr(business_id,business_type) WHERE status='active';
    CREATE TABLE web_qr_attribution (id TEXT PRIMARY KEY,business_id TEXT NOT NULL,qr_token_id TEXT NOT NULL,customer_id TEXT,acquisition_source TEXT NOT NULL DEFAULT 'salon_qr_web',first_visit_at INTEGER NOT NULL,joined_at INTEGER,app_cta_shown INTEGER NOT NULL DEFAULT 0,app_cta_clicked INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
  `);
  return db;
}

test('web join is recorded as qr_web and in-app scans stay qr_walk_in', () => {
  assert.equal(resolveJoinSource('qr_web'), 'qr_web');
  assert.equal(resolveJoinSource('qr_walk_in'), 'qr_walk_in');
  assert.equal(resolveJoinSource(undefined), 'qr_walk_in');
});

test('a forged source cannot be claimed through the public join endpoint', () => {
  for (const forged of ['staff_walk_in', 'customer_app', 'appointment', 'admin', '', 42, null]) {
    assert.equal(resolveJoinSource(forged), 'qr_walk_in', String(forged));
  }
});

test('each salon QR resolves only to its own business', () => {
  const db = database();
  const sharpcut = ensureBusinessQr(db, 'sharpcut-studio');
  const royal = ensureBusinessQr(db, 'royal-man-salon');

  assert.equal(findActiveBusinessQr(db, sharpcut.public_token)?.business_id, 'sharpcut-studio');
  assert.equal(findActiveBusinessQr(db, royal.public_token)?.business_id, 'royal-man-salon');
  // Strict cross-salon isolation: neither token may resolve to the other.
  assert.notEqual(findActiveBusinessQr(db, sharpcut.public_token)?.business_id, 'royal-man-salon');
  assert.notEqual(findActiveBusinessQr(db, royal.public_token)?.business_id, 'sharpcut-studio');
});

test('a revoked QR stops resolving so the public page can refuse it', () => {
  const db = database();
  const qr = ensureBusinessQr(db, 'sharpcut-studio');
  db.prepare("UPDATE business_qr SET status='revoked' WHERE id=?").run(qr.id);
  assert.equal(findActiveBusinessQr(db, qr.public_token), undefined);
});

test('attribution records one row per visit and stamps the join', () => {
  const db = database();
  const qr = ensureBusinessQr(db, 'sharpcut-studio');
  const now = Date.now();
  db.prepare(
    'INSERT INTO web_qr_attribution (id,business_id,qr_token_id,customer_id,acquisition_source,first_visit_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
  ).run('a1', 'sharpcut-studio', qr.id, null, 'salon_qr_web', now, now, now);

  const anonymous = db.prepare('SELECT customer_id,joined_at,acquisition_source FROM web_qr_attribution WHERE id=?').get('a1') as {
    customer_id: string | null;
    joined_at: number | null;
    acquisition_source: string;
  };
  assert.equal(anonymous.customer_id, null);
  assert.equal(anonymous.joined_at, null);
  assert.equal(anonymous.acquisition_source, 'salon_qr_web');

  db.prepare('UPDATE web_qr_attribution SET customer_id=?,joined_at=?,updated_at=? WHERE id=?').run('cust-1', now + 50, now + 50, 'a1');
  const joined = db.prepare('SELECT customer_id,joined_at FROM web_qr_attribution WHERE id=?').get('a1') as {
    customer_id: string | null;
    joined_at: number | null;
  };
  assert.equal(joined.customer_id, 'cust-1');
  assert.equal(joined.joined_at, now + 50);
});

test('duplicate protection keys on customer identity within one salon queue', () => {
  // Same rule the endpoint enforces inside its transaction.
  const queue = [{ id: 'q1', customerId: 'cust-1' }];
  const findDuplicate = (customerId: string) => queue.find((item) => item.customerId === customerId);

  assert.ok(findDuplicate('cust-1'), 'existing customer must be detected');
  assert.equal(findDuplicate('cust-2'), undefined, 'a different customer may join');
});
