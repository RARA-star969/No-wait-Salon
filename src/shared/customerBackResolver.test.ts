import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NO_OVERLAYS,
  parentScreenOf,
  resolveBackAction,
  type CustomerNavState,
} from './customerBackResolver.ts';

const base: CustomerNavState = {
  stage: 'ready',
  landingOverride: false,
  screen: 'home',
  overlays: { ...NO_OVERLAYS },
  ticketOrigin: 'home',
};

type NavOverrides = Omit<Partial<CustomerNavState>, 'overlays'> & {
  overlays?: Partial<CustomerNavState['overlays']>;
};

const state = (overrides: NavOverrides = {}): CustomerNavState => ({
  ...base,
  ...overrides,
  overlays: { ...NO_OVERLAYS, ...(overrides.overlays || {}) },
});

test('the deepest open overlay always closes first', () => {
  // Workout Plan sits inside Member Hub: it must close before the Hub does.
  assert.deepEqual(
    resolveBackAction(state({ overlays: { memberHub: true, memberHubWorkoutPlan: true } })),
    { type: 'close-overlay', overlay: 'memberHubWorkoutPlan' },
  );
  assert.deepEqual(
    resolveBackAction(state({ overlays: { memberHub: true } })),
    { type: 'close-overlay', overlay: 'memberHub' },
  );
  // A top-level sheet outranks a child screen's own back.
  assert.deepEqual(
    resolveBackAction(state({ screen: 'salon', overlays: { cancelSheet: true } })),
    { type: 'close-overlay', overlay: 'cancelSheet' },
  );
  // The QR scanner is a full-screen cover and closes before anything else.
  assert.deepEqual(
    resolveBackAction(state({ overlays: { qrScanner: true, cancelSheet: true, memberHub: true } })),
    { type: 'close-overlay', overlay: 'qrScanner' },
  );
});

test('no nested screen ever exits the app — only the landing root can', () => {
  const nested = ['salon', 'slots', 'profile', 'edit-profile', 'bookings', 'notifications', 'notification-settings', 'gym-activity', 'complete', 'location-select', 'add-address', 'request-address'] as const;
  for (const screen of nested) {
    const action = resolveBackAction(state({ screen }));
    assert.notEqual(action.type, 'exit-app', `${screen} must never exit the app`);
    assert.equal(action.type, 'go-screen', `${screen} steps back to a parent screen`);
  }
  // Home is the deepest customer screen; it backs out to landing, not an exit.
  assert.deepEqual(resolveBackAction(state({ screen: 'home' })), { type: 'go-landing' });
  // Only the landing root itself reports "unhandled", allowing the app to exit.
  assert.deepEqual(resolveBackAction(state({ stage: 'landing' })), { type: 'exit-app' });
  assert.deepEqual(resolveBackAction(state({ landingOverride: true })), { type: 'exit-app' });
});

test('child screens step back to their real parent, never to Home', () => {
  assert.deepEqual(resolveBackAction(state({ screen: 'edit-profile' })), { type: 'go-screen', screen: 'profile' });
  assert.deepEqual(resolveBackAction(state({ screen: 'slots' })), { type: 'go-screen', screen: 'salon' });
  assert.deepEqual(resolveBackAction(state({ screen: 'gym-activity' })), { type: 'go-screen', screen: 'profile' });
  assert.deepEqual(resolveBackAction(state({ screen: 'notification-settings' })), { type: 'go-screen', screen: 'notifications' });
  assert.deepEqual(resolveBackAction(state({ screen: 'add-address' })), { type: 'go-screen', screen: 'location-select' });
  assert.deepEqual(resolveBackAction(state({ screen: 'request-address' })), { type: 'go-screen', screen: 'location-select' });
});

test('the Live Ticket returns to whichever tab it was entered from', () => {
  assert.deepEqual(
    resolveBackAction(state({ screen: 'tracking', ticketOrigin: 'bookings' })),
    { type: 'go-screen', screen: 'bookings' },
    'entered from the Bookings tab -> back to My Bookings',
  );
  assert.deepEqual(
    resolveBackAction(state({ screen: 'tracking', ticketOrigin: 'home' })),
    { type: 'go-screen', screen: 'home' },
    'entered from Home -> back to Home',
  );
  assert.equal(parentScreenOf('tracking', 'bookings'), 'bookings');
  assert.equal(parentScreenOf('tracking', 'home'), 'home');
});

test('bottom-tab destinations back out to Home, not to each other', () => {
  assert.deepEqual(resolveBackAction(state({ screen: 'bookings' })), { type: 'go-screen', screen: 'home' });
  assert.deepEqual(resolveBackAction(state({ screen: 'notifications' })), { type: 'go-screen', screen: 'home' });
  assert.deepEqual(resolveBackAction(state({ screen: 'profile' })), { type: 'go-screen', screen: 'home' });
});

test('the pre-Home permission sequence walks back to landing', () => {
  assert.deepEqual(resolveBackAction(state({ stage: 'location' })), { type: 'go-landing' });
  assert.deepEqual(resolveBackAction(state({ stage: 'notifications' })), { type: 'go-landing' });
});

test('a press mid-hydration is swallowed rather than exiting on a race', () => {
  assert.deepEqual(resolveBackAction(state({ stage: 'loading' })), { type: 'consume' });
});

test('the visible back control and the hardware button agree everywhere', () => {
  const screens = ['salon', 'slots', 'profile', 'edit-profile', 'bookings', 'notifications', 'notification-settings', 'gym-activity', 'location-select', 'add-address', 'request-address', 'complete'] as const;
  for (const screen of screens) {
    const action = resolveBackAction(state({ screen }));
    assert.equal(action.type, 'go-screen');
    assert.equal(
      (action as { screen: string }).screen,
      parentScreenOf(screen),
      `${screen}: header arrow and hardware back must resolve identically`,
    );
  }
});
