import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let child: ChildProcess | null = null;
let base = '';
let dataDir = '';
let salonId = '';
let secondSalonId = '';
let thirdSalonId = '';
let customerToken = '';
let customerId = '';

const api = async (method: string, url: string, body?: unknown, token?: string) => {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${base}${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  const data = text && !text.startsWith('<') ? JSON.parse(text) : null;
  return { status: response.status, data };
};

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'no-wait-test-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  base = `http://127.0.0.1:${port}`;
  child = spawn('node', ['--import', 'tsx', 'server/index.ts'], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NO_WAIT_TEST_DEPLOYMENT: 'true', ADMIN_PASSWORD: 'test' },
  });
  await new Promise<void>((resolve, reject) => {
    let output = '';
    const onData = (b: Buffer) => { output += b.toString(); if (output.includes('server listening')) { child?.stdout?.off('data', onData); resolve(); } };
    child?.stdout?.on('data', onData);
    child?.on('exit', () => reject(new Error('server died')));
  });

  const loginRes = await api('POST', '/api/admin/login', { password: 'admin123' });
  const adminToken = loginRes.data.token;
  const created = await api('POST', '/api/admin/salons', { name: 'Sharpcut Reviews Test', main_category_id: 'salon', business_code: 'RVSALON01', status: 'active', latitude: 0, longitude: 0 }, adminToken);
  salonId = created.data.salon.id;
  const secondCreated = await api('POST', '/api/admin/salons', { name: 'Second Reviews Test', main_category_id: 'salon', business_code: 'RVSALON02', status: 'active', latitude: 0, longitude: 0 }, adminToken);
  secondSalonId = secondCreated.data.salon.id;
  const thirdCreated = await api('POST', '/api/admin/salons', { name: 'Deleted Reviews Test', main_category_id: 'salon', business_code: 'RVSALON03', status: 'active', latitude: 0, longitude: 0 }, adminToken);
  thirdSalonId = thirdCreated.data.salon.id;

  const otpReq = await api('POST', '/api/otp/request', { phone: '9199988877' });
  const otpVerify = await api('POST', '/api/otp/verify', { challengeId: otpReq.data.challengeId, code: otpReq.data.demoCode });
  customerToken = otpVerify.data.token;
  customerId = otpVerify.data.customerId;
});

after(() => {
  if (child) child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
});

test('Salon reviews — business-agnostic reviews endpoint', async (t) => {
  await t.test('a customer with no booking history can review, unverified', async () => {
    const res = await api('POST', `/api/business/${salonId}/reviews`, { rating: 4, reviewText: 'Nice haircut.' }, customerToken);
    assert.equal(res.status, 201);
    assert.equal(res.data.review.verifiedVisit, false);
  });

  await t.test('enforces uniqueness: a customer cannot submit a second review for the same business', async () => {
    const res = await api('POST', `/api/business/${salonId}/reviews`, { rating: 5, reviewText: 'Second attempt.' }, customerToken);
    assert.equal(res.status, 409);
    assert.match(res.data.error, /already reviewed/i);
  });

  await t.test('database constraint also enforces one customer review per business', () => {
    const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
    const now = Date.now();
    assert.throws(() => {
      db.prepare(`
        INSERT INTO business_review (id, business_id, customer_id, reviewer_name, rating, review_text, created_at, updated_at)
        VALUES (?, ?, ?, 'Ritik', 5, 'Race duplicate', ?, ?)
      `).run(`review_duplicate_${now}`, salonId, customerId, now, now);
    }, /UNIQUE constraint failed/);
    db.close();
  });

  await t.test('the same customer can review a different business', async () => {
    const res = await api('POST', `/api/business/${secondSalonId}/reviews`, { rating: 5, reviewText: 'Different business.' }, customerToken);
    assert.equal(res.status, 201);
    assert.equal(res.data.review.businessId, secondSalonId);
  });

  await t.test('a deleted-only historical review is not myReview and does not block a replacement', async () => {
    const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
    const now = Date.now();
    db.prepare(`
      INSERT INTO business_review
        (id, business_id, customer_id, reviewer_name, rating, review_text, status, created_at, updated_at)
      VALUES (?, ?, ?, 'Ritik', 2, 'Deleted historical review', 'deleted', ?, ?)
    `).run(`review_deleted_${now}`, thirdSalonId, customerId, now - 100, now - 100);
    db.close();

    const beforePost = await api('GET', `/api/business/${thirdSalonId}/reviews`, undefined, customerToken);
    assert.equal(beforePost.status, 200);
    assert.equal(beforePost.data.myReview, null);
    assert.equal(beforePost.data.reviews.length, 0);

    const posted = await api('POST', `/api/business/${thirdSalonId}/reviews`, { rating: 5, reviewText: 'Replacement review.' }, customerToken);
    assert.equal(posted.status, 201);

    const afterPost = await api('GET', `/api/business/${thirdSalonId}/reviews`, undefined, customerToken);
    assert.equal(afterPost.data.myReview.reviewText, 'Replacement review.');
    assert.equal(afterPost.data.reviews.length, 1);
  });

  await t.test('the authenticated response returns the persisted own review and owner reply', async () => {
    const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
    db.prepare('UPDATE business_review SET owner_reply_text = ?, owner_reply_at = ?, updated_at = ? WHERE business_id = ? AND customer_id = ?')
      .run('Thank you for visiting.', Date.now(), Date.now(), salonId, customerId);
    db.close();
    const list = await api('GET', `/api/business/${salonId}/reviews`, undefined, customerToken);
    assert.equal(list.status, 200);
    assert.equal(list.data.myReview.reviewText, 'Nice haircut.');
    assert.equal(list.data.myReview.ownerReplyText, 'Thank you for visiting.');
  });

  await t.test('a second customer with a real completed booking gets a genuinely provable verified badge', async () => {
    const otpReq2 = await api('POST', '/api/otp/request', { phone: '9199988866' });
    const otpVerify2 = await api('POST', '/api/otp/verify', { challengeId: otpReq2.data.challengeId, code: otpReq2.data.demoCode });
    const customerToken2 = otpVerify2.data.token;
    const customerId2 = otpVerify2.data.customerId;

    const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
    const now = Date.now();
    db.prepare(`
      INSERT INTO customer_booking (id, queue_entry_id, customer_id, salon_id, service, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'Haircut', 'Completed', ?, ?)
    `).run(`booking_${now}`, `queue_${now}`, customerId2, salonId, now, now);
    db.close();

    const res = await api('POST', `/api/business/${salonId}/reviews`, { rating: 5, reviewText: 'Actually got my haircut here.' }, customerToken2);
    assert.equal(res.status, 201);
    assert.equal(res.data.review.verifiedVisit, true);
  });

  await t.test('the public reviews list includes a real overall rating and count, never fabricated', async () => {
    const list = await api('GET', `/api/business/${salonId}/reviews`);
    assert.equal(list.data.totalReviews, 2);
    assert.equal(list.data.overallRating, 4.5);
    assert.equal(list.data.reviews.length, 2);
  });

  await t.test('rejects a review with no rating', async () => {
    const otpReq3 = await api('POST', '/api/otp/request', { phone: '9199988855' });
    const otpVerify3 = await api('POST', '/api/otp/verify', { challengeId: otpReq3.data.challengeId, code: otpReq3.data.demoCode });
    const customerToken3 = otpVerify3.data.token;
    const res = await api('POST', `/api/business/${salonId}/reviews`, { reviewText: 'No rating' }, customerToken3);
    assert.equal(res.status, 400);
  });
});
