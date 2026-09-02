import assert from 'node:assert/strict';
import test from 'node:test';
import { gymMembershipValidTill, resolveGymAccessBarCopy } from './gymAccessBar.ts';

test('Gym access bar copy is truthful for every physical-APK state', async (t) => {
  await t.test('no selection invites the customer to view real plans', () => {
    assert.deepEqual(resolveGymAccessBarCopy({ state: 'choose_access' }), {
      eyebrow: 'GYM ACCESS',
      main: 'Choose a plan and get started',
      action: 'Book Your Pass',
    });
  });

  await t.test('selected pass and membership show their useful name and Indian-formatted price', () => {
    assert.deepEqual(
      resolveGymAccessBarCopy({
        state: 'selected',
        selectedOffering: { name: 'Day Pass', type: 'visitor_pass', priceInr: 199 },
      }),
      { eyebrow: 'SELECTED ACCESS', main: 'Day Pass · ₹199', action: 'Continue' },
    );
    assert.deepEqual(
      resolveGymAccessBarCopy({
        state: 'selected',
        selectedOffering: { name: 'Monthly', type: 'membership', priceInr: 1499 },
      }),
      { eyebrow: 'SELECTED PLAN', main: 'Monthly · ₹1,499', action: 'Continue' },
    );
  });

  await t.test('active membership includes the real validity date and keeps the working scanner action', () => {
    assert.equal(gymMembershipValidTill('2026-09-30'), '30 Sep');
    assert.deepEqual(
      resolveGymAccessBarCopy({
        state: 'scan',
        membership: { planName: 'Monthly', expiryDate: '2026-09-30' },
      }),
      {
        eyebrow: 'MEMBERSHIP ACTIVE',
        main: 'Valid till 30 Sep',
        action: 'Scan to Check In',
      },
    );
  });

  await t.test('zero published offerings has an honest disabled state, never Choose Access', () => {
    const copy = resolveGymAccessBarCopy({ state: 'unavailable' });
    assert.deepEqual(copy, { eyebrow: 'GYM ACCESS', main: 'No passes available yet', action: 'Unavailable' });
    assert.doesNotMatch(`${copy.main} ${copy.action}`, /choose access/i);
  });
});
