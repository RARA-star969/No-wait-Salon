import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { gymCustomerService } from './gymCustomerService.ts';

const serviceSource = readFileSync(fileURLToPath(new URL('./gymCustomerService.ts', import.meta.url)), 'utf8');

test('Capacitor-safe Gym Customer API routing', async (t) => {
  await t.test('uses VITE_API_BASE_URL and never branches on window to choose an API origin', () => {
    assert.match(serviceSource, /const API_BASE_URL\s*=\s*\(import\.meta\.env\??\.VITE_API_BASE_URL\s*\|\|\s*['"]['"]\)\.replace/);
    assert.doesNotMatch(serviceSource, /const getBaseUrl/);
    assert.doesNotMatch(serviceSource, /typeof window[\s\S]{0,80}return ['"]['"]/);
  });

  await t.test('every customer Gym route is built through the canonical API base', () => {
    for (const route of [
      'public-overview',
      'class-booking',
      'pt-booking',
      'my-membership',
      'my-attendance',
      'membership-claims',
      'purchase-intent',
      'checkin/scan',
      'checkout/self',
      '/api/me/gym-memberships',
    ]) assert.ok(serviceSource.includes(route), `missing customer route ${route}`);
    assert.doesNotMatch(serviceSource, /return\s*\{\s*ok:\s*true\s*\}/, 'transactional failures must never become fake success');
  });
});

test('published Gym offerings reach the Customer overview response', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return Response.json({
      gymId: 'gym-physical',
      maxCapacity: 40,
      currentOccupancy: 7,
      waitingOutsideCount: 0,
      checkinsTodayCount: 9,
      classesToday: [],
      trainers: [],
      offerings: [{
        id: 'monthly-1499', name: 'Monthly', type: 'membership', priceInr: 1499,
        durationValue: 1, durationUnit: 'month', description: 'Full access',
        active: true, customerVisible: true, paymentOptions: ['cash'],
      }],
    });
  };
  try {
    const overview = await gymCustomerService.getPublicOverview('gym-physical');
    assert.equal(calls[0], '/api/gym/gym-physical/public-overview');
    assert.equal(overview.offerings?.length, 1);
    assert.equal(overview.offerings?.[0]?.name, 'Monthly');
    assert.equal(overview.offerings?.[0]?.priceInr, 1499);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('membership claim submits to the real configured request pipeline', async () => {
  const originalFetch = globalThis.fetch;
  let captured: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (input, init) => {
    captured = { url: String(input), init };
    return Response.json({ ok: true, claim: { id: 'claim-1', status: 'pending' } }, { status: 201 });
  };
  try {
    const result = await gymCustomerService.submitMembershipClaim('gym-1', {
      name: 'Physical QA', mobile: '9876543210', joiningDate: '2026-08-01',
      expiryDate: '2026-09-30', planText: 'Monthly',
    });
    assert.equal(captured?.url, '/api/gym/gym-1/membership-claims');
    assert.equal(captured?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(captured?.init?.body)), {
      name: 'Physical QA', mobile: '9876543210', joiningDate: '2026-08-01',
      expiryDate: '2026-09-30', planText: 'Monthly',
    });
    assert.equal(result.claim.status, 'pending');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('class and PT transactional errors reject instead of reporting fake success', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: 'TEST backend unavailable' }, { status: 503 });
  try {
    await assert.rejects(gymCustomerService.bookClass('gym-1', 'class-1'), /TEST backend unavailable/);
    await assert.rejects(gymCustomerService.bookPT('gym-1', { trainerId: 't1', trainerName: 'Coach' }), /TEST backend unavailable/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
