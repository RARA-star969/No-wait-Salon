import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldApplySalonSnapshot } from './salonLiveSnapshot';

test('Salon live state rejects a delayed response from the previous business', () => {
  assert.equal(
    shouldApplySalonSnapshot('salon-2', { salonId: 'salon-2', version: 4 }, { salonId: 'salon-1', version: 99 }),
    false,
  );
});

test('Salon live state rejects an older refresh that races a newer SSE event', () => {
  assert.equal(
    shouldApplySalonSnapshot('salon-1', { salonId: 'salon-1', version: 12 }, { salonId: 'salon-1', version: 11 }),
    false,
  );
});

test('Salon live state accepts current and newer authoritative snapshots', () => {
  assert.equal(shouldApplySalonSnapshot('salon-1', null, { salonId: 'salon-1', version: 1 }), true);
  assert.equal(
    shouldApplySalonSnapshot('salon-1', { salonId: 'salon-1', version: 7 }, { salonId: 'salon-1', version: 8 }),
    true,
  );
});
