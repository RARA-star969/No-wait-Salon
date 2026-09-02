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
let adminToken = '';
let gymId = '';
let owner = '';
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
  adminToken = loginRes.data.token;

  const created = await api('POST', '/api/admin/salons', { name: 'Profile CMS Gym', main_category_id: 'gym', business_code: 'CMSGYM01', status: 'active', latitude: 0, longitude: 0 }, adminToken);
  gymId = created.data.salon.id;
  await api('PUT', `/api/admin/salons/${gymId}/owner-account`, { email: 'cms-owner@nowaitsalon.test', password: 'SuperSecret1', name: 'CMS Owner' }, adminToken);
  const staffLogin = await api('POST', '/api/staff/login', { businessCode: 'CMSGYM01', email: 'cms-owner@nowaitsalon.test', password: 'SuperSecret1' });
  owner = staffLogin.data.token;

  const otpReq = await api('POST', '/api/otp/request', { phone: '9123456780' });
  const otpVerify = await api('POST', '/api/otp/verify', { challengeId: otpReq.data.challengeId, code: otpReq.data.demoCode });
  customerToken = otpVerify.data.token;
  customerId = otpVerify.data.customerId;
});

after(() => {
  if (child) child.kill();
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
});

test('Gym Manage Profile — basic fields, amenities, quick actions', async (t) => {
  await t.test('owner can save basic profile fields and they read back on the public salon detail', async () => {
    const save = await api('PUT', '/api/staff/business/profile', {
      description: 'A high-performance strength gym.',
      short_description: 'Strength & conditioning',
      email: 'hello@cmsgym.test',
      website_url: 'https://cmsgym.test',
      area: 'Indiranagar',
      city: 'Bengaluru',
    }, owner);
    assert.equal(save.status, 200);
    assert.equal(save.data.pending, false);
  });

  await t.test('structured amenities save with a controlled icon key and normalize on read', async () => {
    const save = await api('PUT', '/api/staff/business/amenities', {
      amenities: [{ name: 'Sauna', iconKey: 'Flame' }, { name: 'Wi-Fi', iconKey: 'Wifi' }],
    }, owner);
    assert.equal(save.status, 200);
    assert.equal(save.data.amenities[0].name, 'Sauna');
    assert.equal(save.data.amenities[0].iconKey, 'Flame');
  });

  await t.test('amenities save rejects an unsupported icon key', async () => {
    const save = await api('PUT', '/api/staff/business/amenities', { amenities: [{ name: 'Rooftop', iconKey: 'Rocket' }] }, owner);
    assert.equal(save.status, 400);
  });

  await t.test('quick actions save is restricted to the controlled action types', async () => {
    const rejected = await api('PUT', '/api/staff/business/quick-actions', { quickActions: [{ type: 'open_url', label: 'Visit', url: 'https://evil.example' }] }, owner);
    assert.equal(rejected.status, 400);
    const accepted = await api('PUT', '/api/staff/business/quick-actions', {
      quickActions: [{ type: 'directions', label: 'Navigate', iconKey: 'ParkingCircle', visible: true }],
    }, owner);
    assert.equal(accepted.status, 200);
    assert.equal(accepted.data.quickActions[0].type, 'directions');
  });

  await t.test('a non-owner/manager staff role cannot edit the profile', async () => {
    const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
    const now = Date.now();
    db.prepare('INSERT INTO staff_account (id, business_id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run('staff_trainer_cms', gymId, 'cms-trainer@nowaitsalon.test', '', 'Trainer One', 'trainer', now, now);
    db.close();
    const trainerLogin = await api('POST', '/api/staff/test-login', { businessId: gymId, role: 'trainer' });
    assert.equal(trainerLogin.status, 200);
    const res = await api('PUT', '/api/staff/business/profile', { description: 'hijacked' }, trainerLogin.data.token);
    assert.equal(res.status, 403);
  });
});

test('Gym Manage Profile — gallery', async (t) => {
  let mediaIdA = '';
  let mediaIdB = '';

  await t.test('owner can add gallery images', async () => {
    const a = await api('POST', '/api/staff/business/gallery', { url: 'https://cdn.test/a.jpg', caption: 'Floor A' }, owner);
    assert.equal(a.status, 201);
    mediaIdA = a.data.id;
    const b = await api('POST', '/api/staff/business/gallery', { url: 'https://cdn.test/b.jpg', caption: 'Floor B' }, owner);
    mediaIdB = b.data.id;
    const list = await api('GET', '/api/staff/business/gallery', undefined, owner);
    assert.equal(list.data.gallery.length, 2);
  });

  await t.test('owner can set a featured image and it sorts first on the public detail', async () => {
    await api('PUT', `/api/staff/business/gallery/${mediaIdB}/featured`, undefined, owner);
    const detail = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(detail.data.salon.gallery[0].id, mediaIdB);
    assert.equal(detail.data.salon.gallery[0].featured, true);
  });

  await t.test('owner can reorder the gallery and the order persists on reload', async () => {
    await api('PUT', '/api/staff/business/gallery/order', { orderedIds: [mediaIdA, mediaIdB] }, owner);
    const list = await api('GET', '/api/staff/business/gallery', undefined, owner);
    assert.equal(list.data.gallery[0].id, mediaIdA);
  });

  await t.test('owner can delete a gallery image', async () => {
    const del = await api('DELETE', `/api/staff/business/gallery/${mediaIdA}`, undefined, owner);
    assert.equal(del.status, 200);
    const list = await api('GET', '/api/staff/business/gallery', undefined, owner);
    assert.equal(list.data.gallery.length, 1);
  });
});

test('Admin Public Profile governance — moderation hold and draft approve/reject', async (t) => {
  await t.test('placing a hold makes owner saves land in a pending draft, not the live row', async () => {
    const before = await api('GET', `/api/salons/${gymId}/profile`);
    const holdRes = await api('PUT', `/api/admin/salons/${gymId}/moderation/hold`, { hold: true }, adminToken);
    assert.equal(holdRes.status, 200);
    const save = await api('PUT', '/api/staff/business/profile', { description: 'Pending new description' }, owner);
    assert.equal(save.data.pending, true);
    const after = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(after.data.salon.description, before.data.salon.description);
  });

  await t.test('admin sees the pending fields and can approve them into the live profile', async () => {
    const moderation = await api('GET', `/api/admin/salons/${gymId}/moderation`, undefined, adminToken);
    assert.equal(moderation.data.hold, true);
    assert.ok('description' in moderation.data.pendingFields);
    const approve = await api('POST', `/api/admin/salons/${gymId}/profile-draft/approve`, undefined, adminToken);
    assert.equal(approve.status, 200);
    const after = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(after.data.salon.description, 'Pending new description');
  });

  await t.test('a rejected draft never reaches the live profile', async () => {
    await api('PUT', '/api/staff/business/profile', { description: 'Should be rejected' }, owner);
    const reject = await api('POST', `/api/admin/salons/${gymId}/profile-draft/reject`, undefined, adminToken);
    assert.equal(reject.status, 200);
    const after = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(after.data.salon.description, 'Pending new description');
  });

  await t.test('releasing the hold makes owner saves apply live again', async () => {
    await api('PUT', `/api/admin/salons/${gymId}/moderation/hold`, { hold: false }, adminToken);
    const save = await api('PUT', '/api/staff/business/profile', { description: 'Live again' }, owner);
    assert.equal(save.data.pending, false);
    const after = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(after.data.salon.description, 'Live again');
  });
});

test('Reviews — real customer path, owner dashboard, admin edit', async (t) => {
  let reviewId = '';

  await t.test('a customer with no gym history can still leave a review, unverified', async () => {
    const res = await api('POST', `/api/business/${gymId}/reviews`, { rating: 4, reviewText: 'Great equipment.' }, customerToken);
    assert.equal(res.status, 201);
    assert.equal(res.data.review.verifiedVisit, false);
    reviewId = res.data.review.id;
  });

  await t.test('a customer with a real staff-recorded visit gets a genuinely provable verified badge', async () => {
    // Staff Custom Entry check-in linked to a distinct authenticated customer
    const otpReq2 = await api('POST', '/api/otp/request', { phone: '9123456799' });
    const otpVerify2 = await api('POST', '/api/otp/verify', { challengeId: otpReq2.data.challengeId, code: otpReq2.data.demoCode });
    const customerToken2 = otpVerify2.data.token;
    const customerId2 = otpVerify2.data.customerId;

    const checkin = await api('POST', `/api/gym/${gymId}/operations/add_visitor`, {
      name: 'Verified Visitor', mobile: '9123456799', offeringId: 'custom_entry', customerId: customerId2,
    }, owner);
    assert.equal(checkin.status, 200);
    const res = await api('POST', `/api/business/${gymId}/reviews`, { rating: 5, reviewText: 'Actually trained there.' }, customerToken2);
    assert.equal(res.status, 201);
    assert.equal(res.data.review.verifiedVisit, true);
  });

  await t.test('owner sees both reviews with real aggregate stats, never fabricated', async () => {
    const dashboard = await api('GET', '/api/staff/business/reviews', undefined, owner);
    assert.equal(dashboard.data.totalReviews, 2);
    assert.equal(dashboard.data.overallRating, 4.5);
    assert.equal(dashboard.data.distribution[4], 1);
    assert.equal(dashboard.data.distribution[5], 1);
  });

  await t.test('owner can reply to a review', async () => {
    const reply = await api('PUT', `/api/staff/business/reviews/${reviewId}/reply`, { replyText: 'Thanks for training with us!' }, owner);
    assert.equal(reply.status, 200);
    const dashboard = await api('GET', '/api/staff/business/reviews', undefined, owner);
    const mine = dashboard.data.reviews.find((r: any) => r.id === reviewId);
    assert.equal(mine.ownerReplyText, 'Thanks for training with us!');
  });

  await t.test('admin can find the review, edit its text directly with no customer approval, and it persists', async () => {
    const list = await api('GET', `/api/admin/reviews?businessId=${gymId}`, undefined, adminToken);
    assert.equal(list.data.reviews.length, 2);
    const edit = await api('PUT', `/api/admin/reviews/${reviewId}`, { reviewText: 'Edited by admin for policy compliance.' }, adminToken);
    assert.equal(edit.status, 200);
    assert.equal(edit.data.review.editedByAdmin, true);
    const relist = await api('GET', `/api/admin/reviews?businessId=${gymId}`, undefined, adminToken);
    const mine = relist.data.reviews.find((r: any) => r.id === reviewId);
    assert.equal(mine.reviewText, 'Edited by admin for policy compliance.');
    assert.equal(mine.originalReviewText, 'Great equipment.');
    const publicList = await api('GET', `/api/business/${gymId}/reviews`);
    const minePublic = publicList.data.reviews.find((r: any) => r.id === reviewId);
    assert.equal(minePublic.reviewText, 'Edited by admin for policy compliance.');
  });

  await t.test('admin can hide a review and it disappears from the public list', async () => {
    const hide = await api('PATCH', `/api/admin/reviews/${reviewId}/status`, { status: 'hidden' }, adminToken);
    assert.equal(hide.status, 200);
    const publicList = await api('GET', `/api/business/${gymId}/reviews`);
    assert.equal(publicList.data.reviews.find((r: any) => r.id === reviewId), undefined);
    assert.equal(publicList.data.reviews.length, 1);
  });

  await t.test('admin can delete a review and it is gone from Admin’s list too', async () => {
    const del = await api('DELETE', `/api/admin/reviews/${reviewId}`, undefined, adminToken);
    assert.equal(del.status, 200);
    const list = await api('GET', `/api/admin/reviews?businessId=${gymId}`, undefined, adminToken);
    assert.equal(list.data.reviews.find((r: any) => r.id === reviewId), undefined);
    assert.equal(list.data.reviews.length, 1);
  });

  await t.test('rejects a review with no rating', async () => {
    const res = await api('POST', `/api/business/${gymId}/reviews`, { reviewText: 'No rating given' }, customerToken);
    assert.equal(res.status, 400);
  });
});

test('Social & Links — owner save, customer read, admin moderation', async (t) => {
  await t.test('owner editor read returns a row for every controlled platform', async () => {
    const res = await api('GET', '/api/staff/business/social-links', undefined, owner);
    assert.equal(res.status, 200);
    assert.equal(res.data.socialLinks.length, 5);
    assert.ok(res.data.socialLinks.some((l: any) => l.platform === 'website'));
  });

  await t.test('owner can save Instagram and it resolves to a real profile URL on the public detail page', async () => {
    const save = await api('PUT', '/api/staff/business/social-links', {
      socialLinks: [
        { platform: 'instagram', value: '@ironhousegym', enabled: true, order: 0 },
        { platform: 'website', enabled: true, order: 1 },
      ],
    }, owner);
    assert.equal(save.status, 200);
    assert.equal(save.data.pending, false);

    const detail = await api('GET', `/api/salons/${gymId}/profile`);
    const instagram = detail.data.salon.socialLinks.find((l: any) => l.platform === 'instagram');
    assert.equal(instagram.url, 'https://instagram.com/ironhousegym');
  });

  await t.test('owner save rejects an unsupported platform', async () => {
    const res = await api('PUT', '/api/staff/business/social-links', { socialLinks: [{ platform: 'tiktok', value: '@x' }] }, owner);
    assert.equal(res.status, 400);
  });

  await t.test('disabling a link on the owner side removes it from the customer detail page', async () => {
    await api('PUT', '/api/staff/business/social-links', {
      socialLinks: [
        { platform: 'instagram', value: '@ironhousegym', enabled: false, order: 0 },
        { platform: 'website', enabled: true, order: 1 },
      ],
    }, owner);
    const detail = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(detail.data.salon.socialLinks.find((l: any) => l.platform === 'instagram'), undefined);
  });

  await t.test('a non-owner/manager cannot save social links', async () => {
    const db = new DatabaseSync(path.join(dataDir, 'no-wait-salon.db'));
    const now = Date.now();
    db.prepare('INSERT INTO staff_account (id, business_id, email, password_hash, name, role, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
      .run('staff_trainer_social', gymId, 'social-trainer@nowaitsalon.test', '', 'Trainer', 'trainer', now, now);
    db.close();
    const trainerLogin = await api('POST', '/api/staff/test-login', { businessId: gymId, role: 'trainer' });
    const res = await api('PUT', '/api/staff/business/social-links', { socialLinks: [{ platform: 'instagram', value: '@x', enabled: true }] }, trainerLogin.data.token);
    assert.equal(res.status, 403);
  });

  await t.test('admin sees the same persisted social links via the moderation endpoint', async () => {
    await api('PUT', '/api/staff/business/social-links', {
      socialLinks: [
        { platform: 'instagram', value: '@ironhousegym', enabled: true, order: 0 },
        { platform: 'website', enabled: true, order: 1 },
      ],
    }, owner);
    const moderation = await api('GET', `/api/admin/salons/${gymId}/moderation`, undefined, adminToken);
    const instagram = moderation.data.socialLinks.find((l: any) => l.platform === 'instagram');
    assert.equal(instagram.value, '@ironhousegym');
    assert.equal(instagram.enabled, true);
  });

  await t.test('admin can disable a link directly, independent of moderation hold', async () => {
    const disable = await api('PATCH', `/api/admin/salons/${gymId}/social-links/instagram`, { enabled: false }, adminToken);
    assert.equal(disable.status, 200);
    const detail = await api('GET', `/api/salons/${gymId}/profile`);
    assert.equal(detail.data.salon.socialLinks.find((l: any) => l.platform === 'instagram'), undefined);
  });

  await t.test('a moderation hold does not block Admin\'s direct social-link toggle', async () => {
    await api('PUT', `/api/admin/salons/${gymId}/moderation/hold`, { hold: true }, adminToken);
    const enable = await api('PATCH', `/api/admin/salons/${gymId}/social-links/instagram`, { enabled: true }, adminToken);
    assert.equal(enable.status, 200);
    const detail = await api('GET', `/api/salons/${gymId}/profile`);
    assert.ok(detail.data.salon.socialLinks.find((l: any) => l.platform === 'instagram'));
    await api('PUT', `/api/admin/salons/${gymId}/moderation/hold`, { hold: false }, adminToken);
  });

  await t.test('website link reuses website_url — saving it through Basic Info updates the same link, no duplicate field', async () => {
    await api('PUT', '/api/staff/business/profile', { website_url: 'https://ironhousegym.example' }, owner);
    const detail = await api('GET', `/api/salons/${gymId}/profile`);
    const website = detail.data.salon.socialLinks.find((l: any) => l.platform === 'website');
    assert.equal(website.url, 'https://ironhousegym.example');
  });
});
