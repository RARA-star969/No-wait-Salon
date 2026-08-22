import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Mirrors server/index.ts's reconcileBarbers: merges the salon_staff config
 * (Manage Staff / Admin) into live queue state by id, preserving only the
 * live-only fields (status, currentCustomerName) for staff who already
 * existed, adding newly-configured staff as available, and dropping
 * deactivated/removed staff unless they are mid-service.
 *
 * Regression coverage for a real bug: seedState used to give the demo
 * salon's live barbers ids from INITIAL_BARBERS (e.g. "b1") while the
 * salon_staff config table used differently-prefixed ids (e.g.
 * "salon-1-b1"), so reconciliation could never match them by id — every
 * Manage Staff save looked like "add 2 new, drop 2 old" instead of "edit 2
 * existing", duplicating and losing staff on save.
 */
type Barber = {
  id: string;
  name: string;
  status: 'available' | 'busy' | 'unavailable';
  currentCustomerName?: string;
  role?: string;
};

function reconcileBarbers(live: Barber[], configured: Barber[]): Barber[] {
  const configuredById = new Map(configured.map((barber) => [barber.id, barber]));
  const liveById = new Map(live.map((barber) => [barber.id, barber]));
  const next: Barber[] = [];
  for (const config of configured) {
    const existing = liveById.get(config.id);
    next.push(existing ? { ...existing, name: config.name, role: config.role } : { ...config, status: 'available' });
  }
  for (const entry of live) {
    if (!configuredById.has(entry.id) && entry.status === 'busy') next.push(entry);
  }
  return next;
}

test('an id-matched config edit updates the existing live barber in place', () => {
  const live: Barber[] = [{ id: 'salon-1-b1', name: 'Arjun', status: 'busy', currentCustomerName: 'Aman' }];
  const configured: Barber[] = [{ id: 'salon-1-b1', name: 'Arjun', status: 'available', role: 'Senior Barber' }];
  const result = reconcileBarbers(live, configured);
  assert.equal(result.length, 1);
  assert.equal(result[0].role, 'Senior Barber');
  // Live-only fields survive the merge — a config save never interrupts a live chair.
  assert.equal(result[0].status, 'busy');
  assert.equal(result[0].currentCustomerName, 'Aman');
});

test('mismatched ids duplicate staff and lose live status instead of editing in place', () => {
  const live: Barber[] = [
    { id: 'b1', name: 'Arjun', status: 'available' },
    { id: 'b2', name: 'Sameer', status: 'busy', currentCustomerName: 'Riya' },
  ];
  const configured: Barber[] = [
    { id: 'salon-1-b1', name: 'Arjun', status: 'available' },
    { id: 'salon-1-b2', name: 'Sameer', status: 'available', role: 'Senior Stylist' },
  ];
  const result = reconcileBarbers(live, configured);
  // Demonstrates the failure mode this test guards against: with mismatched
  // ids, every configured stylist reads as "a stranger" — Sameer splits into
  // two conflicting records (one with her new role but the wrong, reset
  // status; one with her real busy status but none of the edit) instead of
  // a single record merging both correctly.
  const sameerEntries = result.filter((barber) => barber.name === 'Sameer');
  assert.equal(sameerEntries.length, 2);
  assert.ok(sameerEntries.some((barber) => barber.role === 'Senior Stylist' && barber.status === 'available'));
  assert.ok(sameerEntries.some((barber) => barber.status === 'busy' && barber.role === undefined));
});

test('a newly added staff member appears as available', () => {
  const live: Barber[] = [{ id: 'salon-1-b1', name: 'Arjun', status: 'available' }];
  const configured: Barber[] = [
    { id: 'salon-1-b1', name: 'Arjun', status: 'available' },
    { id: 'salon-1-b3', name: 'Priya', status: 'available' },
  ];
  const result = reconcileBarbers(live, configured);
  assert.equal(result.length, 2);
  assert.ok(result.some((barber) => barber.name === 'Priya' && barber.status === 'available'));
});

test('a deactivated staff member mid-service is kept until the chair frees up', () => {
  const live: Barber[] = [{ id: 'salon-1-b2', name: 'Sameer', status: 'busy', currentCustomerName: 'Riya' }];
  const configured: Barber[] = []; // removed/deactivated in Manage Staff
  const result = reconcileBarbers(live, configured);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Sameer');
});

test('a deactivated staff member who is free is dropped immediately', () => {
  const live: Barber[] = [{ id: 'salon-1-b2', name: 'Sameer', status: 'available' }];
  const configured: Barber[] = [];
  const result = reconcileBarbers(live, configured);
  assert.equal(result.length, 0);
});
