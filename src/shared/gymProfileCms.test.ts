import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeAmenities,
  sanitizeAmenitiesInput,
  normalizeQuickActions,
  sanitizeQuickActionsInput,
  defaultQuickActions,
} from './gymProfileCms.ts';

test('Gym Profile CMS — amenities', async (t) => {
  await t.test('legacy plain-string amenities get a best-effort icon and stay backward compatible', () => {
    const { names, details } = normalizeAmenities(['Wi-Fi', 'Parking', 'Sauna & Recovery Spa']);
    assert.deepEqual(names, ['Wi-Fi', 'Parking', 'Sauna & Recovery Spa']);
    assert.equal(details[0].iconKey, 'Wifi');
    assert.equal(details[1].iconKey, 'ParkingCircle');
    assert.equal(details[2].iconKey, 'Flame');
    assert.ok(details.every((d) => d.active));
  });

  await t.test('an unrecognized legacy name still gets a safe default icon, never crashes', () => {
    const { details } = normalizeAmenities(['Something Unusual']);
    assert.equal(details[0].iconKey, 'Check');
  });

  await t.test('structured amenities pass through with their own icon and order', () => {
    const { names, details } = normalizeAmenities([
      { id: 'a1', name: 'Cardio Deck', iconKey: 'HeartPulse', active: true, order: 1 },
      { id: 'a0', name: 'Strength Zone', iconKey: 'Dumbbell', active: true, order: 0 },
    ]);
    assert.deepEqual(names, ['Strength Zone', 'Cardio Deck']);
    assert.equal(details[0].id, 'a0');
  });

  await t.test('an inactive amenity is kept in details but dropped from the legacy names list', () => {
    const { names, details } = normalizeAmenities([
      { id: 'a1', name: 'VIP Lounge', iconKey: 'Users', active: false, order: 0 },
    ]);
    assert.deepEqual(names, []);
    assert.equal(details.length, 1);
    assert.equal(details[0].active, false);
  });

  await t.test('sanitize rejects a missing name', () => {
    assert.throws(() => sanitizeAmenitiesInput([{ iconKey: 'Wifi' }]));
  });

  await t.test('sanitize rejects an unsupported icon key', () => {
    assert.throws(() => sanitizeAmenitiesInput([{ name: 'Rooftop', iconKey: 'Rocket' }]));
  });

  await t.test('sanitize accepts a valid entry and re-numbers order from array position', () => {
    const result = sanitizeAmenitiesInput([
      { name: 'B', iconKey: 'Wifi', order: 99 },
      { name: 'A', iconKey: 'Dumbbell', order: 1 },
    ]);
    assert.equal(result[0].name, 'B');
    assert.equal(result[0].order, 0);
    assert.equal(result[1].order, 1);
  });
});

test('Gym Profile CMS — quick actions', async (t) => {
  await t.test('an empty/unset config falls back to the trusted default four, all visible', () => {
    const actions = normalizeQuickActions(undefined);
    assert.deepEqual(actions.map((a) => a.type), ['schedule', 'directions', 'branches', 'been_here']);
    assert.ok(actions.every((a) => a.visible));
  });

  await t.test('a saved config keeps owner label/order/visibility for a known type', () => {
    const actions = normalizeQuickActions([
      { type: 'directions', label: 'Get There', iconKey: 'ParkingCircle', visible: false, order: 0 },
      { type: 'schedule', label: 'Book Now', iconKey: 'Clock', visible: true, order: 1 },
    ]);
    assert.equal(actions[0].type, 'directions');
    assert.equal(actions[0].label, 'Get There');
    assert.equal(actions[0].visible, false);
  });

  await t.test('an unknown/unsupported action type is dropped, never smuggled through as custom', () => {
    const actions = normalizeQuickActions([{ type: 'open_url', label: 'Visit site', url: 'https://evil.example' }]);
    // Falls back to the trusted default set once every entry is invalid.
    assert.deepEqual(actions.map((a) => a.type), defaultQuickActions().map((a) => a.type));
  });

  await t.test('sanitize rejects an unsupported action type outright', () => {
    assert.throws(() => sanitizeQuickActionsInput([{ type: 'open_url', label: 'Visit site' }]));
  });

  await t.test('sanitize rejects an unsupported icon key', () => {
    assert.throws(() => sanitizeQuickActionsInput([{ type: 'schedule', iconKey: 'Rocket' }]));
  });

  await t.test('sanitize accepts a valid Directions override and keeps its trusted type', () => {
    const [action] = sanitizeQuickActionsInput([{ type: 'directions', label: 'Navigate', iconKey: 'ParkingCircle', visible: true }]);
    assert.equal(action.type, 'directions');
    assert.equal(action.label, 'Navigate');
  });
});
